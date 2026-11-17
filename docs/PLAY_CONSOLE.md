# Google Play Console — what to enter

The answers for Openfloor's Play Console forms, written from the code and kept
in step with the [privacy policy](https://openfloor.club/privacy). If the app
starts collecting or sending something new, update the privacy page, this file
and the Console in the same change.

## Store listing URLs

| Field                                                                              | Value                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------- |
| App name                                                                           | Openfloor                               |
| Website                                                                            | https://openfloor.club/support          |
| Email                                                                              | apps@niftyitsolution.com                |
| Privacy policy                                                                     | https://openfloor.club/privacy          |
| Account deletion (Data safety)                                                     | https://openfloor.club/account-deletion |
| Terms of use (not a Console field; linked in-app and from the listing description) | https://openfloor.club/terms            |

All five pages are public (no sign-in) and linked from each other's footer. The
app links Help & support, Terms of use and Privacy policy from **Profile →
About**, and Terms + Privacy from the registration screen.

## Data safety form

**Overview questions**

| Question                                                              | Answer                                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Does your app collect or share any of the required user data types?   | Yes                                                                        |
| Is all of the user data collected by your app encrypted in transit?   | Yes (HTTPS only)                                                           |
| Do you provide a way for users to request that their data is deleted? | Yes — in-app (Profile → Delete account) and the account deletion URL above |
| Account creation methods                                              | Username (phone number) and password                                       |

**Data types.** Every type below is _collected_; none is _processed
ephemerally_. Purposes are **App functionality** and, for account fields,
**Account management**. Nothing is used for analytics, advertising, marketing,
personalisation or fraud prevention.

| Category          | Data type                    | Required / optional | Shared?            | Notes                                                             |
| ----------------- | ---------------------------- | ------------------- | ------------------ | ----------------------------------------------------------------- |
| Personal info     | Name                         | Required            | **Yes — WhatsApp** | Messages to members name the meeting role/speaker                 |
| Personal info     | Phone number                 | Required            | **Yes — WhatsApp** | Sign-in identifier; WhatsApp messages are sent to it              |
| Personal info     | Email address                | Optional            | No                 |                                                                   |
| Personal info     | User IDs                     | Required            | No                 | Account id                                                        |
| Personal info     | Other info                   | Optional            | No                 | Bio, social links, organisation, Toastmasters member number       |
| Financial info    | Other financial info         | Optional            | No                 | Club dues recorded by a treasurer                                 |
| Photos and videos | Photos                       | Optional            | No                 | Profile, guest and club banner photos                             |
| Audio             | Voice or sound recordings    | Optional            | No                 | Evaluation recordings (submitted on the web, viewable in the app) |
| App activity      | Other user-generated content | Optional            | No                 | Speeches, evaluations, written feedback                           |
| App activity      | Other actions                | Required            | No                 | Attendance, meeting roles, votes (anonymous)                      |

Not collected: location, contacts, calendar, messages (SMS/email), web
history, device or other IDs, app info and performance (no crash or analytics
SDK), health and fitness.

**Why "Shared" for WhatsApp.** The server sends meeting announcements, role
assignments and voting links over WhatsApp. The phone number and the message
text — which contains names — leave our infrastructure for Meta's. That is a
transfer to a third party, so it is declared as sharing rather than relying on
the service-provider exemption.

**Data about other people.** Officers enter guest and roster records (name,
phone, email, photo). These are the same data types as above and are covered
by those rows.

## App content section

| Item               | Answer                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy     | URL above                                                                                                                                                                                                                             |
| App access         | **All functionality is restricted** → provide a demo account: phone + password of a member of a seeded demo club with past and upcoming meetings. Not a Super Admin. Note that registration only accepts 11-digit Bangladesh numbers. |
| Ads                | No ads                                                                                                                                                                                                                                |
| Content rating     | Users can interact and share content with each other: **Yes** (profiles, evaluations, shared agendas). No violence, sexual content, gambling or controlled substances.                                                                |
| Target audience    | 18 and over (keeps the app out of the Families programme; the terms still allow members from 13)                                                                                                                                      |
| News app           | No                                                                                                                                                                                                                                    |
| Government app     | No                                                                                                                                                                                                                                    |
| Financial features | None                                                                                                                                                                                                                                  |
| Health             | No                                                                                                                                                                                                                                    |
| Category           | **Productivity** (or Business). Not Social or Dating — those categories additionally require a published child safety standards page.                                                                                                 |

## Release build

- Signed with the **upload key** from `apps/flutter/android/key.properties`
  (git-ignored). The upload key is the one EAS generated for the legacy Expo
  app: download it from expo.dev → nifty-developers → Toastie → Credentials →
  Android → `com.toastie.app`, and keep it outside the repo. A release build
  without `key.properties` fails rather than falling back to the debug key.
  Play App Signing holds the app signing key.
- Upload certificate SHA-1: `00:8D:55:C5:38:FD:92:27:FC:14:2D:78:B2:20:A1:1A:27:AA:A7:0A`
- Upload certificate SHA-256:
  `86:E8:B9:0C:D7:E6:A8:A6:AF:2D:B1:CC:8C:F4:69:33:56:E8:21:EA:CF:67:28:A6:D3:D8:BA:42:18:FC:8A:B4`
- Application ID stays **`com.toastie.app`**: the Play listing already has
  releases under it (versions 3–6, Aug–Sep 2026), and Play never allows the ID
  to change. Users only see the name Openfloor.
- Every upload needs a higher `versionCode` (the `+N` in `pubspec.yaml`) than
  the last one in Play.
- Release manifest as built: targetSdk 36, minSdk 24; permissions INTERNET and
  VIBRATE only (no media or storage permissions).
- 16 KB page size: every `arm64-v8a` library in the bundle has LOAD segments
  aligned to 0x4000 or more (checked with NDK `llvm-readelf -l`).

## Still open before production

1. Personal developer accounts: 12 testers × 14 days in a closed test before
   production.
2. A reviewer demo account (see App access above).
3. After every environment has booted the credential-encryption release, drop
   the legacy `CredentialShare.token` / `password` columns and make
   `tokenHash`, `passwordCipher` and `expiresAt` required.
