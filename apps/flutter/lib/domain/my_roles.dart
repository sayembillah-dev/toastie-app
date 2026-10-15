import '../data/models.dart';
import 'meeting_rules.dart';

/// One thing the signed-in member is doing at a meeting.
class MyRole {
  const MyRole(this.label, {this.toolRoute});
  final String label;

  /// Relative route of the live tool for this role, if it has one.
  final String? toolRoute;
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
      if (s.membershipId == membershipId) MyRole(s.isKeynote ? 'Keynote speaker' : 'Speaker ${s.order}', toolRoute: 'speakers/${s.id}'),
    for (final s in speakers)
      if (s.evaluatorMembershipId == membershipId) MyRole('Evaluator ${s.order}', toolRoute: 'speakers/${s.id}'),
  ];
}
