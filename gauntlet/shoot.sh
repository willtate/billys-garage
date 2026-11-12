#!/bin/zsh
# Rebuild, reinstall, relaunch, and save a landscape screenshot: shoot.sh <name> [wait]
set -e
cd "${0:A:h}/.."
D=4CFCB0AD-B3A8-4EA5-B296-BAF439B33A01
LOG=$(xcodebuild -project VroomGarage.xcodeproj -scheme VroomGarage -sdk iphonesimulator -configuration Debug -derivedDataPath build CODE_SIGNING_ALLOWED=NO build 2>&1)
if ! echo "$LOG" | grep -q "BUILD SUCCEEDED"; then echo "$LOG" | grep -E "error:" | head -10; echo BUILD FAILED; exit 1; fi
xcrun simctl terminate $D com.example.VroomGarage 2>/dev/null || true
xcrun simctl install $D build/Build/Products/Debug-iphonesimulator/VroomGarage.app
xcrun simctl launch $D com.example.VroomGarage ${=3} >/dev/null
sleep ${2:-4}
xcrun simctl io $D screenshot "${TMPDIR:-/private/tmp/claude-502}/vg_raw.png" >/dev/null 2>&1
sips -r 270 "${TMPDIR:-/private/tmp/claude-502}/vg_raw.png" --out gauntlet/ours/$1.png >/dev/null
sips -Z 1600 gauntlet/ours/$1.png >/dev/null
echo gauntlet/ours/$1.png
