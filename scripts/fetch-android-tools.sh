#!/usr/bin/env bash
# Downloads the Android build tools used by scripts/build-android.sh into .android-tools/ (about 180 MB).
set -euo pipefail
cd "$(dirname "$0")/.."
T=.android-tools; mkdir -p $T/lib; cd $T
B=https://raw.githubusercontent.com/facebook/buck/main/third-party/java
get() { [ -s "$1" ] || curl -fsSL -o "$1" "$2"; }
get android.jar https://raw.githubusercontent.com/Sable/android-platforms/master/android-36/android.jar
# the bundled d8 cannot read the API 36 jar, so it converts against API 34; the code is still compiled against API 36
get android-34.jar https://raw.githubusercontent.com/Sable/android-platforms/master/android-34/android.jar
get tools.zip https://github.com/lzhiyong/android-sdk-tools/releases/download/35.0.2/android-sdk-tools-static-x86_64.zip
get d8.jar $B/d8/d8.jar
get uas.jar https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar
get bundletool.jar https://github.com/google/bundletool/releases/download/1.17.2/bundletool-all-1.17.2.jar
get lib/fastutil.jar $B/fastutil/fastutil-7.2.0.jar
for j in asm/asm-7.1 asm/asm-analysis-7.1 asm/asm-commons-7.1 asm/asm-tree-7.1 asm/asm-util-7.1 commons-compress/commons-compress-1.18 jopt-simple/jopt-simple-4.6 json-simple/json-simple-1.1.1 kotlinx-metadata-jvm/kotlinx-metadata-jvm-0.1.0 kotlin/kotlin-stdlib; do get "lib/$(basename $j).jar" "$B/$j.jar"; done
[ -d tools ] || unzip -qo tools.zip -d tools
chmod +x tools/build-tools/*
echo "tools ready in $T"
