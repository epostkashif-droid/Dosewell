# Dosewell

Medicine reminders for the whole family: yourself, your parents and your children.
Made by Kashif Nowman Kanak, Chennai, India.

- Reminders at each dose time as phone notifications, with Taken and Snooze buttons, and a second nudge after 45 minutes
- One-tap dose tracking, with a seven-day organiser and a full history
- Guardian alert after a set number of missed doses in a row, sent by WhatsApp, SMS or a call with the message already written
- Emergency card per person: blood group, allergies, conditions, current medicines, doctor, who to call
- Photos of prescriptions, lab reports and bills
- Streaks, milestones and a shareable streak picture
- Five looks (Lavender, Garden, Sunset, Ocean, Clear), each with its own colours, background, lettering, movement and sounds, in light and dark. Clear is large and high-contrast for older eyes
- Refill warnings, a 30-day report for the doctor, backup and restore
- Everything stays on the phone: no account, no server, no ads, no analytics, and no internet permission

## Project layout

| Path | What it is |
| --- | --- |
| `src/logic.js` | Scheduling, streaks, missed-dose rules and data validation. No UI code. |
| `src/app.js`, `src/styles.css` | The interface |
| `src/themes.js` | The five looks: colours, fonts, shapes, motion and sounds |
| `src/platform.js` | Bridge between the interface and the phone |
| `src/config.js` | Maker name, support email, privacy policy link |
| `android/` | The Android shell: a small Java app (no third-party libraries, target API 36) that shows the interface and runs alarms, notifications, camera and sharing |
| `tests/` | Unit, fuzz, contrast and browser tests |
| `docs/` | Play Store pack, privacy policy, test report |

## Build

```
npm ci
npm test                 # logic, fuzz and contrast tests
npm run build            # writes www/ and dist/dosewell.html
python3 tests/e2e.py     # browser tests (needs Python Playwright and Chrome)
bash scripts/fetch-android-tools.sh   # once: downloads the Android build tools (about 180 MB)
bash scripts/build-android.sh         # writes dist/Dosewell-<version>.apk and .aab (needs JDK 21, zip, unzip)
```

Every push to `main` also builds the APK and app bundle in GitHub Actions (Actions tab, latest run, Artifacts).
Until you add your own upload key as GitHub secrets, Actions builds only a test APK signed with the repository's test key (`android/test-signing/`). That is fine for trying the app but not for Play.
See `docs/PLAY_STORE.md` for signing and the store submission steps.
