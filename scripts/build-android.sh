#!/usr/bin/env bash
# Builds a signed Dosewell APK (and an .aab for Play) without Gradle.
# Tools: set SDK_TOOLS to a folder holding android.jar, d8 classpath jars, aapt2, zipalign, an APK signer and bundletool.
# Run scripts/fetch-android-tools.sh once to download them into .android-tools/.
set -euo pipefail
cd "$(dirname "$0")/.."
T="${SDK_TOOLS:-$PWD/.android-tools}"
BT="$T/tools/build-tools"
PKG=in.kaybuilds.dosewell
VERSION_CODE="${VERSION_CODE:-3}"
VERSION_NAME="${VERSION_NAME:-1.2.0}"
MIN_SDK=26
TARGET_SDK=36
KS="${DOSEWELL_KEYSTORE_FILE:-$PWD/android/test-signing/dosewell-test.jks}"
KS_PASS="${DOSEWELL_KEYSTORE_PASSWORD:-dosewell-test}"
KS_ALIAS="${DOSEWELL_KEY_ALIAS:-dosewell}"
KEY_PASS="${DOSEWELL_KEY_PASSWORD:-$KS_PASS}"
OUT=build/android
D8CP="$T/d8.jar:$T/bundletool.jar:$(ls "$T"/lib/*.jar | tr '\n' ':')"

npm run build --silent
rm -rf "$OUT" && mkdir -p "$OUT"/{gen,cls,dex,assets,mod}
cp -r www/. "$OUT/assets/"

# 1. resources
"$BT/aapt2" compile --dir android/res -o "$OUT/res.zip"
link() { "$BT/aapt2" link "$@" -I "$T/android.jar" --manifest android/AndroidManifest.xml --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" -A "$OUT/assets" "$OUT/res.zip"; }
link -o "$OUT/base.apk" --java "$OUT/gen"

# 2. code
javac -source 8 -target 8 -Xlint:-options -nowarn -bootclasspath "$T/android.jar" -d "$OUT/cls" "$OUT"/gen/in/kaybuilds/dosewell/R.java android/src/in/kaybuilds/dosewell/*.java
mkdir -p "$OUT/tool" && javac -nowarn -cp "$D8CP" -d "$OUT/tool" scripts/StripParams.java
java -cp "$OUT/tool:$D8CP" StripParams $(find "$OUT/cls" -name '*.class')
java -cp "$D8CP" com.android.tools.r8.D8 --release --lib "$T/android-34.jar" --min-api $MIN_SDK --output "$OUT/dex" $(find "$OUT/cls" -name '*.class')

# 3. test keystore if none was supplied (a release for Play must use your own key)
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -storepass "$KS_PASS" -keypass "$KEY_PASS" -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Dosewell test key, O=Kashif Nowman Kanak, L=Chennai, C=IN" >/dev/null 2>&1
fi

# 4. APK
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
rm -rf "$OUT/signed"
java -jar "$T/uas.jar" -a "$OUT/aligned.apk" --ks "$KS" --ksAlias "$KS_ALIAS" --ksPass "$KS_PASS" --ksKeyPass "$KEY_PASS" --zipAlignPath "$BT/zipalign" -o "$OUT/signed" >/dev/null
mkdir -p dist && cp "$OUT"/signed/*.apk "dist/Dosewell-$VERSION_NAME.apk"
if [ "${SKIP_AAB:-}" = "1" ]; then ls -la dist/Dosewell-*; exit 0; fi

# 5. App bundle for Play
link -o "$OUT/proto.apk" --proto-format
(cd "$OUT/mod" && unzip -q ../proto.apk && mkdir -p manifest dex && mv AndroidManifest.xml manifest/ && cp ../dex/classes.dex dex/ && zip -q -r ../base.zip .)
rm -f "dist/Dosewell-$VERSION_NAME.aab"
java -jar "$T/bundletool.jar" build-bundle --modules="$OUT/base.zip" --output="dist/Dosewell-$VERSION_NAME.aab" >/dev/null
jarsigner -keystore "$KS" -storepass "$KS_PASS" -keypass "$KEY_PASS" -sigalg SHA256withRSA -digestalg SHA-256 "dist/Dosewell-$VERSION_NAME.aab" "$KS_ALIAS" >/dev/null
ls -la dist/Dosewell-*
