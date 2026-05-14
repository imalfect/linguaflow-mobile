#!/usr/bin/env bash
# Patches the Android manifest (created by `tauri android init`) to add the
# RECORD_AUDIO permission required for accent training, and the
# usesCleartextTraffic flag for local development.
set -euo pipefail

MANIFEST="apps/mobile/src-tauri/gen/android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "$MANIFEST not found. Run 'bun run android:init' first." >&2
  exit 1
fi

if grep -q "android.permission.RECORD_AUDIO" "$MANIFEST"; then
  echo "RECORD_AUDIO already present."
else
  /usr/bin/sed -i.bak 's|<manifest |<manifest |; s|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />|' "$MANIFEST"
  rm -f "$MANIFEST.bak"
  echo "Added RECORD_AUDIO permission."
fi

if grep -q "android:usesCleartextTraffic" "$MANIFEST"; then
  echo "usesCleartextTraffic already set."
else
  /usr/bin/sed -i.bak 's|<application |<application android:usesCleartextTraffic="true" |' "$MANIFEST"
  rm -f "$MANIFEST.bak"
  echo "Enabled usesCleartextTraffic for development."
fi
