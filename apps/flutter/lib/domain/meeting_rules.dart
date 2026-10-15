import 'package:intl/intl.dart';

import '../core/bd_time.dart';
import '../data/models.dart';

class RoleDef {
  const RoleDef(this.key, this.label, {this.optional = false, this.description});
  final String key;
  final String label;
  final bool optional;
  final String? description;
}

String toastmasterLabel(DateTime start) =>
    BdTime.isEvening(start) ? 'Toast Master of the Evening' : 'Toast Master of the Day';

String toastmasterAbbrev(DateTime start) => BdTime.isEvening(start) ? 'TMOE' : 'TMOD';

/// The ten meeting role slots, in agenda order (web `buildRoles`).
List<RoleDef> buildRoles(Meeting m) => [
      const RoleDef('president', 'President'),
      const RoleDef('sergeant-at-arms', 'Sergeant at Arms'),
      RoleDef('toastmaster', toastmasterLabel(m.dateTime)),
      const RoleDef('general-evaluator', 'General Evaluator'),
      const RoleDef('table-topic-master', 'Table Topic Master'),
      const RoleDef('table-topic-evaluator', 'Table Topic Evaluator'),
      const RoleDef('ah-counter', 'Ah Counter'),
      const RoleDef('timer', 'Timer'),
      const RoleDef('grammarian', 'Grammarian'),
      const RoleDef(
        'harkmaster',
        'Harkmaster',
        optional: true,
        description:
            'The Harkmaster listens carefully to the whole meeting and writes questions as it goes. At the end of the meeting they ask those questions to the audience — to find out who was listening most attentively.',
      ),
    ];

/// Readable label for a role key, including keys this build doesn't know.
String roleKeyLabel(String key, {DateTime? start}) {
  if (key == 'toastmaster') return start == null ? 'Toastmaster' : toastmasterLabel(start);
  const known = {
    'president': 'President',
    'sergeant-at-arms': 'Sergeant at Arms',
    'general-evaluator': 'General Evaluator',
    'table-topic-master': 'Table Topic Master',
    'table-topic-evaluator': 'Table Topic Evaluator',
    'ah-counter': 'Ah Counter',
    'timer': 'Timer',
    'grammarian': 'Grammarian',
    'harkmaster': 'Harkmaster',
  };
  return known[key] ??
      key.split(RegExp(r'[-_]')).where((p) => p.isNotEmpty).map((p) => p[0].toUpperCase() + p.substring(1)).join(' ');
}

const targetSpeakers = 4;

const partsOfSpeech = [
  'Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Conjunction', 'Interjection', 'Determiner',
];

const speakerStatuses = {'requested': 'Requested', 'confirmed': 'Confirmed', 'delivered': 'Delivered'};

String _ordinal(int n) {
  final r100 = n % 100;
  if (r100 >= 11 && r100 <= 13) return '${n}th';
  return switch (n % 10) { 1 => '${n}st', 2 => '${n}nd', 3 => '${n}rd', _ => '${n}th' };
}

/// The announcement post (port of web `buildMeetingCaption`).
String buildMeetingCaption(
  Meeting m,
  Club club, {
  required String generalEvaluator,
  required String tableTopicsMaster,
  required String toastmaster,
}) {
  final tmLabel = toastmasterLabel(m.dateTime).replaceFirst('Toast Master', 'Toastmaster');
  final wall = BdTime.wall(m.dateTime);
  final date = DateFormat('d MMMM y', 'en_GB').format(wall);
  final time = DateFormat('h:mm a', 'en_US').format(wall);
  final roleLines = [
    if (generalEvaluator.isNotEmpty) '🎯 General Evaluator — $generalEvaluator',
    if (tableTopicsMaster.isNotEmpty) '💡 Table Topics Master — $tableTopicsMaster',
    if (toastmaster.isNotEmpty) '🎤 $tmLabel — $toastmaster',
  ];
  final details = [
    '📅 Date: $date',
    '🕖 Time: $time',
    if ((club.venueAddress ?? '').isNotEmpty) '📍 Venue: ${club.venueAddress}',
    if ((club.venueMapUrl ?? '').isNotEmpty) '🗺️ Map: ${club.venueMapUrl}',
  ];
  final sections = [
    ['📢 ${_ordinal(m.meetingNumber)} General Meeting | ${club.name} 🎙️'],
    [
      'Dear Fellow Toastmasters & Guests,',
      'You’re warmly invited to our upcoming regular meeting with the theme:',
      '💬 “${m.theme}”',
    ],
    if (roleLines.isNotEmpty) ['✨ Role Players:', ...roleLines],
    details,
    ['Come join us for an evening of learning, speaking, networking, and growth! 🌟'],
  ];
  return sections.map((s) => s.join('\n')).join('\n\n');
}
