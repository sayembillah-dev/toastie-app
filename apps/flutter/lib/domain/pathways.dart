import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The Toastmasters Pathways catalog, bundled from `docs/pathway.json`.
class PathwayProject {
  const PathwayProject({required this.name, required this.level, this.speechTime, this.elective = false});
  final String name;
  final int level;
  final String? speechTime; // "4–6 minutes"
  final bool elective;

  /// Parsed minutes range from "4–6 minutes", if present.
  ({int min, int max})? get range {
    final m = RegExp(r'(\d+)\s*[–-]\s*(\d+)').firstMatch(speechTime ?? '');
    if (m == null) return null;
    return (min: int.parse(m.group(1)!), max: int.parse(m.group(2)!));
  }
}

class PathwayLevel {
  const PathwayLevel({required this.level, required this.title, required this.required, required this.electives});
  final int level;
  final String title;
  final List<PathwayProject> required;
  final List<PathwayProject> electives;
}

class Pathway {
  const Pathway({required this.id, required this.name, required this.description, required this.levels});
  final String id;
  final String name;
  final String description;
  final List<PathwayLevel> levels;

  String get abbrev => name.split(' ').where((w) => w.isNotEmpty).map((w) => w[0]).join().toUpperCase();
  int get requiredCount => levels.fold(0, (a, l) => a + l.required.length);
  int get electiveCount => levels.fold(0, (a, l) => a + l.electives.length);

  List<PathwayProject> get allProjects => [for (final l in levels) ...l.required, for (final l in levels) ...l.electives];

  PathwayProject? findProject(String? name) {
    if (name == null) return null;
    for (final p in allProjects) {
      if (p.name == name) return p;
    }
    return null;
  }
}

class PathwayCatalog {
  const PathwayCatalog(this.pathways);
  final List<Pathway> pathways;

  Pathway? byName(String? name) {
    if (name == null) return null;
    for (final p in pathways) {
      if (p.name == name) return p;
    }
    return null;
  }

  /// Port of the web pathway card: speeches left = the active level's
  /// required count minus projects completed at that level; "up next" is the
  /// first not-yet-done project in the level (required first), else the
  /// first required project of the next level.
  ({PathwayProject? next, int leftInLevel, int activeLevel})? progress({
    required String? pathway,
    required int? level,
    required String? currentProject,
    required List<({String type, String? projectName, String? pathway, int? level})> history,
  }) {
    final p = byName(pathway);
    if (p == null || level == null) return null;
    final active = p.findProject(currentProject)?.level ?? level;
    final lvl = p.levels.where((l) => l.level == active).firstOrNull;
    if (lvl == null) return null;
    final completedHere = history
        .where((e) => e.type == 'project-completed' && e.pathway == p.name && e.level == active)
        .length;
    final done = {for (final e in history) if (e.type == 'project-completed' && e.projectName != null) e.projectName!};
    final remaining = [...lvl.required, ...lvl.electives]
        .where((x) => x.name != currentProject && !done.contains(x.name))
        .toList();
    PathwayProject? next = remaining.where((x) => !x.elective).firstOrNull ?? remaining.firstOrNull;
    if (next == null && active < 5) {
      next = p.levels.where((l) => l.level == active + 1).firstOrNull?.required.firstOrNull;
    }
    return (next: next, leftInLevel: (lvl.required.length - completedHere).clamp(0, 99), activeLevel: active);
  }
}

List<PathwayProject> _projects(Object? raw, int level, {bool elective = false}) => raw is List
    ? [
        for (final e in raw)
          if (e is Map)
            PathwayProject(
              name: '${e['name']}',
              level: level,
              speechTime: e['speech_time'] as String?,
              elective: elective,
            )
          else if (e is String)
            PathwayProject(name: e, level: level, elective: elective),
      ]
    : const [];

final pathwayCatalogProvider = FutureProvider<PathwayCatalog>((ref) async {
  final raw = jsonDecode(await rootBundle.loadString('assets/pathway.json')) as Map<String, dynamic>;
  final list = (raw['pathways'] as List).cast<Map<String, dynamic>>();
  return PathwayCatalog([
    for (final p in list)
      Pathway(
        id: '${p['id']}',
        name: '${p['name']}',
        description: '${p['description'] ?? ''}',
        levels: [
          for (final l in (p['levels'] as List).cast<Map<String, dynamic>>())
            PathwayLevel(
              level: (l['level'] as num).toInt(),
              title: '${l['title'] ?? ''}',
              required: _projects(l['required_projects'], (l['level'] as num).toInt()),
              electives: _projects(l['elective_projects'] ?? l['electives'], (l['level'] as num).toInt(), elective: true),
            ),
        ],
      ),
  ]);
});
