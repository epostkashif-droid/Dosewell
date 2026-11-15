# Test signing key

`dosewell-test.jks` (password `dosewell-test`, alias `dosewell`) signs builds made without your own key,
so test APKs from GitHub Actions install over each other. It is in the repository on purpose and is
**not secret**: never use it for Google Play. See `docs/PLAY_STORE.md` for creating your real upload key.
