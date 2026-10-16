import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../app/session.dart';
import '../../core/theme/tokens.dart';
import '../../ui/widgets.dart';
import 'light_alert.dart';
import 'live_common.dart';
import 'role_state.dart';

const _green = Color(0xFF1F9D57);
const _yellow = Color(0xFFF2B705);
const _red = Color(0xFFD7263D);

String fmtClock(double secs) {
  final s = secs.floor();
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}

Color? lightColor(Light l) => switch (l) {
      Light.green => _green,
      Light.yellow => _yellow,
      Light.red => _red,
      Light.none => null,
    };

/// Timer live tool (PRD §7.6).
class TimerScreen extends ConsumerStatefulWidget {
  const TimerScreen({super.key, required this.meetingId, this.token});
  final String meetingId;
  final String? token;
  @override
  ConsumerState<TimerScreen> createState() => _TimerScreenState();
}

class _TimerScreenState extends ConsumerState<TimerScreen> {
  late final RoleStateController<TimerState> _ctl = RoleStateController<TimerState>(
    api: ref.read(apiProvider),
    meetingId: widget.meetingId,
    kind: 'timer',
    fromJson: TimerState.fromJson,
    toJson: (s) => s.toJson(),
    empty: TimerState.empty(),
    token: widget.token,
  )..start();
  Timer? _tick;
  String? _openId; // speaker shown in the running view

  @override
  void initState() {
    super.initState();
    WakelockPlus.enable();
    _ctl.addListener(_onState);
    _tick = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (_ctl.state.speakers.any((s) => s.running) && mounted) setState(() {});
    });
  }

  void _onState() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _tick?.cancel();
    _ctl.removeListener(_onState);
    _ctl.dispose();
    WakelockPlus.disable();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    super.dispose();
  }

  int get _now => DateTime.now().millisecondsSinceEpoch;

  Future<void> _add() async {
    final p = await pickPerson(context, title: 'Add speaker', types: timerSpeakerTypes);
    if (p == null) return;
    final id = newId();
    _ctl.update((s) => s.copyWith(speakers: [
          ...s.speakers,
          TimerSpeaker({
            'id': id,
            'memberId': ?p.memberId,
            'guestId': ?p.guestId,
            'name': p.name,
            'type': p.type ?? timerSpeakerTypes.first,
            'status': 'idle',
            'elapsed': 0,
          }),
        ]));
  }

  Future<void> _takeFromAgenda() async {
    try {
      final sources = await loadAgendaSources(ref, widget.meetingId);
      if (sources.isEmpty) {
        if (mounted) showToast(context, 'No speakers or evaluators on the agenda yet');
        return;
      }
      _ctl.update((s) {
        final rows = mergeAgenda(s.speakers.map((x) => x.raw).toList(), sources, (src, existing) {
          final brackets = src.bounds == null ? null : Bracket.fromMinutes(src.bounds!.min, src.bounds!.max).toJson();
          return {
            ...?existing,
            'id': existing?['id'] ?? newId(),
            'memberId': src.memberId,
            'guestId': src.guestId,
            'name': src.name,
            'type': src.timerType,
            'brackets': brackets,
            'agendaKey': src.agendaKey,
            'status': existing?['status'] ?? 'idle',
            'elapsed': existing?['elapsed'] ?? 0,
          };
        });
        final speakers = rows.map(TimerSpeaker.new).toList();
        final keep = speakers.any((x) => x.id == s.activeId);
        return TimerState(speakers, keep ? s.activeId : null, s.extra);
      });
      HapticFeedback.mediumImpact();
      if (mounted) showToast(context, 'Speakers taken from the agenda');
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  void _addMenu() => showActionSheet(context, actions: [
        SheetAction(
          icon: PhosphorIconsRegular.listChecks,
          label: 'Take from agenda',
          subtitle: 'Speakers, evaluators, General and TT Evaluator',
          onTap: _takeFromAgenda,
        ),
        SheetAction(icon: PhosphorIconsRegular.userPlus, label: 'Add speaker', onTap: _add),
      ]);

  void _rowMenu(TimerSpeaker s) => showActionSheet(context, title: s.name, actions: [
        SheetAction(
          icon: PhosphorIconsRegular.pencilSimple,
          label: 'Rename',
          onTap: () async {
            final ctl = TextEditingController(text: s.name);
            final name = await showFormSheet<String>(
              context,
              builder: (ctx) => SheetScaffold(
                title: 'Rename',
                primaryLabel: 'Save',
                onPrimary: () => Navigator.pop(ctx, ctl.text.trim()),
                children: [TextField(controller: ctl, autofocus: true)],
              ),
            );
            if (name == null || name.isEmpty) return;
            _ctl.update((st) => st.copyWith(speakers: [
                  for (final x in st.speakers) x.id == s.id ? x.copyWith({'name': name}) : x,
                ]));
          },
        ),
        SheetAction(
          icon: PhosphorIconsRegular.tag,
          label: 'Change type',
          subtitle: s.type,
          onTap: () => showActionSheet(context, title: 'Speaker type', actions: [
            for (final t in timerSpeakerTypes)
              SheetAction(
                icon: t == s.type ? PhosphorIconsFill.checkCircle : PhosphorIconsRegular.circle,
                label: t,
                onTap: () => _ctl.update((st) => st.copyWith(speakers: [
                      for (final x in st.speakers)
                        x.id == s.id ? x.copyWith({'type': t, 'brackets': null}) : x,
                    ])),
              ),
          ]),
        ),
        SheetAction(
          icon: PhosphorIconsRegular.arrowCounterClockwise,
          label: 'Reset time',
          onTap: () => _ctl.update((st) => st.reset(s.id)),
        ),
        SheetAction(
          icon: PhosphorIconsRegular.trash,
          label: 'Delete',
          destructive: true,
          onTap: () => _ctl.update((st) => TimerState(
                st.speakers.where((x) => x.id != s.id).toList(),
                st.activeId == s.id ? null : st.activeId,
                st.extra,
              )),
        ),
      ]);

  @override
  Widget build(BuildContext context) {
    final state = _ctl.state;
    final open = state.speakers.where((s) => s.id == _openId).firstOrNull;
    if (open != null) {
      return _RunningView(
        speaker: open,
        all: state.speakers,
        now: _now,
        offline: _ctl.offline,
        onClose: () {
          SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
          setState(() => _openId = null);
        },
        onSwitch: (id) => setState(() => _openId = id),
        onStart: () {
          HapticFeedback.mediumImpact();
          _ctl.update((s) => s.start(open.id, _now));
        },
        onStop: () {
          HapticFeedback.mediumImpact();
          _ctl.update((s) => s.stop(open.id, _now));
        },
        onReset: () => _ctl.update((s) => s.reset(open.id)),
      );
    }

    final c = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Timer'),
        actions: [
          SyncDot(offline: _ctl.offline),
          if (widget.token == null) ShareRoleAction(meetingId: widget.meetingId, role: 'timer', label: 'Timer'),
        ],
      ),
      floatingActionButton: state.speakers.isEmpty
          ? null
          : FloatingActionButton(tooltip: 'Add speaker', onPressed: _addMenu, child: const Icon(PhosphorIconsBold.plus)),
      body: !_ctl.loaded
          ? const SkeletonList(count: 4)
          : state.speakers.isEmpty
              ? Center(
                  child: EmptyState(
                    icon: PhosphorIconsRegular.timer,
                    title: 'No speakers yet',
                    message: 'Pull everyone timed from the agenda, or add a speaker by name.',
                    action: Column(children: [
                      FilledButton.icon(
                        onPressed: _takeFromAgenda,
                        icon: const Icon(PhosphorIconsRegular.listChecks, size: 18),
                        label: const Text('Take from agenda'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(onPressed: _add, child: const Text('Add speaker')),
                    ]),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                  itemCount: state.speakers.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final s = state.speakers[i];
                    final secs = s.elapsedAt(_now);
                    final light = s.lightAt(secs);
                    final col = lightColor(light);
                    final b = s.brackets;
                    return Material(
                      color: c.canvas,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(color: s.running ? (col ?? c.ink) : c.line, width: s.running ? 2 : 1),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          SystemChrome.setPreferredOrientations(DeviceOrientation.values);
                          setState(() => _openId = s.id);
                        },
                        onLongPress: () => _rowMenu(s),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
                          child: Row(children: [
                            Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(color: col ?? c.fillStrong, shape: BoxShape.circle),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(s.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                                const SizedBox(height: 2),
                                Text('${s.type} · ${fmtClock(b.green.toDouble())} / ${fmtClock(b.yellow.toDouble())} / ${fmtClock(b.red.toDouble())}',
                                    style: TextStyle(fontSize: 12.5, color: c.inkMuted)),
                              ]),
                            ),
                            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Text(fmtClock(secs),
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w700,
                                    fontFeatures: const [FontFeature.tabularFigures()],
                                    color: s.status == 'idle' ? c.inkMuted : c.ink,
                                  )),
                              Text(
                                switch (s.status) { 'running' => 'Running', 'done' => 'Done', _ => 'Ready' },
                                style: TextStyle(fontSize: 12, color: s.running ? c.success : c.inkMuted),
                              ),
                            ]),
                            IconButton(
                              tooltip: 'More',
                              icon: Icon(PhosphorIconsBold.dotsThreeVertical, size: 18, color: c.inkMuted),
                              onPressed: () => _rowMenu(s),
                            ),
                          ]),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}

class _RunningView extends StatefulWidget {
  const _RunningView({
    required this.speaker,
    required this.all,
    required this.now,
    required this.offline,
    required this.onClose,
    required this.onSwitch,
    required this.onStart,
    required this.onStop,
    required this.onReset,
  });
  final TimerSpeaker speaker;
  final List<TimerSpeaker> all;
  final int now;
  final bool offline;
  final VoidCallback onClose;
  final ValueChanged<String> onSwitch;
  final VoidCallback onStart;
  final VoidCallback onStop;
  final VoidCallback onReset;

  @override
  State<_RunningView> createState() => _RunningViewState();
}

class _RunningViewState extends State<_RunningView> {
  Light? _lastLight;
  final _alert = LightAlert();

  @override
  void initState() {
    super.initState();
    _alert.addListener(_onAlert);
  }

  void _onAlert() {
    if (mounted) setState(() {});
  }

  @override
  void didUpdateWidget(_RunningView old) {
    super.didUpdateWidget(old);
    // A different speaker, or this one stopped/reset: the signal is over.
    if (old.speaker.id != widget.speaker.id) {
      _lastLight = null;
      _alert.stop();
    } else if (!widget.speaker.running) {
      _alert.stop();
    }
  }

  @override
  void dispose() {
    _alert
      ..removeListener(_onAlert)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final s = widget.speaker;
    final secs = s.elapsedAt(widget.now);
    final light = s.lightAt(secs);
    if (_lastLight != null && light != _lastLight && light != Light.none && s.running) {
      // Long SOS vibration + screen flash so the change can't be missed.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _alert.play();
      });
    }
    _lastLight = light;
    final bg = lightColor(light) ?? c.canvas;
    final onBg = light == Light.none ? c.ink : (light == Light.yellow ? const Color(0xFF1C1C1C) : Colors.white);
    final idx = widget.all.indexWhere((x) => x.id == s.id);
    final b = s.brackets;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onClose();
      },
      // Any touch ends the signal early, without swallowing the tap itself.
      child: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: (_) => _alert.stop(),
        child: Stack(fit: StackFit.expand, children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 350),
            color: bg,
            child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            foregroundColor: onBg,
            leading: IconButton(icon: const Icon(PhosphorIconsBold.caretLeft), onPressed: widget.onClose, tooltip: 'All speakers'),
            title: Text('${idx + 1} of ${widget.all.length}', style: TextStyle(color: onBg, fontSize: 15)),
            actions: [
              if (widget.offline) Icon(PhosphorIconsRegular.cloudSlash, color: onBg),
              IconButton(
                tooltip: 'Previous speaker',
                onPressed: idx > 0 ? () => widget.onSwitch(widget.all[idx - 1].id) : null,
                icon: Icon(PhosphorIconsBold.caretUp, color: onBg.withValues(alpha: idx > 0 ? 1 : 0.3)),
              ),
              IconButton(
                tooltip: 'Next speaker',
                onPressed: idx < widget.all.length - 1 ? () => widget.onSwitch(widget.all[idx + 1].id) : null,
                icon: Icon(PhosphorIconsBold.caretDown, color: onBg.withValues(alpha: idx < widget.all.length - 1 ? 1 : 0.3)),
              ),
            ],
          ),
          body: SafeArea(
            child: LayoutBuilder(builder: (context, box) {
              final landscape = box.maxWidth > box.maxHeight;
              final digits = Semantics(
                liveRegion: true,
                label: '${fmtClock(secs)} elapsed, ${light == Light.none ? 'no light' : '${light.name} light'}',
                child: ExcludeSemantics(
                  child: FittedBox(
                    child: Text(
                      fmtClock(secs),
                      style: TextStyle(
                        color: onBg,
                        fontSize: 160,
                        fontWeight: FontWeight.w700,
                        fontFeatures: const [FontFeature.tabularFigures()],
                        height: 1,
                      ),
                    ),
                  ),
                ),
              );
              final info = Column(mainAxisSize: MainAxisSize.min, children: [
                Text(s.name,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: onBg, fontSize: 24, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(s.type, style: TextStyle(color: onBg.withValues(alpha: 0.8), fontSize: 15)),
                const SizedBox(height: 4),
                Text(
                  light == Light.none ? 'NO LIGHT' : '${light.name.toUpperCase()} LIGHT',
                  style: TextStyle(color: onBg, fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 2),
                ),
              ]);
              final legend = Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                for (final (col, v) in [(_green, b.green), (_yellow, b.yellow), (_red, b.red)]) ...[
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: col, shape: BoxShape.circle,
                      border: Border.all(color: onBg.withValues(alpha: 0.5)))),
                  const SizedBox(width: 6),
                  Text(fmtClock(v.toDouble()), style: TextStyle(color: onBg, fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 16),
                ],
              ]);
              final controls = Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                _RoundButton(
                  icon: PhosphorIconsBold.arrowCounterClockwise,
                  label: 'Reset',
                  size: 64,
                  fg: onBg,
                  bg: onBg.withValues(alpha: 0.12),
                  onTap: secs == 0 && s.status == 'idle' ? null : widget.onReset,
                ),
                const SizedBox(width: 28),
                _RoundButton(
                  icon: s.running ? PhosphorIconsFill.stop : PhosphorIconsFill.play,
                  label: s.running ? 'Stop' : 'Start',
                  size: 96,
                  fg: light == Light.none ? c.canvas : bg,
                  bg: onBg,
                  onTap: s.running ? widget.onStop : widget.onStart,
                ),
                const SizedBox(width: 92),
              ]);
              if (landscape) {
                return Row(children: [
                  Expanded(flex: 3, child: Padding(padding: const EdgeInsets.all(16), child: digits)),
                  Expanded(
                    flex: 2,
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      info,
                      const SizedBox(height: 16),
                      legend,
                      const SizedBox(height: 20),
                      controls,
                    ]),
                  ),
                ]);
              }
              return Column(children: [
                const SizedBox(height: 8),
                info,
                Expanded(child: Center(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: digits))),
                legend,
                const SizedBox(height: 28),
                controls,
                const SizedBox(height: 32),
              ]);
            }),
          ),
        ),
          ),
          // SOS flash: dark between pulses, the light colour on each pulse.
          if (_alert.active && !_alert.flashOn) const IgnorePointer(child: ColoredBox(color: Color(0xE6000000))),
        ]),
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.label, required this.size, required this.fg, required this.bg, this.onTap});
  final IconData icon;
  final String label;
  final double size;
  final Color fg;
  final Color bg;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Opacity(
        opacity: onTap == null ? 0.4 : 1,
        child: Material(
          color: bg,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(width: size, height: size, child: Icon(icon, color: fg, size: size * 0.4)),
          ),
        ),
      ),
    );
  }
}
