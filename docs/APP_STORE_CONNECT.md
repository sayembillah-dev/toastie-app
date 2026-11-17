# App Store Connect — what to enter

The answers for Openfloor's App Store Connect forms, written from the code and
kept in step with the [privacy policy](https://openfloor.club/privacy),
[PLAY_CONSOLE.md](PLAY_CONSOLE.md) and the app's privacy manifest
(`apps/flutter/ios/Runner/PrivacyInfo.xcprivacy`). If the app starts collecting
or sending something new, update all four in the same change.

## Before the first upload

1. **Apple Developer Program** membership for team `4XCMVF4S5P`, Nifty IT Solution Ltd. (the team set
   in the Xcode project). Automatic signing creates the distribution
   certificate on first archive if the signed-in Apple ID is an Admin.
2. **Xcode → Settings → Accounts**: sign in with an Apple ID on that team
   (Admin or App Manager). Without it, automatic signing fails with
   `No Account for Team "4XCMVF4S5P"`.
3. **Bundle ID**: register **`com.openfloor.app`** under Certificates,
   Identifiers & Profiles → Identifiers → + → App IDs → App (Explicit, no
   capabilities). iOS uses this ID. Android stays `com.toastie.app` because
   Play never allows a change. The two stores don't need to match.
4. **App record**: App Store Connect → Apps → + → New App. Platform iOS, name
   `Openfloor`, bundle ID `com.openfloor.app`, SKU `openfloor-ios`, primary
   language English, Full Access. A bundle ID belongs to one app record and
   can't change after the first upload.

## Build and upload

```sh
cd apps/flutter
flutter build ipa --release --dart-define=API_URL=https://openfloor.club
```

Upload `build/ios/ipa/*.ipa` with Apple's **Transporter** app, or open
`build/ios/archive/Runner.xcarchive` in Xcode → Organizer → Distribute App →
App Store Connect.

- Version and build come from `pubspec.yaml` (`1.0.3+7` → version 1.0.3,
  build 7). Each upload for a version needs a higher build number.
- Build settings as shipped: iPhone only (`TARGETED_DEVICE_FAMILY = 1`), iOS
  15.0 minimum (Xcode 27 rejects anything lower), portrait (the speech timer
  can rotate).
- Export compliance: `ITSAppUsesNonExemptEncryption = false` is in
  Info.plist (HTTPS only, no custom crypto), so App Store Connect doesn't ask
  on each build.
- iPad support can be added later. Once a version ships with iPad support,
  it can never be removed, and iPad screenshots become required.

## App information

| Field                | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| Name                 | Openfloor                                                     |
| Subtitle (≤30 chars) | e.g. `Toastmasters club meetings`                             |
| Category             | Productivity (secondary: Business)                            |
| Content rights       | Does not contain, show or access third-party content          |
| Support URL          | https://openfloor.club/support                                |
| Marketing URL        | https://openfloor.club (optional)                             |
| Privacy policy URL   | https://openfloor.club/privacy                                |
| Copyright            | `2026 <legal name of the account holder or company>`          |
| Price                | Free. No in-app purchases (club dues are recorded, not paid). |

**Age rating questionnaire.** Answer "None" for every content descriptor
(violence, sexual content, profanity, drugs, gambling, horror, medical). Answer
**Yes** to user-generated content or user-to-user communication (profiles,
evaluations, shared agendas). Answer **No** to unrestricted web access: the
in-app browser opens only our own legal pages.

## App Privacy ("nutrition label")

Tracking: **No**. No analytics, advertising or crash SDK.

Every type below: **collected**, **linked to the user's identity**, **not used
for tracking**, purpose **App Functionality** only.

| Apple category | Data type          | Notes                                                   |
| -------------- | ------------------ | ------------------------------------------------------- |
| Contact Info   | Name               | Also sent to WhatsApp in meeting messages               |
| Contact Info   | Phone Number       | Sign-in identifier; WhatsApp messages are sent to it    |
| Contact Info   | Email Address      | Optional                                                |
| Identifiers    | User ID            | Account id                                              |
| User Content   | Photos or Videos   | Profile, guest and club banner photos                   |
| User Content   | Audio Data         | Evaluation recordings (recorded on the web)             |
| User Content   | Other User Content | Speeches, evaluations, feedback, bio, roles, attendance |
| Financial Info | Other Financial    | Club dues recorded by a treasurer                       |

Not collected: location, contacts, browsing/search history, health, purchases,
diagnostics, usage data, device IDs, sensitive info.

## App Review information

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in       | Required. Demo account: phone + password of a member of a seeded demo club with past and upcoming meetings, not a Super Admin. Use the same account as Play.                                                                                                                                                                                                                  |
| Contact       | Name, phone, apps@niftyitsolution.com                                                                                                                                                                                                                                                                                                                                         |
| Notes (paste) | Openfloor runs Toastmasters club meetings: agendas, role sign-ups, speech timer, evaluations and voting. Accounts are created by club officers or by self-registration with a Bangladesh mobile number (11 digits), so please use the demo account provided. Account deletion: Profile → Delete account. The app has no purchases; dues are recorded by club treasurers only. |

## Screenshots

At least 3 (up to 10) iPhone 6.9" screenshots (1320×2868 portrait). App Store
Connect scales them down for smaller iPhones. The read-only tour test captures
every main screen. Run it on an iPhone Pro Max simulator:

```sh
cd apps/flutter
flutter drive --driver=test_driver/integration_test.dart \
  --target=integration_test/tour_test.dart -d "iPhone 17 Pro Max" \
  --dart-define=TOUR_PHONE=<demo phone> --dart-define=TOUR_PASSWORD=<demo password>
# → build/screenshots/
```

Use the demo club so that no real members' names or numbers appear.

## Review risks to check before submitting

1. **Guideline 1.2 (user-generated content).** Apple usually requires a way
   to report objectionable content, block abusive users and contact the
   developer. Clubs are private and officers moderate, which is worth saying
   in the review notes, but reviewers may still reject without an in-app
   report/block action.
2. **Guideline 5.1.1(v) (account deletion).** Done: Profile → Delete account,
   plus https://openfloor.club/account-deletion.
3. **Sign in with Apple.** Not required: the app has only its own
   phone-and-password accounts, no third-party login.
4. **Real WhatsApp messages.** Make sure the demo club's phone numbers are
   ours, because a reviewer who publishes a meeting triggers sends.
