# Number-First Identity — Plan

> Status: draft for review. Scope: make the phone number the single source of
> identity and truth across guests, members, and registered users.

## 1. Problem

A human being exists in the system today as **three disconnected things**:

| Where          | Entity       | Keyed by                                       | Knows about accounts?      | Shared across clubs? |
| -------------- | ------------ | ---------------------------------------------- | -------------------------- | -------------------- |
| Roster         | `Membership` | `(clubId, userId)`, claim key `phone`          | ✅ claimed at registration | ❌ (by design)       |
| Guest pipeline | `Prospect`   | `(clubId, id)`, dedupe on `phone` **per club** | ❌                         | ❌                   |
| Account        | `User`       | unique `phone`                                 | —                          | —                    |

Consequences:

- Club Y adding `01568286512` as a guest re-typed everything Club X already
  knew (name, email, bio…). Two copies drift apart immediately.
- A guest with a rich history (visits, roles, speeches) who later registers an
  account gets **nothing** — the claim flow only touches `Membership`.
- There is no answer to "who is this number?" without picking which silo to ask.

## 2. Vision (unchanged from product owner's)

1. **Phone number is the identity.** Not the account, not the roster row.
2. **Adding a number anywhere pulls in everything the system knows** — name,
   email, bio, club affiliations, prior visits to _your_ club — and stays
   **live**: change it at the source, every subscriber sees the change.
3. **Data accrues to a number before any account exists**, and the moment an
   account is created under that number, everything attaches — continuously,
   no migration wizard, no breakage.
4. **The guest pool is global.** One shared contact per number; every club
   adding the same number sees and enriches the same person.
5. Simplicity over strictness: no distributed-lock heroics for racing edits.

## 3. Core design: one global `Person` per phone number

Introduce a single new entity that owns **shared identity fields**, keyed by
the normalised 11-digit phone:

```prisma
model Person {
  id           String   @id @default(cuid())
  /// THE identity. Normalised by `normalizePhone()` on every write.
  phone        String   @unique
  firstName    String
  lastName     String
  email        String?
  bio          String?  @db.Text
  avatarUrl    String?  @db.Text
  whatsapp     String?
  organization String?
  socials      Json     @default("[]")
  /// Set when an account registers with this phone. Null = "unclaimed
  /// number" — still a fully functional contact everywhere.
  userId       String?  @unique
  /// Provenance for the simple merge policy — see §5.
  claimedAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user        User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  prospects   Prospect[]
  memberships Membership[]
}
```

Then add **one nullable link each** (no data moves, ever):

```prisma
model Prospect   { ... personId String?  person Person? @relation(...) @@index([personId]) }
model Membership { ... personId String?  person Person? @relation(...) @@index([personId]) }
model User       { ... person    Person? }
```

### Why this shape

- **Live propagation for free.** Shared fields live in exactly one row. Every
  club's guest list, every roster, every lookup joins to it. "Change the
  source, subscribers update" becomes "there is only the source."
- **History never moves.** `MeetingGuestAttendance`, `VisitLog`,
  `MeetingSpeaker`, `MeetingRoleAssignment`, `Evaluation`, etc. all key off
  `Prospect(clubId, id)` / `Membership(clubId, id)` already. Linking
  `Prospect → Person` makes a lifetime of guest activity resolvable by phone
  without touching a single operational row. Registration = setting
  `Person.userId` + the existing membership claim. Nothing breaks because
  nothing relocates.
- **Unclaimed numbers are first-class.** A `Person` with `userId = null` is
  not a "prospect account" — it's just a contact. No passwords, no auth
  surface, no ghost users.

### Ownership matrix — what is shared vs. club-private

| Field                                                                     | Lives on             | Shared globally?             |
| ------------------------------------------------------------------------- | -------------------- | ---------------------------- |
| name, email, bio, avatar, whatsapp, organization, socials                 | `Person`             | ✅ live                      |
| pipeline stage, notes, `ContactLog`, `VisitLog`                           | `Prospect`           | ❌ club-private              |
| roles, status, dues, `grantOverrides`, education                          | `Membership`         | ❌ club-private              |
| attendance/speech/eval **snapshots** (`MeetingGuestAttendance.name` etc.) | operational rows     | ❌ point-in-time by design   |
| cross-club _context_ ("member of X", "visited you 3×")                    | computed by resolver | ✅ read-only, see §6 privacy |

## 4. The three scenarios, mapped

### Scenario A — number already has an account

Club Y adds `01568286512` as guest → `POST /people/guests` normalises the
phone → upserts/finds the `Person` → resolver returns profile + context → UI
shows a prefilled card ("Sayem Billah · member of X Club · visited you twice")
→ confirm creates the club-scoped `Prospect` linked to that `Person`. Y never
re-types a name. When Sayem updates his bio from his profile page, Y's guest
list shows it on next read.

### Scenario B — no account exists

Club adds the number, tags them into meetings, records visits and roles. All
of it hangs off the club's `Prospect`, which points at the `Person`. Months
later the human registers `01568286512`:

1. `User` created (unchanged).
2. **Existing** membership claim runs (unchanged).
3. **New**: `Person.userId` is set; the user's self-entered name/bio/avatar
   become the top-precedence source (§5).
4. The user's "my history" view can now surface guest visits across clubs —
   the rows were always there, now they're reachable.

Zero downtime, zero batch migration, nothing to retry.

### Scenario C — two clubs add the same number

Club X creates the `Person` + its `Prospect`. Club Y adds the same number →
finds the same `Person` → gets X's profile data **automatically**, creates its
own club-scoped `Prospect` (own stage, own notes). Both clubs see the same
identity; each keeps its own pipeline. When either club edits a shared field,
it writes through to `Person` and both see it.

## 5. Merge policy (deliberately simple)

Per-field precedence, evaluated on write:

1. **Account holder wins.** If `Person.userId` is set, self-service profile
   edits always apply. Club edits to shared fields still apply too (clubs fix
   typos), but the user's next profile save overwrites — the user is the
   ultimate source.
2. **Last non-empty write wins** among club sources. Empty never overwrites
   non-empty. (`Person.updatedAt` + writing only provided fields is enough —
   no per-field version vectors.)
3. **Name fields follow the account** once claimed: pre-claim, club-entered
   names apply; post-claim, the account's `firstName/lastName` is canonical
   (clubs can still see their own display name on the roster row, which stays
   denormalised as it is today).

Racing conditions: accepted. Two clubs editing simultaneously → last write
wins. This is the sanctioned simplicity trade-off.

### Global profile propagation (decided 2026-09-01)

Once a number is claimed, the account holder's profile is **the** display
source for shared fields **everywhere** — every club's roster, every guest
list, every history view, regardless of which clubs they belong to. A user
filling in their profile updates the whole system in one save, because
everything reads `Person`. Consequence: `Membership`'s denormalised display
name is now only the display for **unclaimed** rows (and name-only roster
entries); claimed members render from `Person`. The old "Robert vs Bob can
diverge" stance is superseded for claimed rows.

## 6. Privacy guardrails — DECIDED

- **Shared by default:** first/last name, avatar, bio, organization, email.
  No masking anywhere cross-club (product decision 2026-09-01).
- **Club affiliations are visible:** the resolver returns the _names_ of the
  person's current clubs, not just counts (product decision 2026-09-01).
- **Never exposed cross-club via resolver:** the other club's pipeline stage,
  notes, and contact logs. Visit details surface only as _counts_ for the
  requesting club's own data ("visited your club 3×").
- **Cross-club edits apply silently** — no "updated by X Club" hints
  (product decision 2026-09-01).
- **Account existence:** the lookup reveals "has an account" implicitly via
  richer data — acceptable internally; keep the resolver endpoint behind the
  existing club-context guard, never public.

## 7. API surface (small)

| Endpoint                                              | Purpose                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /people/lookup?phone=…` (club-scoped, throttled) | Resolver: shared profile + `hasAccount` + memberships-of-record (names only) + prior-visit stats for _this_ club. Powers the autofill card. |
| `POST /people/guests`                                 | Now phone-first: normalise → upsert `Person` → create club `Prospect` linked. Response includes what was auto-filled (for the UX toast).    |
| `PATCH /people/guests/:id`                            | Shared fields write through to `Person`; private fields stay on `Prospect`.                                                                 |
| `POST /auth/register`                                 | Extend claim step: set `Person.userId`, apply user profile as top-precedence source.                                                        |
| `GET /users/me/history`                               | **Launch scope** (product decision 2026-09-01): the person's full cross-club footprint — see §7a.                                           |

## 7a. "My History" — the user's cross-club view (launch scope)

One continuous timeline per `Person`, assembled from rows that already exist —
this view is a **read composition**, no data moves:

| Source row                                      | Guest-era (via `Prospect.guestId`)                    | Member-era (via `Membership`)                  |
| ----------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| Attendance                                      | `MeetingGuestAttendance`                              | `MeetingAttendance`                            |
| Per-visit role/notes snapshots                  | `VisitLog`                                            | —                                              |
| Meeting roles (Ah-Counter, TTM, …)              | `MeetingRoleAssignment.guestId`                       | `…membershipId`                                |
| Speech slots: title, pathway, project, duration | `MeetingSpeaker.guestId`                              | `…membershipId`                                |
| Evaluations received                            | `EvaluationSubmission` (via guest's `MeetingSpeaker`) | `EvaluationSubmission` + `Evaluation`          |
| Timer / Ah-Counter / self-logged Evaluation     | ✅ recorded for guests too — schema widened (below)   | `TimerEntry` / `AhCounterEntry` / `Evaluation` |

### Schema widening for guest logging (decided 2026-09-01)

`TimerEntry`, `AhCounterEntry`, and `Evaluation` follow the exact pattern
`MeetingRoleAssignment` already uses: `membershipId` becomes nullable and a
nullable `guestId` (+ composite FK `[clubId, guestId] → Prospect`) is added —
each row tags a member **or** a guest, never both, enforced in the service
layer like `PreparedSpeakersService` does today. For `Evaluation`, the
_speaker_ side widens (`membershipId`/`guestId`); the evaluator side stays
member-only. Meeting-day UX (timer tab, ah-counter tab, evaluation log) gains
the same member-or-guest picker the roles tab already has.

Resolution is trivial: `Person → prospects[] + memberships[]` → union the
operational rows, ordered by meeting date. Clubs appear by name on every row.
**Club-private CRM stays hidden from the user too** (§10 Q2): the user sees
their _activity_, not a club's stage/notes/contact-logs about them.

Registration pay-off moment: after claiming, show a "We found your history —
N meetings across M clubs" card leading into this view.

## 8. Rollout phases

- **Phase 0 — schema & backfill.** ✅ DONE 2026-09-01. Migration
  `20260901090216_number_first_identity`; backfill created 56 persons,
  claimed 24 users, linked 36 prospects + 12 memberships (0 stragglers).
- **Phase 1 — write-path.** ✅ DONE 2026-09-01. Global `IdentityService`
  (`src/identity/`) is the single writer of `Person`: `ensurePerson`
  (club-sourced, fill-empty) wired into guest create/update, member
  create/bulk/update, guest→member convert; `claimPerson` (registration,
  SA provisioning, invite accept, join-request approval, club join);
  `syncUserProfile` (self-service profile save, SA user edit) — the
  authoritative "one save propagates everywhere" path. Reads unchanged.
- **Phase 2 — read-path & UX.** 🚧 IN PROGRESS. ✅ API done 2026-09-01:
  `GET /guests/lookup?phone=` returns the shared profile + cross-club
  memberships + the requesting club's own stats (`PersonLookupWire`);
  `IdentityService.applyClubSource` gives last-non-empty-wins write-through
  on guest/member edits, suppressed once the number is claimed.
  ✅ Web autofill card done 2026-09-01: debounced phone lookup in the
  add-guest drawer with "Use their info" prefill + already-guest/member
  states (`PersonLookup` in web `lib/people/guests.ts`). ✅ "Shared contact"
  chip on the guest profile (`GuestWire.sharedContact`). ⛔ Guest pickers in
  the timer/ah-counter/evaluation tabs are BLOCKED on a missing
  prerequisite: the API has no write path for `TimerEntry`/`AhCounterEntry`/
  `Evaluation` at all (tabs are local-only; report endpoints read data
  nothing creates). The §7a guestId columns are ready; the persistence
  feature itself must be built first — then guest tagging is a small
  addition to it.
- **Phase 3 — claim extension + My History.** ✅ DONE 2026-09-01. Claim
  extension and retro-linking landed earlier (Phase 1 `claimPerson` + the
  backfill). `GET /profile/history` unions guest-era and member-era rows
  (attendance, roles, speeches) across all clubs via `Person`; web timeline
  at `/me/history`. Optional nicety left: a post-registration "We found
  your history" card.
- **Phase 4 — cleanup.** Stop writing duplicated shared fields on `Prospect`
  (keep columns one release as fallback, then drop). Claimed members render
  from `Person` everywhere; `Membership`'s denormalised name remains only
  for unclaimed/name-only roster rows (see §5).

Each phase ships independently and is revertible up to Phase 4.

## 9. Edge cases

- **SIM recycling / number reuse** (real in BD): a new human registers a
  number with someone else's history. Today this silently claims memberships
  too — same risk, not new. Mitigation now: record `claimedAt`, and if the
  registering name differs from `Person` name, keep the account name as
  canonical (per §5) — history stays attached but displays under the new
  name. Real fix later: OTP verification at registration.
- **Typo'd number on a guest:** editing the phone re-resolves to a different
  `Person`; the club's own `Prospect` row (stage/notes/logs) stays intact.
- **Name-only guests** (no phone): stay club-local, invisible to the global
  pool, exactly as today. Adding a phone later links them.
- **`normalizePhone` is the single gate**: every write path (guest, member,
  invite, register, public forms) must pass through it — it already exists;
  the work is auditing call sites.
- **Deletes:** deleting a club cascades its `Prospect`s (and their private
  logs) but never the `Person`. `User` delete → `Person.userId` SetNull, the
  contact survives as unclaimed.

## 10. Product decisions log

Resolved 2026-09-01:

1. ✅ Club Y **can see the names** of other clubs the person belongs to.
2. ✅ Cross-club edits apply **silently** (no "updated by X Club" hint).
3. ✅ **No email masking** cross-club.
4. ✅ **My History ships at launch** — visits, roles, evaluations received,
   ah-counting, meeting data, speech titles, "everything" (see §7a for the
   exact data inventory and its one gap).

5. ✅ **Timer/Ah-Counter/Evaluation widen to guests** (option B) — guest
   involvement is persisted everywhere; schema widening in §7a.
6. ✅ **Club CRM stays club-specific** — the user's My History shows
   activity only, never stage/notes/contact-logs.
7. ✅ **Account deletion keeps club records** — operational rows and name
   snapshots untouched; `Person.userId` → NULL; shared profile survives as
   the club-visible contact.
8. ✅ **Guest → member conversion is a chronological union** — one
   continuous per-club thread in My History, no merge UX.
9. ✅ **User profile is globally authoritative** — one profile save
   propagates to every club, roster, and guest list (see §5).
10. ✅ **Single "Full name" input app-wide** (decided 2026-09-01, same day):
    every form collects one name field; `splitFullName` (apps/api/src/common/name.ts)
    splits on the FIRST space server-side; a single word leaves `lastName`
    empty. **No schema change, no data migration** — the firstName/lastName
    columns stay (they're referenced by ~10 models incl. snapshot columns),
    existing rows render by joining, and a re-save through the splitter is
    harmless. The API accepts `name` on every name-carrying DTO **and** keeps
    the legacy `firstName`/`lastName` pair working (`name` wins when both are
    sent; update DTOs still allow a last-name-only legacy edit). Web forms
    converted: register, profile, add-guest drawer (incl. the PersonLookup
    prefill), guest edit panel, member add/edit, bulk add (paste still
    tolerates a legacy first/last/phone three-column block), SA create-user
    (its client-side splitter deleted — the API owns splitting now), SA user
    edit, public guest-invite. Mobile: deferred with the rest of mobile
    parity. Client cap `FULL_NAME_MAX = 161` (80 + 80 + space) unified
    server-side across all DTOs.

No open questions remain — the plan is implementation-ready at Phase 0.
