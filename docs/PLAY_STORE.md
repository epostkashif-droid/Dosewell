# Play Store pack for Dosewell

Rules checked on 14 November 2026. Google changes these; re-check in Play Console before submitting.

## Before you can submit

1. **Support email** – put it in `src/config.js` (`email`) and replace `SUPPORT_EMAIL_HERE` in `docs/PRIVACY_POLICY.md` and `docs/privacy-policy.html`.
2. **Privacy policy URL** – Play needs a public web page (not a PDF). This repository is private, so host `docs/privacy-policy.html` somewhere public (a small public GitHub Pages repository or Google Sites both work). Put the URL in `src/config.js` (`privacyUrl`) and in Play Console.
3. **Signing key** – create one and keep it safe; losing it means you cannot update the app.
   ```
   keytool -genkeypair -v -keystore dosewell.jks -keyalg RSA -keysize 2048 -validity 10000 -alias dosewell
   base64 -w0 dosewell.jks   # paste as the GitHub secret DOSEWELL_KEYSTORE_BASE64
   ```
   Add GitHub secrets `DOSEWELL_KEYSTORE_BASE64`, `DOSEWELL_KEYSTORE_PASSWORD`, `DOSEWELL_KEY_ALIAS`, `DOSEWELL_KEY_PASSWORD`. The next push then also produces a signed `.aab` under Actions > Artifacts. Enrol in Play App Signing when you upload it.
4. **Test on a real phone** – install the debug APK from GitHub Actions. This project has never been compiled or run on Android; see `TEST_REPORT.md`.
5. **Play Console account** – one-time US$25. A personal account created after 13 November 2023 must run a closed test with at least 12 testers opted in for 14 continuous days before it can apply for production. Budget about three weeks.
6. **Paid app** – set up a Google payments merchant profile in Play Console, then set the price under Monetise > App pricing. A paid app can later be made free, but a free app can never be made paid, so choose "Paid" before the first production release. No payment code is needed in the app, and the app shows no bank or UPI details (the Payments policy does not allow that).

## Technical requirements

| Requirement | Status |
| --- | --- |
| Target API level 36 (Android 16), required for new apps since 31 Aug 2026 | Set in `android/variables.gradle` |
| Android App Bundle (.aab) | `npm run android:release` or the GitHub workflow |
| 64-bit / 16 KB page size | No native libraries of our own |
| Permissions | `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` (from the notifications plugin), `INTERNET` (from the framework; the app makes no requests). No camera, SMS, contacts, location or storage permission. |
| Exact alarms | In Play Console, declare that exact alarms are core to the app: timed medicine reminders. The app works without the permission, with possible delays. |
| Backup | Android cloud backup and device transfer are switched off for app data |

## App content declarations (Policy > App content)

- **Privacy policy**: your public URL. The policy is also readable inside the app (More > Privacy policy).
- **Ads**: No ads.
- **App access**: All functionality is available without special access (no login).
- **Content rating**: answer the questionnaire as a utility/health app with no violence, sexual content, gambling or user-to-user communication.
- **Target audience**: 18 and over. Do not select child age groups; the app is for adults managing family medicines.
- **Data safety**: "Does your app collect or share any of the required user data types?" **No.** Everything is stored on the device only and never transmitted. Sharing that the user starts themselves (WhatsApp, backup file) is not collection or sharing under Play's definitions.
- **Health apps declaration**: tick the medication category (medication reminders and treatment adherence). Not a medical device. No Health Connect.
- **Government apps / Financial features / News**: No.

The app already includes what the Health policy asks for: an in-app medical disclaimer that the user must accept on first run, a reminder to consult a healthcare professional, and an in-app privacy policy.

## Store listing

**App name** (30 max): `Dosewell: Medicine Reminder`

**Short description** (80 max): `Pill reminders for the whole family, with guardian alerts and dose history.`

**Full description**:

```
Dosewell helps you, your parents and your children take the right medicine at the right time.

REMINDERS THAT GET NOTICED
• A notification at every dose time, with Taken and Snooze buttons
• A second nudge 45 minutes later if the dose is still not marked
• Works after a restart, and when the app is closed

ONE APP FOR THE FAMILY
• Separate profiles for each person
• See everyone's doses for today on one screen

A GUARDIAN IN THE LOOP
• When someone misses doses in a row, Dosewell prepares a message for their guardian
• Send it by WhatsApp or SMS in one tap, or call

EVERYTHING AT HAND AT THE CLINIC
• Photograph prescriptions, lab reports and bills
• Emergency card: blood group, allergies, conditions, current medicines, doctor
• Copy a 30-day report for the doctor

STAY MOTIVATED
• Streaks and milestones for every person
• Share a streak picture with the family

PRIVATE BY DESIGN
• Everything stays on your phone
• No account, no ads, no trackers
• Option to hide medicine names in notifications

Also: refill warnings, backup and restore, light and dark themes.

Dosewell is a reminder and record tool. It does not give medical advice. Always follow your doctor or pharmacist.
```

**Category**: Medical (or Health & Fitness). **Tags**: medication reminder, pill tracker.

**Graphics** in `docs/store/`: `icon-512.png`, `feature-graphic-1024x500.png`, four phone screenshots (1080x1920). The screenshots use sample data and were taken in a browser, so retake them on a phone once the app is installed.

**Contact details**: your support email (required). Developer name shown: Kashif Nowman Kanak.

## Things the listing must not claim

- That it treats, cures, diagnoses or prevents anything
- That reminders are guaranteed (a phone can be off or silenced)
- That the guardian is alerted automatically: the user sends the message
