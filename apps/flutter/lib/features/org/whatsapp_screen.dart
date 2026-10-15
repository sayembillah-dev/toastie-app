import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../app/session.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models_admin.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';

/// Super Admin → WhatsApp sender number (PRD §13). Polls while connecting so
/// the QR refreshes and the screen flips to Connected once scanned.
class WhatsappScreen extends ConsumerStatefulWidget {
  const WhatsappScreen({super.key});
  @override
  ConsumerState<WhatsappScreen> createState() => _WhatsappScreenState();
}

class _WhatsappScreenState extends ConsumerState<WhatsappScreen> {
  WhatsappStatus? _status;
  Object? _error;
  Timer? _poll;
  final _phone = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final s = await ref.read(apiProvider).whatsappStatus();
      if (!mounted) return;
      setState(() {
        _status = s;
        _error = null;
      });
      final pending = s.state == 'connecting' || s.state == 'waiting-for-scan';
      if (pending && _poll == null) {
        _poll = Timer.periodic(const Duration(seconds: 3), (_) => _refresh());
      } else if (!pending) {
        _poll?.cancel();
        _poll = null;
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _connect() async {
    try {
      await ref.read(apiProvider).whatsappConnect();
      await _refresh();
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  Future<void> _disconnect() async {
    final ok = await confirmDialog(context,
        title: 'Disconnect WhatsApp?',
        message: 'Open Floor stops sending WhatsApp messages until a number is linked again, which means scanning a new QR code.',
        confirmLabel: 'Disconnect',
        destructive: true);
    if (!ok) return;
    try {
      await ref.read(apiProvider).whatsappDisconnect();
      await _refresh();
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  Future<void> _test() async {
    if (validatePhone(_phone.text) != null) {
      showToast(context, 'Enter an 11-digit number', error: true);
      return;
    }
    setState(() => _sending = true);
    try {
      await ref.read(apiProvider).whatsappTest(_phone.text.trim());
      HapticFeedback.mediumImpact();
      if (mounted) showToast(context, 'Message sent');
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final s = _status;
    final (label, color) = switch (s?.state) {
      'connected' => ('Connected', c.success),
      'waiting-for-scan' => ('Waiting for scan', c.warning),
      'connecting' => ('Connecting', c.warning),
      'disconnected' => ('Not connected', c.inkMuted),
      'worker-offline' => ('Worker offline', c.danger),
      'not-configured' => ('Not set up', c.inkMuted),
      _ => ('…', c.inkMuted),
    };

    return Scaffold(
      appBar: AppBar(title: const Text('WhatsApp')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
          Text('The number Open Floor sends WhatsApp messages from. Link a dedicated number — never a personal one.', style: t.bodySmall),
          const SizedBox(height: 16),
          if (_error != null && s == null)
            ErrorState(error: _error!, title: 'Could not load the WhatsApp status', onRetry: _refresh)
          else if (s == null)
            const SkeletonBox(height: 120, margin: EdgeInsets.zero)
          else ...[
            AppCard(
              margin: EdgeInsets.zero,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Text(label, style: t.titleMedium),
                ]),
                if (s.number != null) ...[
                  const SizedBox(height: 8),
                  Text('+${s.number}', style: t.headlineMedium),
                  if (s.name != null) Text(s.name!, style: t.bodySmall),
                ],
                if (s.error != null) ...[
                  const SizedBox(height: 8),
                  Text(s.error!, style: TextStyle(color: c.danger, fontSize: 13)),
                ],
                if (s.state == 'not-configured') ...[
                  const SizedBox(height: 8),
                  Text('WhatsApp is switched off on this server. Set WHATSAPP_API_KEY on the API to enable it.', style: t.bodySmall),
                ],
                const SizedBox(height: 12),
                if (s.state == 'connected')
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(foregroundColor: c.danger),
                    onPressed: _disconnect,
                    child: const Text('Disconnect'),
                  )
                else if (s.state == 'disconnected')
                  FilledButton(onPressed: _connect, child: const Text('Connect WhatsApp'))
                else if (s.state == 'worker-offline')
                  OutlinedButton(onPressed: _refresh, child: const Text('Check again')),
              ]),
            ),
            if (s.state == 'waiting-for-scan' && s.qr != null) ...[
              const SizedBox(height: 16),
              AppCard(
                margin: EdgeInsets.zero,
                child: Column(children: [
                  Text('Open WhatsApp on the club’s phone → Settings → Linked devices → Link a device, then point the camera at this code.',
                      style: t.bodyMedium, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(12),
                    child: QrImageView(data: s.qr!, size: 240, backgroundColor: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  Text('The code refreshes every few seconds and expires after about a minute unscanned.', style: t.bodySmall, textAlign: TextAlign.center),
                  TextButton(onPressed: _disconnect, child: const Text('Cancel')),
                ]),
              ),
            ],
            if (s.state == 'connected') ...[
              const SectionLabel('Send a test message', padding: EdgeInsets.fromLTRB(0, 24, 0, 8)),
              Text('Use a number that has the club’s number saved — messages to strangers are what get a number flagged.', style: t.bodySmall),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                    decoration: const InputDecoration(hintText: '01XXXXXXXXX'),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _sending ? null : _test,
                  style: FilledButton.styleFrom(minimumSize: const Size(72, 50)),
                  child: _sending
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(PhosphorIconsRegular.paperPlaneTilt),
                ),
              ]),
            ],
          ],
        ]),
      ),
    );
  }
}
