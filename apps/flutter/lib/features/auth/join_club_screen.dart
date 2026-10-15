import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/session.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';

final _directoryProvider = FutureProvider<List<DirectoryClub>>((ref) => ref.watch(apiProvider).clubDirectory());

/// Shown to a signed-in user who isn't in any club yet (PRD §5.3).
class JoinClubScreen extends ConsumerStatefulWidget {
  const JoinClubScreen({super.key});
  @override
  ConsumerState<JoinClubScreen> createState() => _JoinClubScreenState();
}

class _JoinClubScreenState extends ConsumerState<JoinClubScreen> {
  final _code = TextEditingController();
  final _search = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _join() async {
    final code = _code.text.trim().toUpperCase();
    if (code.isEmpty) {
      setState(() => _error = 'Paste the club code your Club Admin shared');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiProvider).joinByCode(code);
      await ref.read(authProvider.notifier).refreshSession();
      if (!mounted) return;
      showToast(context, 'Welcome to ${res['clubName'] ?? 'the club'}');
      context.go('/');
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final user = ref.watch(signedInProvider)?.session.user;
    final dir = ref.watch(_directoryProvider);
    final q = _search.text.trim().toLowerCase();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Join a club'),
        actions: [
          TextButton(onPressed: () => ref.read(authProvider.notifier).signOut(), child: const Text('Sign out')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(_directoryProvider.future),
        child: ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Text('Welcome to Open Floor${user == null ? '' : ', ${user.firstName}'}.', style: t.headlineMedium),
            ),
            const SizedBox(height: 16),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Icon(PhosphorIconsRegular.key, color: c.inkSoft),
                  const SizedBox(width: 10),
                  Text('Have a club code?', style: t.titleMedium),
                ]),
                const SizedBox(height: 6),
                Text('A Club Admin already added you? Paste the code they shared to join instantly.', style: t.bodySmall),
                const SizedBox(height: 12),
                TextField(
                  controller: _code,
                  textCapitalization: TextCapitalization.characters,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp('[A-Za-z0-9]')),
                    LengthLimitingTextInputFormatter(12),
                  ],
                  style: const TextStyle(fontSize: 20, letterSpacing: 3, fontWeight: FontWeight.w600),
                  textInputAction: TextInputAction.go,
                  onSubmitted: (_) => _join(),
                  decoration: InputDecoration(
                    hintText: 'e.g. 25YXMP96',
                    errorText: _error,
                    suffixIcon: IconButton(
                      tooltip: 'Paste',
                      icon: const Icon(PhosphorIconsRegular.clipboardText),
                      onPressed: () async {
                        final d = await Clipboard.getData('text/plain');
                        if (d?.text != null) _code.text = d!.text!.trim().toUpperCase();
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _busy ? null : _join,
                  child: _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                      : const Text('Join club'),
                ),
              ]),
            ),
            const SectionLabel('Browse clubs'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _search,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  hintText: 'Search by name or club number',
                  prefixIcon: Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
                ),
              ),
            ),
            const SizedBox(height: 8),
            AsyncBody<List<DirectoryClub>>(
              value: dir,
              onRetry: () => ref.invalidate(_directoryProvider),
              builder: (clubs) {
                final list = clubs
                    .where((c) => q.isEmpty || c.name.toLowerCase().contains(q) || (c.clubNumber ?? '').contains(q))
                    .toList();
                if (list.isEmpty) {
                  return const EmptyState(icon: PhosphorIconsRegular.buildings, title: 'No clubs match');
                }
                return GroupCard(children: [
                  for (final club in list)
                    RowTile(
                      leading: Avatar(name: club.name, size: 38),
                      title: club.name,
                      subtitle: [
                        if (club.clubNumber != null) '#${club.clubNumber}',
                        [club.districtName, club.divisionName, club.areaName].whereType<String>().join(' · '),
                      ].where((s) => s.isNotEmpty).join('  ·  '),
                      trailing: const Chevron(),
                      onTap: () => _showClub(club),
                    ),
                ]);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showClub(DirectoryClub club) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) {
        final t = Theme.of(ctx).textTheme;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(club.name, style: t.titleLarge),
              const SizedBox(height: 4),
              Text(
                [
                  if (club.clubNumber != null) 'Club #${club.clubNumber}',
                  club.districtName,
                  club.divisionName,
                  club.areaName,
                ].whereType<String>().join(' · '),
                style: t.bodySmall,
              ),
              const SizedBox(height: 16),
              Text(
                'To join, ask this club’s Club Admin for their join code or a personal invite link, then paste the code above.',
                style: t.bodyMedium,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Got it')),
              ),
            ]),
          ),
        );
      },
    );
  }
}
