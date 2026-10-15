import 'package:intl/intl.dart';

/// Every date and time in Toastie is shown in Bangladesh time (UTC+6, no
/// daylight saving), whatever the phone's own timezone is. Instants from the
/// API are UTC ISO strings; we shift them by six hours and format the result
/// as if it were UTC, so the device zone never leaks in.
class BdTime {
  const BdTime._();

  static const Duration offset = Duration(hours: 6);

  /// A meeting stays "current" until two hours after it starts.
  static const Duration meetingPastAfter = Duration(hours: 2);

  /// Wall-clock Bangladesh time for an instant, as a UTC DateTime whose
  /// fields read as Dhaka local time.
  static DateTime wall(DateTime instant) => instant.toUtc().add(offset);

  static DateTime parse(String iso) => DateTime.parse(iso).toUtc();

  /// Build a UTC instant from Bangladesh wall-clock parts.
  static DateTime fromWall(int y, int m, int d, int hour, int minute) =>
      DateTime.utc(y, m, d, hour, minute).subtract(offset);

  static String _fmt(String pattern, DateTime instant) =>
      DateFormat(pattern, 'en_GB').format(wall(instant));

  /// "Fri, 16 Oct 2026"
  static String shortDate(DateTime i) => _fmt('EEE, d MMM y', i);

  /// "Friday, 16 October 2026"
  static String longDate(DateTime i) => _fmt('EEEE, d MMMM y', i);

  /// "14 Oct 2026"
  static String date(DateTime i) => _fmt('d MMM y', i);

  /// "10:30 AM" — always uppercase AM/PM, 12-hour clock.
  static String time(DateTime i) =>
      DateFormat('h:mm a', 'en_US').format(wall(i)).toUpperCase();

  /// "Fri, 16 Oct 2026 · 10:30 AM"
  static String meeting(DateTime i) => '${shortDate(i)} · ${time(i)}';

  /// "Thursday 15 October"
  static String todayHeader(DateTime i) => _fmt('EEEE d MMMM', i);

  /// "SEPTEMBER 2026"
  static String monthHeader(DateTime i) => _fmt('MMMM y', i).toUpperCase();

  /// Bangladesh calendar date key, "YYYY-MM-DD".
  static String dateKey(DateTime i) => _fmt('yyyy-MM-dd', i);

  /// Formats a Bangladesh calendar date string ("2026-08-28") without any
  /// timezone shift — these are already local dates.
  static String calendarDate(String ymd) {
    final d = DateTime.tryParse(ymd);
    if (d == null) return ymd;
    return DateFormat('d MMM y', 'en_GB').format(d);
  }

  static String calendarMonthHeader(String ymd) {
    final d = DateTime.tryParse(ymd);
    if (d == null) return ymd;
    return DateFormat('MMMM y', 'en_GB').format(d).toUpperCase();
  }

  /// Toast Master of the Evening when the meeting starts at or after 17:00
  /// Dhaka time.
  static bool isEvening(DateTime instant) => wall(instant).hour >= 17;

  /// "Today", "Tomorrow", "In 3 days", "Yesterday", or null when further out.
  static String? relativeDay(DateTime instant, DateTime now) {
    final a = DateTime.utc(wall(instant).year, wall(instant).month, wall(instant).day);
    final b = DateTime.utc(wall(now).year, wall(now).month, wall(now).day);
    final days = a.difference(b).inDays;
    if (days == 0) return 'Today';
    if (days == 1) return 'Tomorrow';
    if (days == -1) return 'Yesterday';
    if (days > 1 && days < 7) return 'In $days days';
    return null;
  }
}

/// Money is stored in integer minor units (paisa). "৳1,200.00"
String formatTaka(int minor) =>
    '৳${NumberFormat('#,##0.00', 'en_US').format(minor / 100)}';

String fullName(String? first, String? last) =>
    [first, last].where((s) => s != null && s.trim().isNotEmpty).join(' ').trim();

String initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
}

final RegExp bdPhoneRegex = RegExp(r'^01\d{9}$');

String? validatePhone(String? v, {bool required = true}) {
  final s = (v ?? '').trim();
  if (s.isEmpty) return required ? 'Enter a mobile number' : null;
  if (!bdPhoneRegex.hasMatch(s)) return 'Must be 11 digits, e.g. 01568286512';
  return null;
}
