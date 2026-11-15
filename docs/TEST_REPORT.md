# Test and security report

Dosewell 1.1.0, 15 November 2026. Tested as built from this repository.

## What was run

| Suite | Result |
| --- | --- |
| Logic unit tests (`tests/logic.test.mjs`) | 18 of 18 passed |
| Fuzz: 400 randomly generated, partly corrupt data sets | Passed, no exceptions, all invariants held |
| Colour contrast for all five looks, light and dark (`tests/contrast.test.mjs`) | 16 text/background pairs in each of 10 palettes, all at least 4.5:1 |
| Browser tests in headless Chrome (`tests/e2e.py`) | 94 of 94 passed |
| Dependency audit (`npm audit`) | 0 known vulnerabilities |

## What was NOT tested

- **The APK has not been run on a phone or emulator.** It compiles against the Android 16 platform, packages, aligns, signs (v2 and v3) and the app bundle passes `bundletool validate`. The interface was tested in Chrome loaded from local files with a stand-in for the phone bridge, which is how the app loads it. But alarms firing, notification buttons, restart behaviour, the camera, the share sheet, the back gesture and screen insets are verified only by compiling, not by running. Install it and try each of these before trusting it with real medicines.
- No testing on real phones, old Android versions, TalkBack, large font settings or tablets.
- This is a self-review with automated attack tests. It is not an independent penetration test.

## Defects found and fixed

| # | Defect | Fix |
| --- | --- | --- |
| 1 | Alarms rang only while the page was open | Android alarms planned 30 days ahead, restored after a restart, with Taken and Snooze handled without opening the app |
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
| 15 | Two looks failed contrast for button text on pale fills | Darkened their accent colours |
| 16 | The Ocean look's slide-in motion briefly made the page scroll sideways | Page now clips horizontal overflow |

## Security posture

- All text a person types is escaped before display, and stripped of control characters and capped in length before storage.
- Content Security Policy: scripts only from the app itself, no inline script, no outbound network connections, no plugins, no form posts.
- No account, no server, no analytics, and no third-party code at all in the Android app.
- Android: no internet permission and network loads blocked in the web view, backup off, web view debugging off, file access off, one exported activity, no deep links. The share provider serves single files from one private cache folder and rejects any other path.
- Signing key and passwords are read from environment variables and never stored in the repository.

## Known limitations

- The backup file is plain JSON, not encrypted.
- No app lock (PIN or fingerprint). Anyone who can unlock the phone can open the app.
- The guardian alert needs the user to press send. Fully automatic alerts would need a server and an SMS or push service.
- Reminders are planned 30 days ahead. If the app is not opened for 30 days, a notification asks the user to open it.
- Until the user allows on-the-minute alarms (More > Reminders), Android may deliver a reminder a few minutes late, more if battery saver restricts the app.

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
- lilac light: look applies and every tab fits 320px
- lilac dark: look applies and every tab fits 320px
- garden light: look applies and every tab fits 320px
- garden dark: look applies and every tab fits 320px
- sunset light: look applies and every tab fits 320px
- sunset dark: look applies and every tab fits 320px
- ocean light: look applies and every tab fits 320px
- ocean dark: look applies and every tab fits 320px
- clear light: look applies and every tab fits 320px
- clear dark: look applies and every tab fits 320px
- look can be picked on the welcome screen
- chosen look survives a restart
- an unknown look falls back to the default
- app still works when the phone refuses storage
- corrupted saved data cannot crash start-up: not json
- corrupted saved data cannot crash start-up: {"people":"x","meds":7}
- corrupted saved data cannot crash start-up: []
- corrupted saved data cannot crash start-up: {"v":1,"people":[{"id":"
- corrupted saved data cannot crash start-up: "AAAAAAAAAAAAAAAAAAAAAAA
- app starts from local files under its security policy
- bundled font loads without any network or file fetch
- first run asks for notification permission with an explanation
- saving a medicine schedules phone reminders 30 days ahead
- every reminder has a unique id, a future time, a title and a 45-minute follow-up
- the plan ends with a nudge to reopen the app
- times are in ascending order
- Taken pressed on a notification is recorded when the app opens; forged entries are ignored
- state is mirrored to the phone's own storage
- back button returns to Today, then leaves the app
- share picture, copy and backup go through the phone bridge
- app restores from the phone's storage after a restart
- no security-policy violations while running as the Android app
- 681 random taps and junk entries cause no script errors
- random tapping leaves no injected markup
- saved data is still valid after random tapping
- no uncaught script errors in any test
