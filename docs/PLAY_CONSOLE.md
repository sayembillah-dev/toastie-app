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
  (git-ignored), which points at `~/keystores/openfloor-upload.jks` outside
  the repo. A release build without that file fails rather than falling back
  to the debug key. Enrol in **Play App Signing** on first upload; Google then
  holds the app signing key and this is only the upload key.
- Upload certificate SHA-256:
  `09:2B:96:CC:C6:AE:45:1B:FB:B0:DD:80:B4:65:EC:7A:D6:37:30:DE:94:6E:60:E9:F7:62:3E:DF:AF:B5:D2:50`
- Release manifest as built: targetSdk 36, minSdk 24; permissions INTERNET and
  VIBRATE only (no media or storage permissions).
- 16 KB page size: every `arm64-v8a` library in the bundle has LOAD segments
  aligned to 0x4000 or more (checked with NDK `llvm-readelf -l`).
- **Before the first upload:** EAS built a store-signed `com.toastie.app`
  bundle from the legacy Expo app on 31 Aug 2026, signed with a key EAS
  manages. If that bundle was ever uploaded, Play already expects EAS's upload
  key and will reject this one. Either download EAS's keystore
  (`eas credentials -p android` in `apps/mobile`) and point `key.properties`
  at it, or ask Play for an upload-key reset using this key's certificate.

## Still open before production

1. Personal developer accounts: 12 testers × 14 days in a closed test before
   production.
2. A reviewer demo account (see App access above).
3. Decide the permanent application ID (`com.toastie.app` today) before the
   first upload.
4. After every environment has booted the credential-encryption release, drop
   the legacy `CredentialShare.token` / `password` columns and make
   `tokenHash`, `passwordCipher` and `expiresAt` required.
