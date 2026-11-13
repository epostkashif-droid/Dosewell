# Test and security report

Dosewell 1.0.0, 14 November 2026. Tested as built from this repository.

## What was run

| Suite | Result |
| --- | --- |
| Logic unit tests (`tests/logic.test.mjs`) | 18 of 18 passed |
| Fuzz: 400 randomly generated, partly corrupt data sets | Passed, no exceptions, all invariants held |
| Colour contrast, light and dark (`tests/contrast.test.mjs`) | 12 text/background pairs per theme, all at least 4.5:1 |
| Browser tests in headless Chrome (`tests/e2e.py`) | 68 of 68 passed |
| Dependency audit (`npm audit`) | 0 known vulnerabilities |

## What was NOT tested

- **The Android build has never been compiled or run.** The build machine could not reach Google's Android SDK, so there is no APK yet. Notifications, exact alarms, restart behaviour, the camera, the share sheet, the back button and SMS/WhatsApp hand-off are written against the Capacitor 8 documentation but unverified on a device. Treat the first GitHub Actions build as the first real test.
- No testing on real phones, old Android versions, TalkBack, large font settings or tablets.
- This is a self-review with automated attack tests. It is not an independent penetration test.

## Defects found and fixed

| # | Defect | Fix |
| --- | --- | --- |
| 1 | Alarms rang only while the page was open | Android notifications scheduled five days ahead, restored after restart |
| 2 | Changing a medicine's times rewrote its past: old days suddenly showed as missed | A schedule change only applies from that moment on |
| 3 | Pausing a medicine hid its history; resuming created a backlog of misses | Logged doses are kept; nothing is counted while paused |
| 4 | A medicine added in the afternoon showed that morning's dose as missed | Doses before the medicine was added are not counted |
| 5 | A dose at 11:30 pm stopped alarming at midnight | The alarm checks yesterday's late doses too |
| 6 | A backup file or stored data could carry text or image addresses that the app trusted | Every load goes through strict validation: types, ranges, length caps, id format, image data format |
| 7 | Image address of a record was placed in the page unescaped | Only real base64 JPEG/PNG/WebP data is accepted, and it is escaped |
| 8 | No limit on people, medicines, times or text length | Hard caps everywhere |
| 9 | Long unbroken text pushed four screens sideways (found by the layout test at 320 to 768 px) | Text wraps; grids can shrink |
| 10 | Progress grid and date fields overflowed their cards | Fixed column sizing |
| 11 | Style names collided: empty days were drawn like empty-state cards | Renamed |
| 12 | Health data was included in Android cloud backup by default | Backup and device transfer switched off |
| 13 | Medicine names showed on the lock screen | Notifications are private on the lock screen; optional "hide medicine names" |
| 14 | No disclaimer, privacy policy or maker details | First-run disclaimer that must be accepted; both documents in the app; About section |

## Security posture

- All text a person types is escaped before display, and stripped of control characters and capped in length before storage.
- Content Security Policy: scripts only from the app itself, no inline script, no outbound network connections, no plugins, no form posts.
- No account, no server, no analytics, no third-party SDKs beyond Capacitor and its official plugins.
- Android: backup off, cleartext traffic off, WebView debugging off in release, one exported activity, no deep links, no dangerous permissions.
- Signing key and passwords are read from environment variables and never stored in the repository.

## Known limitations

- The backup file is plain JSON, not encrypted.
- No app lock (PIN or fingerprint). Anyone who can unlock the phone can open the app.
- The guardian alert needs the user to press send. Fully automatic alerts would need a server and an SMS or push service.
- If Android's battery saver restricts the app, a reminder can arrive late. Allowing on-the-minute alarms in More > Reminders reduces this.
- On a phone with a very old Android System WebView the app shows a banner asking for an update, because reminders cannot be scheduled.
- `INTERNET` is still declared because the framework template includes it. Removing it is a possible hardening step once tested on a device.

## Browser test checks that passed

- first run shows onboarding, navigation hidden
- cannot continue without accepting the disclaimer
- onboarding ends on Today with an add-medicine prompt
- a medicine added today lists only doses still ahead (no instant misses)
- one tap marks a dose taken
- stock decreases when taken
- data survives a restart
- undo restores the dose and the stock
- blank medicine name is rejected
- end date before start date is rejected
- Escape closes a sheet
- first contact defaults to guardian
- erase everything returns to first run
- erased data stays erased after restart
- backup restores people, medicines and contacts
- broken or foreign backup files are refused and change nothing
- guardian banner appears after 3 missed doses in a row
- WhatsApp link carries the guardian's number with country code and the message
- banner hides once the guardian is told
- hostile text renders as text on today
- hostile text renders as text on meds
- hostile text renders as text on records
- hostile text renders as text on progress
- hostile text renders as text on more
- records with forged image data are dropped, the valid one is kept
- emergency card escapes every field
- phone links contain digits only
- guardian sheet escapes every field
- guardian links are only wa.me, sms: or tel:
- forged action attributes are ignored
- content security policy blocks inline script even if markup were injected
- content security policy blocks outbound network requests
- no sideways scroll at 320px on today with 70-character unbroken text
- no sideways scroll at 320px on meds with 70-character unbroken text
- no sideways scroll at 320px on records with 70-character unbroken text
- no sideways scroll at 320px on progress with 70-character unbroken text
- no sideways scroll at 320px on more with 70-character unbroken text
- medicine form fits at 320px
- no sideways scroll at 360px on today with 70-character unbroken text
- no sideways scroll at 360px on meds with 70-character unbroken text
- no sideways scroll at 360px on records with 70-character unbroken text
- no sideways scroll at 360px on progress with 70-character unbroken text
- no sideways scroll at 360px on more with 70-character unbroken text
- medicine form fits at 360px
- no sideways scroll at 412px on today with 70-character unbroken text
- no sideways scroll at 412px on meds with 70-character unbroken text
- no sideways scroll at 412px on records with 70-character unbroken text
- no sideways scroll at 412px on progress with 70-character unbroken text
- no sideways scroll at 412px on more with 70-character unbroken text
- medicine form fits at 412px
- no sideways scroll at 768px on today with 70-character unbroken text
- no sideways scroll at 768px on meds with 70-character unbroken text
- no sideways scroll at 768px on records with 70-character unbroken text
- no sideways scroll at 768px on progress with 70-character unbroken text
- no sideways scroll at 768px on more with 70-character unbroken text
- medicine form fits at 768px
- every tappable control is at least 40px
- every form field has a label
- app still works when the phone refuses storage
- corrupted saved data cannot crash start-up: not json
- corrupted saved data cannot crash start-up: {"people":"x","meds":7}
- corrupted saved data cannot crash start-up: []
- corrupted saved data cannot crash start-up: {"v":1,"people":[{"id":"
- corrupted saved data cannot crash start-up: "AAAAAAAAAAAAAAAAAAAAAAA
- 679 random taps and junk entries cause no script errors
- random tapping leaves no injected markup
- saved data is still valid after random tapping
- no uncaught script errors in any test
