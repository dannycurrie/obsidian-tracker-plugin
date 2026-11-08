#!/bin/sh
# Screenshots of the static preview at 360 px and 1440 px with headless Chrome
# (no install). Usage: sh .scratch/2027-scoreboard/preview/screenshot.sh  (after npm run preview)
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"
mkdir -p "$DIR/screenshots"
# phone pages pin the view to 360 px (the window is wider: headless Chrome's minimum is ~500 px).
# Fields: page, window width, window height, screenshot name.
for spec in "index 1440 1400 index-1440" "phone 500 3600 phone-360" "dark 1440 1400 dark-1440" "states-phone 500 4200 states-phone-360" "states 1440 1700 states-1440"; do
  set -- $spec
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$TMP/profile" \
    --window-size="$2,$3" --screenshot="$TMP/$4.png" "file://$DIR/$1.html" >/dev/null 2>&1
  cp "$TMP/$4.png" "$DIR/screenshots/"
done
rm -rf "$TMP"
ls "$DIR/screenshots"
