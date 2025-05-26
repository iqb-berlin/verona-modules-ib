#!/bin/bash
set -e

TC_PATH=/home/paf/IdeaProjects/testcenter
TC_WS_ID=2

BOOKLETS=""

echo "[get files]"
git clone https://github.com/kroehne/msk-oc.git

echo "[cleanup]"
rm -rf "$TC_PATH/data/ws_$TC_WS_ID/"*

for EDITION_ENTRY in "msk-oc/CBAItemBuilderProjectFiles/"*; do
  [ -e "$EDITION_ENTRY" ] || continue
  [ -d "$EDITION_ENTRY" ] || continue

  EDITION=$(basename "$EDITION_ENTRY")

  echo "=========================================== $EDITION ==========================================="

  for VERSION_ENTRY in "$EDITION_ENTRY/"*; do
    [ -e "$VERSION_ENTRY" ] || continue
    [ -d "$VERSION_ENTRY" ] || continue

    VERSION=$(basename "$VERSION_ENTRY")

    echo "============================ $VERSION ============================"

    for ENTRY in "$VERSION_ENTRY"/9.9.0/*; do
      [ -e "$ENTRY" ] || continue
      [ -d "$ENTRY" ] || continue

      SECTION=$(basename "$ENTRY")

      echo "============== $SECTION ============== "

      source import-msk-set.sh

      BOOKLETS="$BOOKLETS<Booklet>$PACKAGE</Booklet>"
    done
  done
done


echo "[create multi testtaker]"
mkdir -p "$TC_PATH/data/ws_$TC_WS_ID/Testtakers"
cp stuff/testtakers.xml "$TC_PATH/data/ws_$TC_WS_ID/Testtakers/"
BOOKLETS_ESCAPED=$(printf '%s\n' "$BOOKLETS" | sed 's/\//\\\//g')
sed -i "s/«««« booklets »»»»/$BOOKLETS_ESCAPED/g" "$TC_PATH/data/ws_$TC_WS_ID/Testtakers/testtakers.xml"

echo "[read in testcenter]"
cd "$TC_PATH"
make re-init-backend

chromium "http://localhost/#/msc"