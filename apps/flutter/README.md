# Toastie — Flutter app

Native iOS/Android client for Toastie, built to [docs/FLUTTER_APP_PRD.md](../../docs/FLUTTER_APP_PRD.md).
It talks to the same API as the web app (`apps/api`) — no backend changes are
needed for this release.

## Run

```sh
cd apps/flutter
flutter pub get
flutter run --dart-define=API_URL=https://openfloor.club
```

| Define    | Default                  | Purpose                                                                                        |
| --------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `API_URL` | `https://openfloor.club` | API origin; `/api` is appended (a trailing `/api` is tolerated)                                |
| `WEB_URL` | same as `API_URL`        | Origin used for shareable public links (agenda, voting, evaluation, role pages, guest sign-up) |

> The default points at **production**. Publishing a meeting, assigning a
> role or confirming a speech sends real WhatsApp messages to real members.
> Point `API_URL` at a local or staging API for anything but read-only use.

## Test

```sh
flutter analyze
flutter test                      # permission engine, time rules, live-tool state
```

Read-only screen tour on a simulator (signs in, visits every main screen,
saves screenshots to `build/screenshots/`, never writes data):

```sh
flutter drive --driver=test_driver/integration_test.dart \
  --target=integration_test/tour_test.dart \
  --dart-define=TOUR_PHONE=01XXXXXXXXX --dart-define=TOUR_PASSWORD=...
```

## Layout

```
lib/
  main.dart              bootstrap: restore session before first frame
  app/                   router (go_router, tab shell), session + data providers (Riverpod)
  core/
    access/              Dart port of packages/access — keep in lock step (test/access_test.dart)
    api/                 Dio client: bearer + X-Toastly-Context, single-flight token refresh, offline GET cache
    bd_time.dart         every date/time shown in Bangladesh time (UTC+6)
    theme/               design tokens (light + dark)
  data/                  wire models + typed endpoints
  domain/                meeting roles, caption, pathways catalog, "my roles"
  features/
    auth/ home/ meetings/ live/ people/ learn/ me/
  ui/                    shared widgets (cards, sheets, states)
```

## Things to keep in sync with the web

- **Permissions** — `lib/core/access/access.dart` mirrors `packages/access/src/grants.ts` and `can.ts`.
- **Live tools** — Timer / Ah-Counter / Grammarian share one JSON blob per meeting
  with the web (`/meetings/:id/role-state/:kind`). Shapes in `lib/features/live/role_state.dart`
  must match `apps/web/src/lib/meetings/role-state.ts`; unknown keys are preserved.
- **Meeting rules** — role list, TMOD/TMOE at 17:00, "current until start + 2 h",
  caption template: `lib/domain/meeting_rules.dart`, `lib/data/models.dart`.

## Not in this release

Library, Inventory & checklist (incl. the meeting Checklist card), Tasks,
Finance (incl. dues), Records, Activity log — deferred by product. Also not yet
built: Attendance, Voting, Planner, Club Admin, org/super-admin screens, photo
upload, push notifications (needs the device-token endpoint in PRD §13).
