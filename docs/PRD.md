# Product Requirements Document (PRD)

Status: living document, reconstructed from the shipped product on 2026-08-31.
Owner: project maintainer.

## 1. Summary

Toastie is a club management platform for Toastmasters International clubs. It
replaces the mix of spreadsheets, printed agendas, and messaging threads that
clubs typically use to run meetings, track member progress through the
Pathways education program, manage a guest pipeline, and handle club
administration and finances.

The product ships to end users under the name **Toastie**. Internally, the
codebase, npm packages, and server processes use the `toastly` name; this is a
historical artifact of a rebrand and has no product meaning.

## 2. Problem statement

A Toastmasters club is run entirely by volunteer officers who rotate yearly.
Without a shared system, clubs lose institutional knowledge every term:
meeting history, who has spoken and evaluated whom, where each member stands
in their Pathway, who has visited as a guest and never followed up with, and
whether dues have been collected. Existing tools (spreadsheets, generic
scheduling apps, Toastmasters' own Base Camp) address only part of this, and
none of them model the club-to-district hierarchy or the officer role
structure that governs who should be allowed to see or change what.

Toastie exists to give a club officer team, and the district structure above
it, one system that models the actual organization: a club has members with
roles, a term of meetings, a guest funnel, and a budget, and it sits under an
Area, a Division, and a District.

## 3. Target users

- **Club members.** View the agenda, their assigned role or speech slot,
  their own education progress and evaluation history.
- **Club officers** (President, VP Education, VP Membership, VP Public
  Relations, Secretary, Treasurer, Sergeant-at-Arms, Immediate Past
  President, Club Admin). Each role has a different default set of
  permissions, scoped to their own club.
- **Guests and prospective members.** Reached through public, unauthenticated
  links: a meeting agenda, a single role brief, or an evaluation form. They do
  not need an account to participate in a meeting.
- **Area, Division, and District Directors.** Oversee multiple clubs within
  their unit of the organizational hierarchy, with read access scoped to that
  unit.
- **Super Admin.** Platform-wide operator role used to provision clubs,
  districts, and initial officer accounts, and to support the platform
  itself.

## 4. Goals

- Give a club officer team a single source of truth for meetings,
  membership, education records, guests, tasks, and finances.
- Make the guest-to-member pipeline visible and trackable, so that a visitor
  is never lost after a single meeting.
- Make Pathways progress and speech history durable and attributable to the
  member, independent of who is currently serving as VP Education.
- Enforce permissions by construction: a member should not be able to see or
  do more than their role allows, without every screen having to re-implement
  that check.
- Support the real organizational shape of Toastmasters: District, Division,
  Area, Club, Member, so that oversight roles above the club see only what
  their unit contains.
- Work acceptably on a phone in a meeting room, including as an installed
  progressive web app.

## 5. Non-goals

- Toastie does not aim to replace Toastmasters International's own
  membership and dues system (Base Camp / WHQ). It is a club-operations
  layer, not a membership-of-record system.
- No payment processing. Dues and transactions are recorded for tracking,
  not collected through the app.
- No real-time collaborative editing (for example, two officers editing the
  same agenda at once is not conflict-resolved beyond last-write-wins).
- No native mobile app. The PWA is the mobile experience.
- Full offline operation is not a goal. The offline screen exists so a
  connection drop is not a blank crash, not so the app is usable with no
  network at all.

## 6. Core use cases

### 6.1 Running a meeting

An officer builds the agenda for an upcoming meeting: sets the theme and
word of the day, assigns roles (Toastmaster, Timer, Ah-Counter, Grammarian,
and the rest), schedules prepared speakers and their evaluators, and adds
table topics questions. The agenda is published and shared as a link that
members and guests can open without logging in. During the meeting,
attendance is marked for both members and guests, and role holders can open
their own role brief from the shared link.

### 6.2 Capturing a speech and its evaluation

A prepared speaker's slot records their Pathway, project, and title. After
the speech, the assigned evaluator (or any attendee, if the club allows open
feedback) can submit an evaluation through a public, unauthenticated link,
including text, an image, or an audio recording. That evaluation becomes
part of the speaker's permanent history, viewable from their profile.

### 6.3 Tracking a guest through to membership

A first-time visitor is logged as a guest with contact details and a first
visit. Each subsequent visit and contact attempt (call, message, follow-up)
is logged against them. When they decide to join, the officer converts the
guest record into a member, carrying their visit and contact history
forward rather than starting a new, disconnected member record.

### 6.4 Tracking education progress

Each member has a Pathway, a current level, and a history of levels reached,
speeches given, and projects started and completed. VP Education (or the
member themselves, where permitted) can see this history and the term
planner that maps out who is speaking or holding a role over the coming
weeks, kept in sync with the actual meeting agendas as they are created.

### 6.5 Club administration

The Club Admin adds members to the roster, singly or in bulk, before they
have necessarily created an account; the roster row is claimed automatically
when someone signs up with a matching phone number. Roles and
permission overrides are managed per member. The club's public profile
(motto, venue, contact details, and the agenda banner's color or image) is
configured here. An audit trail of who changed what is available for
accountability.

### 6.6 Oversight above the club

An Area, Division, or District Director sees the clubs within their unit.
A Super Admin can provision new districts, divisions, areas, and clubs, and
hand a new officer their first login credentials through a shareable link.

## 7. Functional requirements by module

| Module              | Requirement summary                                                                                                                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard           | Show the next meeting countdown, a club activity pulse, the signed-in member's own upcoming assignments, and their most recent speech.                                                                                                                                            |
| Meetings            | Create, edit, publish, and delete meetings. Assign roles, prepared speakers, evaluators, and table topics. Mark member and guest attendance. Track timer and Ah-Counter results. Maintain a per-meeting setup checklist. Publish a public agenda page with a customizable banner. |
| Education           | Record Pathway, level, and history events per member. Show received evaluations. Maintain a term planner that mirrors scheduled meetings. Serve evaluation form downloads.                                                                                                        |
| People (Guests)     | Maintain a guest pipeline with stages from first contact through to joining. Log contact attempts and visits. Convert a guest to a member without losing history.                                                                                                                 |
| Library             | Store image assets and documents for the club. Maintain a day-by-day meeting theme and idea planner.                                                                                                                                                                              |
| Inventory           | Maintain a register of club equipment and a per-meeting setup checklist.                                                                                                                                                                                                          |
| Finance             | Record income and expense transactions, dues owed and paid per member per period, and planned budget lines by category and fiscal year.                                                                                                                                           |
| Tasks               | Create officer tasks with a priority, due date, and one or more assignees. Track completion and progress notes.                                                                                                                                                                   |
| Records             | Provide a historical view of past meetings and member records.                                                                                                                                                                                                                    |
| Activity Logs       | Maintain an append-only audit feed of actions taken within a club.                                                                                                                                                                                                                |
| Club Admin          | Manage roster, roles, and per-member permission overrides. Manage invites and join codes. Configure the club's public profile. View the audit trail.                                                                                                                              |
| District operations | Provide Area, Division, and District views scoped to the units a director oversees. Provide a Super Admin console for platform-wide user and organization management, including credential handoff for newly provisioned users.                                                   |
| Onboarding          | Support joining a club by invite link, by join code, or by request (subject to the club's join policy). Support a pre-populated roster row being claimed automatically at signup by phone number match.                                                                           |

## 8. Access and privacy requirements

- Every module is gated by the shared authorization engine (see the TDD).
  A member and a club officer see materially different applications built
  from the same screens.
- A small set of pages are deliberately public and require no login, because
  the person on the other end (a guest, a visiting speaker, an evaluator) is
  not expected to have an account: the published agenda, an individual role
  brief, the evaluation capture form, invite acceptance, and a one-time
  credentials handoff page.
- A user's data is scoped to the clubs they belong to and, for directors, the
  organizational unit they are assigned to. Cross-club data access is not
  possible by construction, not only by convention (see the ERD's tenancy
  section).
- Passwords are never stored in plain text except transiently, in the
  one-time `CredentialShare` record used to hand a newly provisioned user
  their first password; that record is deleted on first login.

## 9. Success criteria

- A club officer team can run a full meeting term (agendas, roles,
  attendance, evaluations) without leaving the app.
- A guest who visits a club is never lost: their visit and contact history
  persists whether or not they eventually join.
- A member's Pathway and speech history remain intact across officer terms
  and role changes.
- No screen exposes an action to a user whose role should not permit it.
- The app is usable on a phone, in a meeting room, on ordinary mobile data.

## 10. Open questions

- Whether background job processing (queued via Redis) is needed beyond the
  current stub seam, and for what workloads.
- How far offline support should go, given the current design intentionally
  stops short of full offline operation.
- Whether Toastie should ever integrate directly with Toastmasters
  International's own systems (Base Camp) rather than duplicating Pathway
  and history data by hand entry.
