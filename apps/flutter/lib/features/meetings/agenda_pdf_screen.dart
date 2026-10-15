import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';

import '../../core/theme/tokens.dart';
import '../../domain/pathways.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';
import 'agenda_screen.dart' show AgendaData;
import 'agenda_sheet.dart';

/// The printable agenda — the same A4 sheet the web prints — previewed, with
/// Download (system "save to" dialog — Downloads, Drive, Files…), Share and
/// Print.
class AgendaPdfScreen extends ConsumerStatefulWidget {
  const AgendaPdfScreen({super.key, required this.data});
  final AgendaData data;

  @override
  ConsumerState<AgendaPdfScreen> createState() => _AgendaPdfScreenState();
}

class _AgendaPdfScreenState extends ConsumerState<AgendaPdfScreen> {
  late final Future<Uint8List> _pdf = () async {
    final catalog = await ref.read(pathwayCatalogProvider.future);
    return renderAgendaSheetPdf(widget.data, projectLookup(catalog));
  }();
  bool _saving = false;

  String get _fileName => 'meeting-${widget.data.meetingNumber}-agenda.pdf';

  Future<void> _download() async {
    setState(() => _saving = true);
    try {
      final uri = await FilePicker.saveFile(
        fileName: _fileName,
        bytes: await _pdf,
        mimeType: 'application/pdf',
        dialogTitle: 'Save agenda PDF',
      );
      if (mounted && uri != null) showToast(context, 'Agenda saved');
    } catch (_) {
      if (mounted) showToast(context, 'Couldn’t save the PDF. Try Share instead.', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _share() async => Printing.sharePdf(bytes: await _pdf, filename: _fileName);

  Future<void> _print() => Printing.layoutPdf(
        name: 'Meeting #${widget.data.meetingNumber} agenda',
        onLayout: (_) => _pdf,
      );

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('Meeting #${widget.data.meetingNumber} agenda')),
      body: FutureBuilder<Uint8List>(
        future: _pdf,
        builder: (context, snap) {
          if (snap.hasError) {
            return EmptyState(
              icon: PhosphorIconsRegular.fileX,
              title: 'Couldn’t build the PDF',
              message: 'Please go back and try again.',
            );
          }
          if (!snap.hasData) {
            return Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const CircularProgressIndicator(),
                const SizedBox(height: 12),
                Text('Preparing the agenda…', style: Theme.of(context).textTheme.bodySmall),
              ]),
            );
          }
          return PdfPreview(
            build: (_) => snap.data!,
            useActions: false,
            canDebug: false,
            pdfFileName: _fileName,
            scrollViewDecoration: BoxDecoration(color: c.fill),
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 8, Space.gutter, 8),
          child: Row(children: [
            Expanded(
              flex: 2,
              child: FilledButton.icon(
                onPressed: _saving ? null : _download,
                icon: _saving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(PhosphorIconsRegular.downloadSimple, size: 18),
                label: const Text('Download'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _share,
                icon: const Icon(PhosphorIconsRegular.shareNetwork, size: 18),
                label: const Text('Share'),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.outlined(
              tooltip: 'Print',
              onPressed: _print,
              icon: const Icon(PhosphorIconsRegular.printer, size: 18),
            ),
          ]),
        ),
      ),
    );
  }
}
