import '../data/models.dart';
import 'meeting_rules.dart';

/// One thing the signed-in member is doing at a meeting.
class MyRole {
  const MyRole(this.label, {this.toolRoute, this.kind = MyRoleKind.role});
  final String label;
  final MyRoleKind kind;

  /// Relative route of the live tool for this role, if it has one.
  final String? toolRoute;
}

enum MyRoleKind { role, speaker, evaluator }

/// The one action the home hero offers — whatever the member should do next
/// for the meeting. The lineup card already links to the full agenda.
class MyNextStep {
  const MyNextStep(this.label, this.route);
  final String label;

  /// Route relative to `/meetings/<id>/`.
  final String route;
}

const _toolActions = {
  'timer': 'Open my Timer',
  'ah-counter': 'Open my Ah Counter',
  'grammarian': 'Open my Grammarian sheet',
};

/// Role slots with a live tool first, then a speech, then an evaluation; a
/// member holding nothing is invited to take a role.
MyNextStep myNextStep(List<MyRole> mine) {
  for (final r in mine) {
    final label = _toolActions[r.toolRoute];
    if (r.kind == MyRoleKind.role && label != null) return MyNextStep(label, r.toolRoute!);
  }
  for (final r in mine) {
    if (r.kind == MyRoleKind.speaker) return MyNextStep('My speech details', r.toolRoute!);
  }
  for (final r in mine) {
    if (r.kind == MyRoleKind.evaluator) return MyNextStep('My evaluation', r.toolRoute!);
  }
  if (mine.isNotEmpty) return const MyNextStep('See my role', 'roles');
  return const MyNextStep('Take a role', 'roles');
}

/// Everything [membershipId] holds at [meeting]: role slots, prepared or
/// keynote speeches, and evaluations of other speakers.
List<MyRole> myRolesAt(
  Meeting meeting,
  List<RoleAssignment> roles,
  List<PreparedSpeaker> speakers,
  String? membershipId,
) {
  if (membershipId == null) return const [];
  return [
    for (final r in roles)
      if (r.membershipId == membershipId)
        MyRole(
          roleKeyLabel(r.roleKey, start: meeting.dateTime),
          toolRoute: switch (r.roleKey) {
            'timer' => 'timer',
            'ah-counter' => 'ah-counter',
            'grammarian' => 'grammarian',
            _ => null,
          },
        ),
    for (final s in speakers)
      if (s.membershipId == membershipId) MyRole(
          s.isKeynote ? 'Keynote speaker' : 'Speaker ${s.order}',
          toolRoute: 'speakers/${s.id}',
          kind: MyRoleKind.speaker,
        ),
    for (final s in speakers)
      if (s.evaluatorMembershipId == membershipId) MyRole('Evaluator ${s.order}', toolRoute: 'speakers/${s.id}', kind: MyRoleKind.evaluator),
  ];
}
