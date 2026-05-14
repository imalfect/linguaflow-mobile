#!/usr/bin/env bash
# Adds NSMicrophoneUsageDescription to the iOS Info.plist created by
# `tauri ios init`.
set -euo pipefail

PLIST="apps/mobile/src-tauri/gen/apple/linguaflow_iOS/Info.plist"

if [ ! -f "$PLIST" ]; then
  # Fallback: try the underscore-product-name variants Tauri may use.
  for candidate in apps/mobile/src-tauri/gen/apple/*/Info.plist; do
    if [ -f "$candidate" ]; then
      PLIST="$candidate"
      break
    fi
  done
fi

if [ ! -f "$PLIST" ]; then
  echo "Info.plist not found under apps/mobile/src-tauri/gen/apple/." >&2
  echo "Run 'bun run ios:init' first." >&2
  exit 1
fi

if grep -q "NSMicrophoneUsageDescription" "$PLIST"; then
  echo "NSMicrophoneUsageDescription already present in $PLIST."
  exit 0
fi

/usr/bin/sed -i.bak 's|</dict>|  <key>NSMicrophoneUsageDescription</key>\n  <string>Linguaflow potrzebuje dostępu do mikrofonu, aby trenować Twój akcent.</string>\n</dict>|' "$PLIST"
rm -f "$PLIST.bak"
echo "Added NSMicrophoneUsageDescription to $PLIST."
