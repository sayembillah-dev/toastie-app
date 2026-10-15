# Toastie Mobile (Flutter): Product Requirements Document

Status: draft v1, 2026-10-15
Source: rebuilt from the shipped web app (`apps/web`) and the existing Expo app
(`apps/mobile`). Both were read in code and walked through at phone size against
a live backend.
Supersedes: the "No native mobile app" non-goal in [PRD.md](PRD.md) §5.

---

## 0. How to read this document

- This is a **mobile-first** spec. The web app is the functional reference, not
  the UX reference. Wherever the web uses a desktop pattern (sidebar,
  hamburger drawer, data tables, hover, multi-column kanban, modals stacked on
  modals), this document names the native pattern that replaces it.
- The backend (`apps/api`) is unchanged. Every screen below lists the endpoints
  it already uses. All paths are relative to `{API_URL}/api`.
- **Out of scope for v1**, at the product owner's request. Do not build these:
  Library, Inventory & checklist (this also covers the per-meeting
  **Checklist** card), Tasks, Finance (this also covers the dashboard
  **Dues & fees** card), Records, and Activity log (this also covers the
  dashboard **Recent activity** and the Club Admin **Audit trail**). Leave
  extension points so they can be added later as extra cards or tabs.
- Priority tags: **P0** is needed for the first store release. **P1** is the
  next release. **P2** is later.

---

## 1. Product summary

Toastie is the operations app for a Toastmasters club. Members see their next
meeting, their role and their Pathways progress. Officers build the meeting
agenda, run the live roles during the meeting (Timer, Ah-Counter, Grammarian,
voting and attendance), and track guests until they become members. Directors
and the platform super admin manage the District → Division → Area → Club
tree.

All users are in Bangladesh. That means phone-number login (11 digits,
`01XXXXXXXXX`), money in taka (৳), and **every date and time shown in
Bangladesh time (UTC+6)**, whatever the phone's own timezone is.

### 1.1 Why a native app

- People use it **in the meeting room**, on a phone, often with one hand. The
  Timer, Ah-Counter and voting happen live, in real time.
- Users need push notifications (role assigned, meeting published, speech
  confirmed). These currently go out only as WhatsApp messages.
- The camera and microphone are needed for evaluations (photo of a paper form,
  voice memo) and for scanning QR codes.
- The existing Expo app is read-only and covers about 10% of the web. Flutter
  replaces it.

### 1.2 Goals

1. Feature parity with the web for everything in scope (§0), with a UX that
   feels native on both iOS and Android.
2. A member can find their next role in **one tap** from launch.
3. An officer can run a full meeting (timer, ah-counter, grammarian,
   attendance, voting) from a phone, without the web.
4. Enforce the same permission model as the API and web. Hide what a user
   can't do; never show a dead control without explaining why.

### 1.3 Non-goals (v1)

- The modules deferred in §0.
- Guest-facing public pages (agenda, voting, evaluation form, guest sign-up)
  stay on the **web**, because guests don't install apps. The app **opens**
  these links (it handles deep links and opens them in-app when installed),
  and officers **share** them from the app.
- Offline editing. Read-only cached data is enough (§9.4).
- Bangla localisation. Everything is in English today, but build with i18n
  scaffolding (`flutter_localizations` + ARB) from day one.

---

## 2. Users and roles

### 2.1 Personas

| Persona                                      | What they do in the app                                                                                                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Member**                                   | Checks the next meeting and their role, reads the agenda, requests a speech slot, tracks their Pathway, edits their profile. **Any member can also edit meeting agendas** (product decision). |
| **VP Education (VPE)**                       | Builds agendas, assigns roles and speakers, manages everyone's Pathways, handles speech-slot requests.                                                                                        |
| **VP Membership (VPM)**                      | Runs the guest pipeline: add guest, log contact, log visit, move stage, convert to member, invite links.                                                                                      |
| **Sergeant at Arms / Secretary / President** | Attendance, meeting setup, table topics.                                                                                                                                                      |
| **Club Admin / Moderator**                   | Everything in the club: roster, roles, per-member permission overrides, club profile.                                                                                                         |
| **Area / Division / District Director**      | Read-only oversight of their part of the tree. Can rename the unit and update clubs in it.                                                                                                    |
| **Super Admin**                              | Platform operator: org tree, all users, WhatsApp sender number.                                                                                                                               |

### 2.2 Role and permission model (port as-is)

Source of truth: `packages/access`. **Port it to Dart as a pure package**
(`toastie_access`) with the same unit tests as `can.test.ts`. The API enforces
the same rules; the client check exists only to hide UI.

- **Club roles:** `Guest, Member, SergeantAtArms, President, Treasurer,
VPMembership, VPPR, VPEducation, IPP, Secretary, ClubAdmin, Moderator`. One
  membership can hold several roles.
- **Org roles:** `AreaDirector, DivisionDirector, DistrictDirector`.
- **Actions:** `create, read, update, delete`.
- **Scopes:** `own, club, area, division, district, global`.
- **Resources (in-scope subset):** `club, member, memberRole,
memberPermission, education, meeting, meetingRole, tableTopic, attendance,
guest, guestLog, evaluation, speechRequest, invite, joinRequest, orgUnit,
orgAssignment, user, report`.
- **Evaluation order:**
  1. Super admin is always allowed.
  2. Find the user's assignments that cover the target.
  3. Take the role grants for each one.
  4. Apply per-membership **overrides** (`"resource:action": "allow" | "deny"`,
     club assignments only).
  5. An explicit deny wins.
  6. Otherwise any allow wins.
  7. Otherwise deny.

Default grants, simplified:

| Role                                | Notable rights beyond reading the club                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Member                              | Full create/read/update/delete on `meeting` and `meetingRole`. Update **own** `education`. Create and read **own** `speechRequest`. Read **own** `evaluation`. |
| SAA                                 | + attendance                                                                                                                                                   |
| President                           | + tableTopic, attendance, read/update education, read report                                                                                                   |
| VPM                                 | + guest, guestLog, create invite                                                                                                                               |
| VPE                                 | + education, tableTopic, speechRequest, evaluation                                                                                                             |
| Secretary                           | + attendance                                                                                                                                                   |
| ClubAdmin / Moderator               | Everything in the club, including `member`, `memberRole`, `memberPermission`, `club`, `invite`, `joinRequest`                                                  |
| Area / Division / District Director | Read everything in their scope; update `orgUnit` and `club` in their scope                                                                                     |

### 2.3 Active context

One user can belong to several clubs and also hold Director roles, so the app
always works inside **one active context**:

- `club:<clubId>`
- `area:<id>`, `division:<id>` or `district:<id>`
- `global` (super admin)

Rules:

- Send the context on **every** request as the header
  `X-Toastly-Context: <key>`. A 403 with `CONTEXT_NOT_HELD` means the stored
  context is stale: reset to the default.
- Restore order on launch: the stored key, then the server's
  `defaultContextKey`, then the first available context. Having no context at
  all is valid; it means the user hasn't joined a club yet (§5.3).
- **Cache isolation:** prefix every cache key with the context key, so that
  switching clubs never shows the previous club's data.
- **Switcher UX (mobile):** tap the club name in the Home header to open a
  bottom sheet. It lists the user's club contexts (marked "Your home club"),
  then any Director scopes, then "Full access" (super admin). Show it only
  when there is more than one context.

---

## 3. Information architecture (mobile)

### 3.1 Navigation shell

Use a native **bottom navigation bar** (Material 3 `NavigationBar` on Android,
Cupertino-style tab bar on iOS). Each tab keeps its own navigation stack, so
switching tabs keeps the user's place. Do **not** port the web's hamburger
drawer.

**Club context (the default for nearly everyone):**

| #   | Tab          | Icon           | Visible when                  | Root screen             |
| --- | ------------ | -------------- | ----------------------------- | ----------------------- |
| 1   | **Home**     | house          | always                        | Dashboard (§6)          |
| 2   | **Meetings** | calendar       | `read meeting`                | Meetings list (§7.1)    |
| 3   | **People**   | people         | `read member` or `read guest` | Guests and Members (§8) |
| 4   | **Learn**    | graduation cap | `read education`              | Education (§10)         |
| 5   | **Me**       | avatar         | always                        | My profile hub (§11)    |

**Club Admin** is not a tab. It is a row group inside **Me** ("Manage club"),
shown only when the user has `read memberRole`. Few people need it, so it
shouldn't take a primary slot.

**Org context (Director):** the tabs become **Home** (unit overview), **Units**
(drill down through the tree), and **Me**.

**Global context (Super Admin):** the tabs become **Org tree**, **Users** and
**Me**. WhatsApp settings live under Me → Platform.

### 3.2 Screen map

```
Splash ─┬─ Sign in ─ Register ─ (Join club: browse | code)
        └─ App shell
            ├─ Home
            │   ├─ Next meeting → Meeting detail
            │   ├─ My role chip → Meeting detail › that role's tool
            │   ├─ Current pathway → My pathway
            │   └─ Lineup "Full agenda" → Agenda (read view)
            ├─ Meetings
            │   ├─ Segments: Current | Upcoming | Past
            │   ├─ FAB + → New meeting (sheet)
            │   ├─ Planner (pushed)
            │   └─ Meeting detail (hub of cards)
            │        ├─ Overview / At a glance + Agenda preview
            │        ├─ Roles · Prepared speakers · Theme & WOTD · Table topics
            │        ├─ Timer · Ah-Counter · Grammarian   (live tools, full-screen)
            │        └─ Attendance · Voting
            ├─ People
            │   ├─ Guests (pipeline) → Guest profile → Visit logs / Contact logs
            │   └─ Members (engagement) → Member engagement profile
            ├─ Learn
            │   ├─ Members (roster with levels) → Member pathway (Progress | History)
            │   └─ Pathways catalog → Pathway detail → Project
            └─ Me
                ├─ My pathway · My speeches · Speech slot requests · My history
                ├─ Edit profile · Change password · Notifications · Delete account
                ├─ Manage club (Club Admin): Overview · Members · Permissions · Club profile
                └─ Switch context · Sign out
```

### 3.3 Deep links

| Pattern                                | Destination                                |
| -------------------------------------- | ------------------------------------------ |
| Scheme `toastie://` (exists already)   | General in-app links                       |
| `https://<web-host>/meetings/:id`      | Meeting detail                             |
| `/meetings/:id/agenda`                 | Agenda read view (public; no login needed) |
| `/meetings/:id/vote?t=`                | Ballot (in-app if signed in, else web)     |
| `/meetings/:id/roles/:role?t=`         | Live tool for that role                    |
| `/meetings/:id/evaluate/:speakerId?t=` | Evaluation form                            |
| `/invite/:token`                       | Accept club invite                         |
| `/guest-invite/:token`                 | Web only                                   |
| `/credentials/:userId?t=`              | Web only                                   |

- Configure iOS Universal Links and Android App Links for all of the https
  patterns above.
- Bundle ID / package: `com.toastie.app` (keep it, so the app updates the
  existing store listing).

---

## 4. Design system

### 4.1 Brand decision (open, see §14 Q1)

The two existing clients disagree:

- **Web:** monochrome. Ink `#1C1C1C` on white, fills `#F2F2F2` / `#EBEBEB`,
  lines `#EDEDED`, radius 8.
- **Expo:** iOS blue accent `#208AEF`.

The web dashboard also uses a **deep navy gradient hero** (next-meeting card)
with a **mint accent ring and chip** ("You're Grammarian").

**Recommendation:** monochrome ink as the base, navy for hero surfaces, mint
as the single "this is you / success" accent. This matches what users already
see on the web. Define everything as tokens, with dark mode from day one: the
web has none, but the Expo app already follows the system setting.

| Token                   | Light                                  | Dark    | Use                              |
| ----------------------- | -------------------------------------- | ------- | -------------------------------- |
| `ink`                   | #1C1C1C                                | #F5F5F5 | primary text, primary button     |
| `inkSoft`               | #5C5C5C                                | #B0B4BA | secondary text                   |
| `inkMuted`              | #8A8A8A                                | #7C8088 | tertiary, captions               |
| `canvas`                | #FFFFFF                                | #0B0B0C | screen background                |
| `surface`               | #FAFAFA                                | #161618 | grouped background               |
| `fill`                  | #F2F2F2                                | #212225 | chips, inputs                    |
| `line`                  | #EDEDED                                | #2E3135 | dividers                         |
| `heroStart` / `heroEnd` | navy gradient (from the web dashboard) | same    | next-meeting hero, meeting cards |
| `accentMine`            | mint (match the web ring)              | —       | "You", your role chip, success   |
| `danger`                | #CE2C31                                | #FF9592 |                                  |
| `warning`               | #9E6C00                                | #FFC53D | Draft badge                      |
| `success`               | #218358                                | #3DD68C | Within time, Published           |

- **Guest stage colours** (keep them; the web uses them for the pipeline):

  | Stage             | Accent  | Soft background |
  | ----------------- | ------- | --------------- |
  | New               | #64748B | #F1F5F9         |
  | Contacted         | #B45309 | #FEF3C7         |
  | Interested        | #0369A1 | #E0F2FE         |
  | Joined Meeting(s) | #6D28D9 | #EDE9FE         |
  | Joined Club       | #047857 | #D1FAE5         |
  | Not Interested    | #8A8A8A | #F2F2F2         |

- **Timer light colours:** green, yellow and red as full-screen backgrounds
  (§7.6).
- **Typography:** the platform system font (SF Pro / Roboto). Do not bundle
  web fonts.
  - Large title 34/41 semibold
  - Title 22/28 semibold
  - Body 16/24
  - Footnote 13/18
  - Section label: 12/16, uppercase, tracking +0.6, `inkMuted`
  - Countdown digits: tabular figures
- **Spacing:** 4-pt grid (4, 8, 12, 16, 24, 32). Screen side gutter 16.
- **Radius:** 12 for cards, 16 for sheets (top corners), 999 for chips.
- **Icons:** Phosphor (`phosphor_flutter`), same set as the web.
- **Motion:**
  - Default platform page transitions.
  - Sheet spring.
  - Press scale 0.97.
  - Respect the reduce-motion setting.
  - Haptics: light tap on tally increments; medium on timer start and stop;
    success on publish and on submitting a vote.

### 4.2 Component rules (mobile)

| Web pattern                         | Mobile replacement                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Hamburger sidebar                   | Bottom navigation (§3.1)                                                                                      |
| Ant Modal forms                     | **Full-height modal sheet** (or a pushed page for long forms) with a sticky primary button above the keyboard |
| Ant Drawer (right side)             | Pushed page                                                                                                   |
| Ant Drawer (bottom)                 | Native bottom sheet                                                                                           |
| "…" dropdown menus                  | Action sheet (iOS) / modal bottom sheet (Android)                                                             |
| Data tables                         | Lists with leading avatar, two text lines and a trailing value or chevron                                     |
| Desktop tab strip (11 meeting tabs) | **Card grid hub** with progress rings (web mobile already does this) → each card pushes a page                |
| Multi-column kanban                 | Horizontal **stage chips** with counts + filtered list; long-press or swipe to move stage (§8.1)              |
| "Copy link" buttons                 | **Share** button → native share sheet (copy is one option in it)                                              |
| QR in modal                         | Full-screen QR page with brightness boosted and Share                                                         |
| Hover tooltips                      | Inline helper text or an info sheet                                                                           |
| Confirm modal                       | Native alert dialog; destructive action in red                                                                |
| Toasts                              | SnackBar, placed above the bottom nav                                                                         |

- Hide controls the user can never use. The one exception is a screen's
  **primary** action: show it disabled with a one-line reason, so a read-only
  member understands where they stand.
- Every list needs four states: **loading** (skeleton), **empty** (icon, one
  sentence, and a CTA if the user can act), **error** (message + Retry), and
  **pull-to-refresh**.
- Minimum tap target is 44×44. Bottom content clears the safe-area inset and
  the nav bar.

---

## 5. Authentication and onboarding

### 5.1 Sign in (P0)

- Fields:
  - **Mobile number:** numeric keypad, exactly 11 digits, placeholder
    `01XXXXXXXXX`.
  - **Password:** show/hide toggle.
- Primary button: Sign in. Link: "New to Toastie? Create an account".
- `POST /auth/login {phone, password}` → `{tokens:{accessToken,
refreshToken}, session}`.
- Errors:
  - 401 → "That phone number and password do not match."
  - 403 → "This account is suspended. Contact a club officer."
  - Network failure → "Can't reach the server. Check your connection and try
    again."
- Footnote: "Added to a club roster? Register with that phone number; your
  record links automatically."
- If `session.user.mustChangePassword` is true, route to **Change password**
  (§11.5) with a "Skip for now" option.

### 5.2 Register (P0)

- Fields:
  - Full name (required)
  - Mobile number (11 digits)
  - Email (optional)
  - Password (minimum 8 characters)
- `POST /auth/register`, then sign in automatically, then go to onboarding.
- If the phone number is already on a club roster, the membership is claimed
  automatically.

### 5.3 Join a club (P0), shown when the user has no club context

Welcome screen with two options:

1. **Browse clubs.**
   - `GET /clubs/directory`.
   - Searchable list (name or club number).
   - Each row shows District · Division · Area.
   - Tapping a club opens its detail (motto, venue, socials) with
     "No further details listed" as a fallback.
2. **Enter club code.**
   - 8-character code field, auto-uppercase, accepts paste (e.g. `25YXMP96`).
   - `POST /clubs/join-by-code`.
   - On success: "Welcome to {club}", then a session refresh, then Home.

### 5.4 Club invite link (P0)

- Deep link `/invite/:token`.
- `GET /public/invites/:token` returns a preview: club, role(s), and a
  "works once" note.
- Not signed in: show "Do you have an account?" with **Log in** / **Sign up**,
  then come back to the invite.
- Signed in: **Accept & join** → `POST /invites/:token/accept`.
- Error states: expired, already used, revoked, invalid link.

### 5.5 Session and tokens (P0)

- **Storage:** `flutter_secure_storage`. Keys: `toastie.accessToken`,
  `toastie.refreshToken`, `toastie.activeContext`. On iOS use accessibility
  `first_unlock` so a push-triggered launch can read the tokens.
- **On launch:** keep the splash up → read tokens → `GET /auth/session`.
  - Only an auth failure wipes tokens.
  - If the server is unreachable, show the cached session read-only with an
    offline banner.
- **On 401:** call `POST /auth/refresh {refreshToken}` **single-flight**: one
  shared Future for all concurrent 401s. Refresh tokens rotate, and sending
  the same token twice revokes the whole token family, which logs out every
  device. Retry the original request once. If refresh fails, clear the tokens
  and go to Sign in.
- Never retry a 403.
- **Base URL:** set per flavour (`dev`, `staging`, `prod`). Prod is
  `https://toastie.niftyitsolution.com`. Normalise it so there is exactly one
  `/api` suffix.
- **Every request sends:**
  - `Accept: application/json`
  - `Authorization: Bearer …`
  - `X-Toastly-Context: …`
- **Error shape:** `{statusCode, code, message (string | string[]), fields?}`.
  Map `fields` onto the matching form fields.

---

## 6. Home / Dashboard (P0)

Scrolls vertically, supports pull-to-refresh, and has a large title.

1. **Header.** "Hi, {firstName}". The subtitle is "{Club name} ·
   {weekday day month}", and the club name is tappable to open the context
   switcher.
2. **Next meeting hero.** Navy gradient card; a mint ring when the user has a
   role.
   - Content: "NEXT MEETING · #55", the theme, then date and time (Bangladesh
     time).
   - A "You're {Role}" chip when the user holds a role or a speech. If they
     hold several, show the first and add "+N".
   - A live countdown (DAYS / HRS / MIN / SEC) that ticks every second.
   - Between start and start + 2 h, show "Happening now" instead.
   - A **View agenda** button.
   - Tapping the card opens Meeting detail. Tapping the role chip opens that
     role's tool directly.
   - Empty state: "No meeting on the calendar."
3. **Current pathway card.**
   - Pathway name, "Level N of 5", and a level badge.
   - Current project with its started date.
   - "N speeches left in Level N".
   - **Up next** project with its speech time.
   - Empty state: "Start your pathway" CTA (§10.3).
4. **Your last speech.**
   - Title, then "Meeting #N · date · project".
   - Three status rows:
     - Evaluation (received or "Awaiting evaluation")
     - Timing (Under / Within / Over, or "Not yet timed")
     - Ah-Counter (total fillers, or "Not yet counted")
   - Empty state: "No speeches yet".
5. **This week's lineup.**
   - "10/10 roles assigned for meeting #55".
   - Rows of role → holder avatar and name. The user's own rows are
     highlighted "You".
   - A "Full agenda" link.
6. **Club standing.**
   - Speeches given and roles taken.
   - **Attendance %:** "N of M meetings since joining".
   - **Activity %:** share of attended meetings in which the user spoke or
     took a role.
7. **Club pulse.** Active members, meetings held and upcoming count. Do not
   include the activity feed (deferred).

Not ported:

- The web's "Add to Home Screen" PWA card. It doesn't apply in a native app.
- The deferred Tasks and Dues cards (§0).

Endpoints:

- `GET /meetings`
- `GET /meetings/:id/roles`
- `GET /meetings/:id/prepared-speakers`
- `GET /members/:me`
- `GET /members/:me/stats`
- `GET /members/:me/history`
- `GET /members/:me/evaluations` (or `received-evaluations`)
- `GET /members/:me/timer-entries`
- `GET /members/:me/ah-counter-entries`
- `GET /members` (for counts)

---

## 7. Meetings

### 7.1 Meetings list (P0)

- Segmented control: **Current | Upcoming (n) | Past (n)**.
- How meetings are split:
  - A meeting is **past** once `now ≥ start + 2 h`.
  - **Current** is the earliest meeting that isn't past.
  - **Upcoming** is sorted ascending; **Past** descending (latest first).
- Current shows a "Next up · Tomorrow" (relative) chip and the full date.
- **Meeting card:**
  - Header strip in the club's `bannerColor` (default navy) with "MEETING #55"
    and a status badge: **Draft** (warning colour) or **Published**.
  - Body: THEME label, the theme, date and time, and a **Copy caption**
    action. In the app this becomes **Share caption**, which opens the share
    sheet with the pre-built WhatsApp/Facebook announcement text (§7.11).
- **FAB "+"** (shown when the user has `create meeting`) opens the New meeting
  sheet:
  - **Number:** prefilled as the highest existing number + 1.
  - **Theme:** required.
  - **Date:** native date picker.
  - **Start time:** native time picker; default 19:00.
  - On create: toast "Meeting #N created", then go to its detail.
  - `POST /meetings {meetingNumber, dateTime, theme}`.
- App bar action: **Planner** (§7.12).
- Empty state: "No upcoming meeting" with a "Create new meeting" CTA.

### 7.2 Meeting detail: the hub (P0)

**App bar:**

- The title is "Meeting #55" with a ▾. Tapping it opens the **Switch meeting**
  sheet: a searchable list of all meetings.
- Overflow menu: Share agenda link, Edit details, Delete.

**Status bar** (pinned under the app bar):

| State     | Leading                  | Primary action                 | Overflow sheet                                                                                                        |
| --------- | ------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Draft     | pen icon + "Draft"       | **Publish**                    | "Save as draft" (when there are unsaved edits); **Delete meeting** in red ("Removes the meeting and all its records") |
| Published | check icon + "Published" | **Share link** (public agenda) | "Save as draft" ("Unpublish: only the committee sees it"); Delete                                                     |

- Publishing is `PATCH /meetings/:id {status:"published"}`. It triggers
  WhatsApp messages to everyone on the agenda, server-side.
- Delete asks for confirmation ("Delete meeting #N?") and then pops back to
  the list.

**Card grid** (2 columns). Each card shows an icon inside a **progress ring**
and a label. The ring shows a ratio, or a bare track when completion doesn't
apply.

| Card              | How the ring is computed                           |
| ----------------- | -------------------------------------------------- |
| Overview          | Mean of the Theme, Roles and Speakers ratios       |
| Roles             | Required roles filled ÷ 9 (Harkmaster is optional) |
| Prepared Speakers | min(speakers, 4) ÷ 4                               |
| Theme             | Filled share of (theme, word, meaning)             |
| Table Topics      | asked ÷ total                                      |
| Timer             | Bare ring (a live tool)                            |
| Ah Counter        | Bare ring (a live tool)                            |
| Grammarian        | Bare ring (a live tool)                            |
| Attendance        | present ÷ roster size                              |
| Voting            | Bare ring (a live tool)                            |
| ~~Checklist~~     | Deferred (§0)                                      |

- Tapping a card **pushes a full page**. It is not a drawer, so the system
  back gesture works.
- Remember the last opened card per meeting, so returning restores it.
- Live-tool pages (Timer, Ah-Counter, Grammarian) have a **Share role** action
  in the app bar. It opens a sheet with a QR code, the role link and the
  native share sheet, so the role holder can run the tool on their own phone
  without an account (§7.13).

### 7.3 Overview (P0)

**At a glance:**

- No. / Date / Time, with **Edit** (a sheet for number, date and time; toast
  "Meeting details updated").
- **Meeting readiness** checklist:
  - ✓ Roles assigned
  - ✓ Theme & word of the day
  - ✓ Speakers booked (4)
  - ✓ Speech details filled
  - When everything passes: "Everything is set — this agenda is ready to
    publish."
- Who (the key roles), the speech lineup, and the word of the day.

**Agenda preview:** a read-only rendering of the printed agenda (§7.14).
Actions: Share / Print PDF.

### 7.4 Roles (P0)

There are 10 role slots, in this order:

| Key                     | Label                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `president`             | President                                                                                                                                 |
| `sergeant-at-arms`      | Sergeant at Arms                                                                                                                          |
| `toastmaster`           | **Toast Master of the Day** (TMOD) or **of the Evening** (TMOE) when the start is ≥ 17:00 Bangladesh time                                 |
| `general-evaluator`     | General Evaluator                                                                                                                         |
| `table-topic-master`    | Table Topic Master                                                                                                                        |
| `table-topic-evaluator` | Table Topic Evaluator                                                                                                                     |
| `ah-counter`            | Ah Counter                                                                                                                                |
| `timer`                 | Timer                                                                                                                                     |
| `grammarian`            | Grammarian                                                                                                                                |
| `harkmaster`            | Harkmaster (**optional**; info sheet: "listens to the whole meeting and asks questions at the end to find who listened most attentively") |

- Each row shows the role label, then the holder's avatar and name or
  "+ Assign".
- Tapping opens the **Assignee picker**, a full-height searchable sheet:
  - Sections **Members** and **Guests** (pipeline guests are marked
    "(Guest)").
  - "Unassign".
- `PUT /meetings/:id/roles/:roleKey {membershipId | guestId | null}`.
- Saves optimistically. Assigning or removing a member triggers a WhatsApp
  message, server-side.

### 7.5 Prepared speakers (P0)

- Ordered list of speaker cards. Up to 4 prepared speakers is the target; add
  **Keynote** separately.
- **Card:**
  - Order number.
  - Kind badge ("Keynote").
  - Title (or "Untitled speech").
  - Speaker.
  - Pathway · "L{level} · {project}".
  - Duration (min).
  - Evaluator.
  - Status chip: **Requested → Confirmed → Delivered**.
- **Reorder:** drag handle (long-press to drag). The web uses up/down arrows.
  `POST …/prepared-speakers/reorder`.
- **Edit sheet** (a pushed page):

  | Field        | Notes                                                                                                                  |
  | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
  | Speaker      | Member or guest picker                                                                                                 |
  | Speech title | e.g. "The fear of becoming yourself"                                                                                   |
  | Path         | Pathway picker; label "Dynamic Leadership (DL)"                                                                        |
  | Project      | Filtered by pathway; label "L1 · Ice Breaker"                                                                          |
  | Duration     | Minutes. **Set by project**: prefilled from the project's speech time                                                  |
  | Evaluator    | Member or guest. Hidden for keynotes: "A keynote is not evaluated — just set who is speaking, the title and the time." |
  | Notes        | Optional                                                                                                               |
  | Status       | Segmented control                                                                                                      |

  Confirming a speech sends a WhatsApp message to the speaker.

- **Per-speaker actions:**
  - **Show evaluation QR:** full-screen QR plus share, for the evaluator form
    at `/meetings/:id/evaluate/:speakerId?t=`. Toast "Evaluation link copied".
  - Delete.
- Endpoints:
  - `GET /meetings/:id/prepared-speakers`
  - `POST /meetings/:id/prepared-speakers`
  - `PATCH /meetings/:id/prepared-speakers/:sid`
  - `DELETE /meetings/:id/prepared-speakers/:sid`
  - `POST /meetings/:id/prepared-speakers/reorder`

### 7.6 Timer, live tool (P0, flagship mobile experience)

**List page:**

- Speakers, each with a type chip, a status (`idle`, `running`, `done`) and
  their elapsed time.
- A FAB "+" opens a sheet with two options:
  - **Take from agenda:** picks from roles and speakers. A prepared speaker's
    brackets come from their project's time range.
  - **Add speaker:** a name typed in or chosen from the search, plus a
    **Speaker type**.

**Speaker types and default brackets (green / yellow / red):**

| Type              | Green | Yellow | Red   |
| ----------------- | ----- | ------ | ----- |
| Prepared Speaker  | 5:00  | 6:00   | 7:00  |
| Keynote           | 15:00 | 18:00  | 20:00 |
| Ice Breaker       | 4:00  | 5:00   | 6:00  |
| Table Topic       | 1:00  | 1:30   | 2:00  |
| Speech Evaluator  | 2:00  | 2:30   | 3:00  |
| TT Evaluator      | 2:00  | 2:30   | 3:00  |
| General Evaluator | 5:00  | 6:00   | 7:00  |

A prepared speaker taken from the agenda uses their own project range: green
= min, red = max, yellow = the midpoint.

**Running view** (full screen; tap a speaker to open it):

- Huge `m:ss` digits and the speaker's name.
- **The whole screen background changes colour** as each threshold passes:
  default → green → yellow → red. This doubles as the light card held up to
  the speaker. Use a medium haptic and an optional sound at each change.
- Controls: **Start / Stop / Reset**, plus Save. Overflow: Rename, Delete.
- Keep the screen awake (`wakelock_plus`).
- **Landscape is allowed on this screen only**, for showing it to the room.
- The timer keeps running when the app is backgrounded: store `startedAt` and
  derive elapsed time from it.

**Sync:**

- State is one JSON blob per meeting and tool.
- `GET/PUT /meetings/:id/role-state/timer`, or the public variant
  `/public/meetings/:id/role-state/timer?t=` when opened from a role link.
- Poll every **5 s** and reconcile, so another device (e.g. the TMOD's) sees
  the same state.
- Results become the speaker's timer report (Under / Within / Over) in their
  history.

### 7.7 Ah-Counter, live tool (P0)

- Default filler words: **AH, UM, ERR, THE**. They are editable: add or remove
  words. Removing one hides its column but keeps the counts already tallied.
- Add speakers with "Take from agenda" or "Add speaker"; a name can be typed in
  for guests.
- **Counting view, mobile:**
  - One speaker at a time.
  - A big **tap tile per filler word**. Tap = +1 with a light haptic.
    Long-press or a "−" button = −1.
  - Per-word counts and the total are shown.
  - Swipe left or right to move between speakers.
- The list shows each speaker's total and expands to per-word counts.
- Sync: `role-state/ah-counter`, polled every 5 s.
- Feeds the speaker's "Ah-Counter report".

### 7.8 Grammarian, live tool (P0)

- **Word of the Day usage:** the WOTD is shown at the top. Add a person (from
  the search or typed in) and tap + each time they use the word.
- **Grammarian log:**
  - Quick-add with two fields: "What was said" → "What it should be".
  - Each entry is timestamped and the newest is shown first.
  - Swipe to delete.
- Sync: `role-state/grammarian`.

### 7.9 Theme & Word of the Day (P0)

| Field            | Notes                                    |
| ---------------- | ---------------------------------------- |
| Theme of the day | Required                                 |
| Word of the day  |                                          |
| Part of speech   | Select: noun, verb, adjective, adverb, … |
| Meaning          |                                          |
| Example sentence |                                          |

- **Save** → `PATCH /meetings/:id {theme, word:{word, partOfSpeech, meaning,
example}}`.
- Validation: "Give the meeting a theme before saving."
- Success toast: "Theme and word of the day saved".

### 7.10 Table topics (P1)

- Up to **10** questions, each **400 characters** at most (new lines allowed).
- Each row has an **Asked** toggle; asked questions are dimmed. Edit and
  delete via swipe or the overflow menu.
- During the meeting, the TTM can tap a question to show it full screen, in
  large type, to read out.
- Endpoints:
  - `GET /meetings/:id/table-topics`
  - `POST /meetings/:id/table-topics`
  - `PATCH /meetings/:id/table-topics/:qid {text, asked}`
  - `DELETE /meetings/:id/table-topics/:qid`

### 7.11 Attendance (P1)

- Helper text: "Check off each member as they arrive."
- **Members:** a roster list with large checkboxes or switches.
  `PUT /meetings/:id/attendance/members/:membershipId {present}`.
- **Guests:**
  - Add from the guest pipeline: search sheet → `POST …/attendance/guests
{guestId}`.
  - Toggle present or remove.
  - Guest names are capped at 80 characters.
  - Empty pipeline: "No guests in the pipeline yet", linking to People.
- Header actions: **Mark all** and **Clear**
  (`PUT /meetings/:id/attendance/mark-all`).
- Attendance automatically writes guest **visit logs**, server-side.

### 7.12 Voting (P1)

Ballot categories:

| Category                  | Notes                                                        |
| ------------------------- | ------------------------------------------------------------ |
| Best Prepared Speaker     |                                                              |
| Best Speech Evaluator     |                                                              |
| Best Table Topics Speaker | **auto**: candidates added by the officer during the meeting |
| Best Role Taker           |                                                              |

Officer view, with two segments:

1. **Contestants.**
   - Per category, a candidate list.
   - **Sync from meeting data** (`POST …/vote/candidates/sync`) prefills it
     from roles and speakers.
   - Add a person (member, guest or free text); remove a candidate.
   - `PUT …/vote/candidates/:category`.
2. **Results.**
   - Per category, bars with vote counts and the total number of ballots.
   - Pull to refresh.
   - **Clear** one category: "Every pick in this category is wiped.
     Candidates stay on the ballot."
   - `DELETE …/vote/results/:category`.

Voting link:

- Full-screen QR, **Share**, and **Copy voting link**.
- The link is `/meetings/:id/vote?t=`.
- The audience votes on the **web** ballot: anonymous, one pick per question,
  and they can change their vote. When a signed-in member opens the link, the
  app shows a native ballot that uses the same public endpoints
  (`GET/POST /public/meetings/:id/vote`) and a device-stable `voterKey`.

### 7.13 Shared role links (P1)

- Timer, Ah-Counter and Grammarian each have a public link
  `/meetings/:id/roles/:role?t=`.
- Opening it in the app (or on the web) shows a **Confirm who you are** gate:
  - "Are you {assigned holder}?" → **Yes, that's me** / **No, I'm someone
    else** → "What's your name?"
  - Then the live tool runs against the public role-state endpoint.
  - Remember the identity per meeting and role on the device, with a
    "Not you?" option to switch.

### 7.14 Agenda (read view) (P0)

The members' and public agenda, rendered natively. It is also the deep-link
target for `/meetings/:id/agenda`.

- Club banner (colour, or the custom image positioned as the admin set it).
- "Meeting #N · date", the theme, and the club name.
- **Meet the Mentors:** key role holders.
- Other Roles.
- **Word of the Day:** word, part of speech, meaning, example.
- **Agenda Timeline:** ordered segments with the speaker, title, project and
  duration, plus the evaluator. Keynotes are prefixed and have no evaluator.
- Table topics (asked ones dimmed).
- Footer actions: **Contact Club** (call or WhatsApp) and **View Location**
  (maps link).
- Share as **PDF** (render the agenda with the banner).
- When the meeting isn't published, show "This agenda isn't available. It may
  not be published yet."
- Endpoint: `GET /public/meetings/:id/agenda` (no auth). The in-club view can
  compose it from the authenticated endpoints instead.

### 7.15 Caption builder (P0, a utility)

The share text for an announcement post. Port `buildMeetingCaption` exactly:

```
📢 55th General Meeting | {Club} 🎙️

Dear Fellow Toastmasters & Guests,
You're warmly invited to our upcoming regular meeting with the theme:
💬 "{theme}"

✨ Role Players:
🎯 General Evaluator — …
💡 Table Topics Master — …
🎤 Toastmaster of the Day|Evening — …

📅 Date: 16 October 2026
🕖 Time: 10:30 AM
📍 Venue: …
🗺️ Map: …

Come join us for an evening of learning, speaking, networking, and growth! 🌟
```

Lines with no value are omitted.

### 7.16 Planner (P1)

Lets the VPE draft a whole term.

**Lens filter chips** (horizontal scroll): All roles · TMOD · Table Topics ·
Speakers · Evaluators · Gen. Evaluator · Timer · Ah-counter · Grammarian ·
Harkmaster.

**Content:** month-grouped **cards**, one per planned meeting:

- Meeting #, date and time, theme, and an **Open** link if it already exists
  as a meeting (shaded green).
- Slots: TMOD, TTM, TT Evaluator, Speaker 1–4, Evaluator 1–4, General
  Evaluator, Timer, Ah-counter, Grammarian, Harkmaster.
- Tapping a slot opens the assignee picker.
- Undated rows show "Planned meeting · No date set".

**Card actions:** Edit details (number, date and time, theme, notes), Delete
row, **Create meeting**.

**Create meeting** opens a confirm sheet that groups the slots (Hosting /
Table Topics / Prepared speakers / Support team), with Meeting no., Date,
Start time and Theme editable. The result: "Meeting #N created as a draft",
with roles and speakers prefilled.

**FAB:** Add meeting row.

Endpoints:

- `GET/POST /planner-rows`
- `PATCH/DELETE /planner-rows/:id`
- Planner ideas: `GET/POST /planner/ideas` (P2)

---

## 8. People

The tab has a top segment: **Guests | Members**. Show only the segments the
user is allowed to read.

### 8.1 Guests pipeline (P0 for VPM)

**Stages:** New · Contacted · Interested · Joined Meeting(s) · Joined Club ·
Not Interested, with the colours from §4.1.

**Mobile layout** (replaces the web's 6-column kanban):

- A horizontal **stage chip bar** with counts ("New 9", "Contacted 1", …),
  plus "All".
- A list of the guests in the selected stage.
- A search field for name, email or "invited by".

**Guest row:**

- Avatar (photo or initials).
- Name.
- Visits ("2 visits · 2 Oct" or "No visits yet").
- "Invited by …".
- A trailing stage pill.

**Interactions:**

- **Move stage:** swipe right, or long-press and pick a stage in a bottom
  sheet. `PATCH /guests/:id {stage}`.
- **Swipe left:** Call / WhatsApp.

**FAB "Add guest"** opens a sheet with two options:

1. **Add manually**, phone first. Enter the 11-digit number →
   `GET /guests/lookup?phone=`. Outcomes:
   - Already a member of this club → "no need to add them as a guest"
     (blocked).
   - Has an account → "Has an account · Open profile".
   - Known to another club (the shared contact pool) → prefill their details.
   - Not on file → empty form.

   Form fields:

   | Field           | Notes                          |
   | --------------- | ------------------------------ |
   | Full name       |                                |
   | Email           |                                |
   | WhatsApp number | "Leave blank if same as phone" |
   | Invited by      |                                |

   `POST /guests`. Toast "{name} added to the guest list".

2. **Send invitation link.**
   - Shows the club's guest sign-up link and QR (`GET /guests/invite-link`).
   - Actions: Share, Copy.
   - **Regenerate**, with a confirm: "Every copy of the current link and QR
     stops working immediately." → `POST /guests/invite-link/rotate`.

### 8.2 Guest profile (P0 for VPM)

- **Header:**
  - Avatar and name.
  - Stage pill.
  - "Shared contact" badge (linked to the cross-club contact pool; details
    sync across clubs).
  - Visit summary.
- **Quick actions row:** **Call**, **WhatsApp** (`wa.me/88…`), **Email**.
- **Information:** phone, WhatsApp, email, socials, organisation, bio, and
  **Notes** marked **Club-only** ("Private — visible to club officers only").
- **Actions:**
  - **Move stage** (sheet). The sheet also offers **Convert to member**:
    "Creates their member record — needs an email on file". The flow is
    `POST /guests/:id/convert-to-member` with optional roles (default
    Member). Toast "{first} {last} joined as a member — they can log in now".
  - **Edit** (pushed form):

    | Field                                      | Notes                      |
    | ------------------------------------------ | -------------------------- |
    | Avatar                                     | Camera or gallery upload   |
    | Full name                                  |                            |
    | Email                                      |                            |
    | Phone                                      |                            |
    | "WhatsApp is the same as the phone number" | Toggle                     |
    | WhatsApp number                            |                            |
    | Socials                                    | Platform + URL; repeatable |
    | Organization / profession                  |                            |
    | Invited by                                 |                            |
    | Bio                                        | ≤ 600 characters           |
    | Notes                                      | ≤ 1000 characters          |

    Buttons: Discard / Save details.

  - **Delete**, with a confirm.
- **Activity:**
  - **Visit logs** (pushed page): "Meetings {name} has attended — newest
    first."
    - Entries are **Auto** (from meeting agendas or attendance) or **Manual**.
    - Each entry: meeting, role, notes. Edited entries are marked "Edited".
    - Add, edit and delete are available.
    - `GET/POST/PATCH/DELETE /guests/:id/visit-logs`.
  - **Contact logs** (pushed page):
    - Fields: method (Call · Message · Email · In person · Other), "What
      happened next?", and a date.
    - `…/contact-logs`.

### 8.3 Members (engagement) (P1)

- "How the roster is doing — recent speeches and who might need a nudge."
- **Member row:**
  - Avatar and name.
  - Role chips.
  - Speeches given and the last speech.
  - A **Health** badge: **Healthy** or **At risk**.
- **At-risk rule** (port exactly):
  - A member is at risk after sitting through _T_ consecutive **speaking
    meetings** (held meetings with ≥ 1 speech) without giving a speech.
    Count from their last speech, or from the day they joined.
  - _T_ = max(6, ⌈active members ÷ average speeches per speaking meeting⌉),
    i.e. one full fair turn.
  - If the club has no delivered speeches yet, everyone is healthy.
  - Attendance is ignored.
- Sort with at-risk members first, then filter.
- Header action: **Invite member** (§12.2), for users with `create invite`.
- **Member engagement profile:**
  - Speeches given, with the last title.
  - Attendance %: "N of M meetings since joining".
  - Current project: pathway · level, or "Between projects", "Not started" or
    "No pathway chosen yet".
  - Activity %: "N speech or role turns across M attended".

Endpoints: `GET /members`, `GET /members/:id`, `GET /members/:id/stats`.

---

## 9. Cross-cutting requirements

### 9.1 Time and locale

- All display uses **Bangladesh time, UTC+6, no daylight saving**, regardless
  of the device timezone. Use a fixed offset or `timezone` with `Asia/Dhaka`.
- Formats:

  | Use                | Example                                                        |
  | ------------------ | -------------------------------------------------------------- |
  | Meeting            | "Fri, 16 Oct 2026 · 10:30 AM" (12-hour clock, uppercase AM/PM) |
  | Long               | "Friday, 16 October 2026"                                      |
  | Short date         | "14 Oct 2026"                                                  |
  | Month group header | "SEPTEMBER 2026"                                               |

- History dates are Bangladesh calendar dates (`YYYY-MM-DD` strings). Compare
  them as strings and never shift them by timezone.
- Countdown: "in 2d 3h 15m" in lists; the second-by-second tiles in the Home
  hero.
- Money: integer minor units; display as `৳1,200.00`.
- Phone: validate `^01\d{9}$`. Display it as typed. Use `+88` for WhatsApp
  deep links.

### 9.2 Notifications

- **Today:** server-side WhatsApp messages are sent when a meeting is first
  published, when someone is added to or removed from a role, and when a
  speech is confirmed. The app needs no work for these.
- **v1 app (P1): native push via FCM / APNs.** The web already has
  `POST /push/subscribe` and `/push/unsubscribe` (Web Push).
  - Backend work needed: device-token registration (§13).
  - Events: the same three as WhatsApp, plus "meeting starts in 1 hour" for
    role holders, and "speech slot request answered".
  - Tapping a notification deep-links to the meeting or role.
  - Me → Notifications: per-event toggles. The web currently shows "Coming
    soon — not yet enabled for this club."

### 9.3 Media

| Need                   | Where                                                               | Package                                |
| ---------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| Avatar                 | Profile, guest                                                      | `image_picker` + crop (square)         |
| Club banner image      | Club profile; drag to position + zoom                               | `image_picker` + custom pan/zoom frame |
| Evaluation photos      | Evaluate form; multiple images, size cap                            | `image_picker`                         |
| Evaluation audio       | Record a voice memo with a duration cap, or upload `.m4a/.mp3/.wav` | `record`, `file_picker`                |
| QR display             | Voting, evaluation, roles, guest invite                             | `qr_flutter`                           |
| QR scan (optional, P2) | Scan another officer's role link                                    | `mobile_scanner`                       |

Uploads go through presigned URLs (`…/evaluations/sign`), then submit.

### 9.4 Data and offline

- State management: Riverpod (recommended), or Bloc if the team prefers it.
  - HTTP: Dio with an interceptor for auth, context and refresh.
  - Models: freezed + json_serializable.
  - Navigation: go_router with `StatefulShellRoute` for the tabs.
- **Caching:** stale-while-revalidate with a 30 s stale time.
  - Persist the last session plus Home, Meetings and the current meeting
    detail (Hive/Isar or drift), so the agenda opens in a dead-signal meeting
    room.
  - Show "Offline · showing saved data".
- Retry policy: never retry 4xx; retry 5xx and network errors twice with
  backoff.
- Live tools (Timer, Ah-Counter, Grammarian) must keep working offline: queue
  the last state blob and PUT it on reconnect, last write wins (§7.6).

### 9.5 Accessibility

- Dynamic type up to 200% without clipping. The timer digits scale with the
  screen, not the font setting.
- Semantic labels on every icon-only button, and on progress rings ("Roles 9
  of 9").
- Colour is never the only signal: Timer states also show a label ("GREEN"),
  and stages show text.
- Contrast ≥ 4.5:1 in both themes.

### 9.6 Analytics and quality (P1)

- Crashlytics or Sentry.
- Product events: `login`, `meeting_published`, `role_assigned`,
  `timer_started`, `vote_link_shared`, `guest_added`, `guest_stage_changed`,
  `speech_slot_requested`.
- Performance targets:
  - Cold start ≤ 2 s to Home skeleton on a mid-range Android.
  - 60 fps scrolling.
  - Timer drift < 100 ms over 10 minutes.

### 9.7 Platforms

- iOS 15+ and Android 8 (API 26)+.
- Portrait only, except the Timer running view (§7.6).
- Phone first; tablets get a centred max-width of 720.

---

## 10. Learn (Education)

### 10.1 Members roster (P1)

- Searchable by name, role or pathway.
- **Row:**
  - Avatar and name.
  - Role chips ("Member, VPE").
  - **Level** badge (1–5, or "—").
  - Pathway name, or "Not started".
- Tapping a row opens the Member pathway.

### 10.2 Member pathway (P1)

- **Header:** name, roles, pathway · level. **Edit** shows when the user can
  update this member's education: VPE, President, Admin, or the member
  themself (`own` scope).
- **Segment Progress | History.**

**Progress:**

- Current pathway: "Level 1 of 5 — 4 levels to go".
- Current project with its started date, or "No active project".
- Latest speech.
- Stat tiles: Speeches given, Meetings attended, Projects completed, Meeting
  roles, Current level, Member since.

**History:**

- A timeline grouped by month (newest first).
- Event types:

  | Event             | Text                                         |
  | ----------------- | -------------------------------------------- |
  | Speech given      | "Delivered at Meeting #N for the X project." |
  | Project started   |                                              |
  | Project completed |                                              |
  | Level reached     |                                              |
  | Meeting role      | "Served as … at …"                           |
  | Joined the club   | "The journey begins here."                   |

**Update Pathway sheet:** "Change {name}'s pathway, level, or current
project. Past history stays put."

| Field           | Notes                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pathway         | Required                                                                                                                                                                       |
| Current project | Required, filtered by pathway, label "{project} · Level N". Helper: "Members migrating in mid-pathway can pick their real starting project — the level adjusts automatically." |
| Starting level  | Read-only, auto-selected                                                                                                                                                       |

`POST /members/:id/pathway`.

### 10.3 Pathways catalog (P1)

- Bundle `docs/pathway.json` as an app asset; it is static.
  - **11 pathways**, each with 5 levels:
    1. Mastering Fundamentals
    2. Learning Your Style
    3. Increasing Knowledge
    4. Building Skills
    5. Demonstrating Expertise
  - About 13 required projects per pathway, each with a speech time (e.g.
    "4–6 minutes"), plus 26–29 electives.
- **List card:** name, description, "5 levels · 13 required projects · 29
  electives". Search covers pathways, projects and electives.
- **Detail:** levels in an accordion → projects with their speech times.
  Actions: "Look this project up" (opens the web) and "Download evaluation
  form" (PDF).

---

## 11. Me

### 11.1 Me hub (P0)

- **Hero:**
  - Avatar and name.
  - "Member, Treasurer · Pursuing Dynamic Leadership, Level 1".
  - "Member since April 2026 · N meetings attended".
- Primary buttons: **Request speech slot** and **Pathway detail**.
- **Cards:**
  - Current pathway (same as Home).
  - **My speeches** feed (§11.3).
  - Club standing.
  - Speech slot requests (§11.2).
  - My history.
- **Settings group:** Edit profile · Change password · Notifications · Switch
  context · Manage club (if permitted) · Help · Sign out · Delete account.

### 11.2 Request a speech slot (P0)

Sheet fields:

| Field           | Notes                                                   |
| --------------- | ------------------------------------------------------- |
| Meeting         | Required; upcoming meetings only                        |
| Project         | Optional, ≤ 120 characters, e.g. "Reflect on Your Path" |
| Note to the VPE | Optional                                                |

- **Send to VPE** → `POST /members/:me/speech-slot-requests`. Toast "Request
  sent to the VPE".
- The requests list shows status chips ("New", …). Empty state: "No requests
  yet — ask the VPE for your next slot whenever you're ready."

### 11.3 My speeches (P0)

- A feed of every speech: title, "Meeting #N · date · project".
- Each speech has:
  - **Evaluation:** "Awaiting evaluation", or the received submissions.
    Received ones show "Assigned" or "Peer feedback" plus count badges. Open
    them to read the text, view the images or play the audio.
  - **Timer report:** "Under / Within / Over time" with the actual `m:ss`
    against the target range.
  - **Ah-Counter report:** total fillers and the breakdown per word.
- Endpoints:
  - `GET /members/:me/received-evaluations`
  - `GET /members/:me/timer-entries`
  - `GET /members/:me/ah-counter-entries`

### 11.4 My history (P1)

- "Everywhere your number has been — every club, every meeting, including
  visits from before you joined."
- `GET /profile/history`.
- Empty state: "No history yet — once a club records your number at a
  meeting, it shows up here."

### 11.5 Edit profile and password (P0)

**Profile:**

| Field        | Notes                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| Photo        | Change / Remove                                                              |
| Full name    |                                                                              |
| Email        |                                                                              |
| Phone        |                                                                              |
| Bio          | ≤ 1000 characters                                                            |
| Social links | Platforms: LinkedIn, Facebook, Instagram, YouTube, X, TikTok, Website, Other |

- Changing the email or phone requires the **current password**.
- A read-only "Current pathway" row: "Managed from the Education tab."
- `GET/PATCH /profile`.

**Change password:**

| Field                | Validation     |
| -------------------- | -------------- |
| Current password     | Required       |
| New password         | ≥ 8 characters |
| Confirm new password | Must match     |

- `PATCH /auth/password`.
- When reached because `mustChangePassword` is set, show the banner "You're
  using a temporary password" and a **Skip for now** option.

### 11.6 Delete account (P0, required by the stores)

- Lists what gets removed and what the club keeps. Deleting does **not**
  remove the user from the club roster.
- Warns ahead of time if the user is a Club Admin.
- Requires the password. `DELETE /profile {currentPassword}`.
- Handles these errors:
  - `LAST_CLUB_ADMIN`: name the clubs, and say to promote another admin
    first.
  - `LAST_SUPER_ADMIN`.

---

## 12. Manage club (Club Admin) (P1)

These screens are reached from Me → Manage club.

### 12.1 Overview

- **Club join code card:** the code in large monospace, with Copy and Share.
  "Share this with someone directly — they paste it in to join as a Member
  instantly."
- **Stat tiles:**
  - Active members.
  - Officers ("holding a role beyond plain Member").
  - Pending invites.
  - Outstanding dues: hide this while Finance is deferred.
- **Navigation rows:** Members (count) · Permissions · Club profile. Audit
  Trail is deferred.
- **Next meeting** row.

### 12.2 Members

- Segment **Active | Removed**. Searchable.
- **Row:** avatar, name, "Admin" badge, role chips, and "Not joined yet" when
  the roster row has no account.
- **Row actions** (action sheet): Edit member · Make Club Admin / Remove admin
  · Invite (personal join link) · Remove member. Removed members get **Restore
  member**.
- **FAB** opens a menu:
  - **Single member:** full name, phone (optional, with the helper "when they
    sign up with this number, this roster row links automatically") and roles
    (multi-select).
  - **Bulk members:**
    - Editable rows of name / phone / roles.
    - Paste a list from the clipboard to auto-fill rows.
    - The result reports partial success: "Added N, skipped M — see the
      highlighted rows".
    - `POST /members/bulk`.
  - **Add from guests:** pick a guest, optional roles. Uses the
    convert-to-member flow.
  - **Invite member:**
    - A name (for tracking only) and role(s) (default Member).
    - Generate link → share sheet.
    - Pending invites are listed with Copy and Revoke.
- Endpoints:
  - `POST /members`
  - `PATCH /members/:id`
  - `POST /members/:id/status`
  - `POST /members/:id/admin`
  - `GET/POST /invites`
  - `DELETE /invites/:id`

### 12.3 Permissions

- Pick a member in a searchable sheet. The screen then shows a grouped list,
  one section per resource, with four switches each: Create / Read / Update /
  Delete.
- Each switch shows its effective value (from the role grants) and marks
  overrides ("allowed by override" / "denied by override").
- "Changes apply immediately and are enforced across the app."
- A **Reset** action clears this member's overrides.
- `PATCH /members/:id/permissions`.

### 12.4 Club profile

| Field                 | Limit / format   |
| --------------------- | ---------------- |
| Club name             |                  |
| Club number           |                  |
| Motto                 | ≤ 300 characters |
| Venue address         | ≤ 500 characters |
| Google Maps link      |                  |
| Contact phone         |                  |
| Official social links | Platform + URL   |

- **Agenda banner:** a colour picker (including "Transparent"), or a custom
  image with pan and zoom positioning. An image takes priority over the
  colour.
- Read-only organisation path, e.g. "Area 3 · Division F · District 41".
- `GET/PATCH /clubs/mine`.

---

## 13. Org tree and platform admin (P2)

**Recommendation:** keep these on the web for v1. They are low-frequency desk
work. Build them in the app in P2 using the same list → detail → sheet
patterns.

- **Director (Area / Division / District):** drill through units → clubs.
  - Rename the unit; update clubs in scope.
  - Read-only club dashboards.
- **Super Admin, Org tree:**
  - Districts (name + code, e.g. "District 88" / "D88") → Divisions → Areas →
    Clubs (name, number, status).
  - Create, rename, **move** (to another parent) and delete. Deleting a unit
    deletes everything under it, so it needs a strong confirm.
  - Endpoints: `/districts`, `/divisions`, `/areas`, `/org-clubs`.
- **Super Admin, Users:**
  - Search by phone, email or name; paginated.
  - Row: name, phone · email · N memberships · joined date.
  - User detail tabs:
    - **Profile:** name, email, phone, TI member number (≤ 40 characters).
    - **Account:** suspend / reactivate, toggle super admin.
    - **Password reset:** generate a new password, show it once, copy it. All
      sessions are signed out.
    - **Club memberships:** add to club, edit roles and member type, remove or
      reactivate.
    - **Director roles:** assign district, division or area.
  - **Create user:** name, email, phone, TI number, password (generate), and
    optionally place them in a club with roles. Shows the credentials once,
    with a direct link and "Copy credentials".
  - Bulk delete, with a strong confirm.
- **Super Admin, WhatsApp:**
  - Status: Not set up / Worker offline / Not connected / Connecting /
    Waiting for scan / Connected (number, linked name).
  - Connect shows a QR code, refreshing every few seconds, with
    instructions: "Open WhatsApp on the club's phone → Settings → Linked
    devices".
  - Disconnect, with a confirm.
  - Send a test message to a number.

**Backend additions needed for the app:**

1. **Device push tokens:** `POST /devices {platform, token}` and
   `DELETE /devices/:token`, plus an FCM sender in the existing notify
   pipeline next to WhatsApp.
2. _(Optional)_ `GET /auth/session` returns precomputed `permissions`, as a
   fallback if the Dart port of `@toastly/access` lags behind.
3. Universal Links / App Links files (`apple-app-site-association`,
   `assetlinks.json`) served from the web host.
4. Confirm `POST /auth/refresh` returns rotated tokens. The Expo app already
   relies on this.

---

## 14. Open questions

1. **Brand:** monochrome ink (web) or blue accent (Expo)? This document
   recommends ink + navy + mint (§4.1).
2. **Meeting checklist card:** it is part of the deferred "Inventory &
   checklist" module. Confirm it should be hidden in v1.
3. **Dashboard dues card and Club Admin "Outstanding dues":** hide them while
   Finance is deferred, or show them read-only?
4. **Org and super admin in the app (§13):** web-only for v1?
5. **Native ballot and evaluation form for signed-in members** (§7.12, §7.13):
   in scope for v1, or always hand off to the web?
6. **Push notifications:** v1 or v1.1? They depend on the backend work in
   §13.

---

## 15. Release plan

| Release                           | Contents                                                                                                                                                                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1, Member app (P0)**           | Auth, register, join club, invite accept · Home · Meetings list, detail hub, Roles, Speakers, Theme, Agenda, caption · **Timer, Ah-Counter, Grammarian** · Guests pipeline + guest profile + logs · Me hub, speech slot request, my speeches, profile, password, delete account · context switcher · deep links |
| **R2, Officer completeness (P1)** | Table topics · Attendance · Voting (officer side + native ballot) · shared role links · Planner · Members engagement · Learn (roster, member pathway, catalog) · Manage club · push notifications                                                                                                               |
| **R3 (P2)**                       | Org tree + super admin · QR scanner · planner ideas · the deferred modules (Library, Inventory & checklist, Tasks, Finance, Records, Activity log)                                                                                                                                                              |

### Acceptance criteria (R1 highlights)

- [ ] A member with a role sees "You're {Role}" on Home within 2 s of a cold
      start, and one tap opens that role's tool.
- [ ] Timer: the background turns green, yellow and red at the configured
      thresholds within ±100 ms. The timer survives backgrounding and screen lock.
      A second device sees the state within 6 s.
- [ ] Ah-Counter: one tap = +1 with haptic feedback. A count is never lost
      when switching speakers or going offline and back online.
- [ ] Publishing a draft changes the badge and the primary action to Share
      link; the agenda deep link opens the native agenda.
- [ ] A user without `create meeting` sees no FAB. A user without `read guest`
      sees no Guests segment. Deep-linking into a forbidden screen shows "Access
      restricted", not a crash.
- [ ] All times render in Bangladesh time when the device timezone is set to
      London, New York or Tokyo.
- [ ] Switching club context never shows the previous club's cached data.
- [ ] Two concurrent 401s trigger exactly one refresh call.
