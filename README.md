# Dosewell

Medicine reminders for the whole family: yourself, your parents and your children.
Made by Kashif Nowman Kanak, Chennai, India.

- Reminders at each dose time as phone notifications, with Taken and Snooze buttons, and a second nudge after 45 minutes
- One-tap dose tracking, with a seven-day organiser and a full history
- Guardian alert after a set number of missed doses in a row, sent by WhatsApp, SMS or a call with the message already written
- Emergency card per person: blood group, allergies, conditions, current medicines, doctor, who to call
- Photos of prescriptions, lab reports and bills
- Streaks, milestones and a shareable streak picture
- Refill warnings, a 30-day report for the doctor, backup and restore
- Everything stays on the phone: no account, no server, no ads, no analytics

## Project layout

| Path | What it is |
| --- | --- |
| `src/logic.js` | Scheduling, streaks, missed-dose rules and data validation. No UI code. |
| `src/app.js`, `src/styles.css` | The interface |
| `src/platform.js` | Android features: notifications, storage, sharing |
| `src/config.js` | Maker name, support email, privacy policy link |
| `android/` | The Android project (Capacitor 8, target API 36) |
| `tests/` | Unit, fuzz, contrast and browser tests |
| `docs/` | Play Store pack, privacy policy, test report |

## Build

```
npm ci
npm test                 # logic, fuzz and contrast tests
npm run build            # writes www/ and dist/dosewell.html
python3 tests/e2e.py     # browser tests (needs Python Playwright and Chrome)
npm run android:debug    # needs JDK 21 and the Android SDK
```

Every push to `main` also builds a debug APK in GitHub Actions (Actions tab, latest run, Artifacts).
See `docs/PLAY_STORE.md` for signing and the store submission steps.
