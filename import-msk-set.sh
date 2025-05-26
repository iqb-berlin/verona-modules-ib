#!/bin/bash
set -e

PACKAGE="$SECTION-version-$VERSION"

echo "[prepare]"
rm -rf units/*
rm -rf dist/*
cp "msk-oc/CBAItemBuilderProjectFiles/$EDITION/$VERSION/9.9.0/$SECTION/"*.zip units/

echo "[run]"
npm run build "$PACKAGE"
cp stuff/intro.unit.xml "dist/$PACKAGE-intro.unit.xml"
cp stuff/outro.unit.xml "dist/$PACKAGE-outro.unit.xml"

echo "[get title]"
TITLE=$(curl -s "https://kroehne.github.io/msk-oc/oer_generated/${EDITION}_${VERSION}_9.9.0_${SECTION}.html" | pup 'h1 text{}')
echo "Title: $TITLE"

sed -i "s/«««« packageId »»»»/$PACKAGE/g" "dist/$PACKAGE-intro.unit.xml"
sed -i "s/«««« section »»»»/$SECTION/g" "dist/$PACKAGE-intro.unit.xml"
sed -i "s/«««« title »»»»/$TITLE/g" "dist/$PACKAGE-intro.unit.xml"
sed -i "s/«««« edition »»»»/$EDITION/g" "dist/$PACKAGE-intro.unit.xml"
sed -i "s/«««« version »»»»/$VERSION/g" "dist/$PACKAGE-intro.unit.xml"
sed -i "s/«««« packageId »»»»/$PACKAGE/g" "dist/$PACKAGE-outro.unit.xml"
sed -i "s/<Units>/<Units><Unit id='intro_$PACKAGE' label='Intro' labelshort='Intro' \/>/g" "dist/$PACKAGE.booklet.xml"
sed -i "s/<\/Units>/<Unit id='outro_$PACKAGE' label='Outro' labelshort='OUTRO' \/><\/Units>/g" "dist/$PACKAGE.booklet.xml"
sed -i "s/CIB2Verona PackageBuilder v0.2.0 | Booklet/$TITLE ($VERSION)/g" "dist/$PACKAGE.booklet.xml"
echo "[File modified]"

echo "[copy to testcenter]"
mkdir -p "$TC_PATH/data/ws_$TC_WS_ID/Unit"
mkdir -p "$TC_PATH/data/ws_$TC_WS_ID/Resource"
mkdir -p "$TC_PATH/data/ws_$TC_WS_ID/Booklet"
mkdir -p "$TC_PATH/data/ws_$TC_WS_ID/Testtakers"
mv dist/*.unit.xml "$TC_PATH/data/ws_$TC_WS_ID/Unit"
mv dist/*.voud.json "$TC_PATH/data/ws_$TC_WS_ID/Resource"
mv dist/*.zip "$TC_PATH/data/ws_$TC_WS_ID/Resource"
mv dist/*.html "$TC_PATH/data/ws_$TC_WS_ID/Resource"
mv dist/*.booklet.xml "$TC_PATH/data/ws_$TC_WS_ID/Booklet/"
#mv dist/*.testtakers.xml "$TC_PATH/data/ws_$TC_WS_ID/Testtakers/"
cp "$TC_PATH/sampledata/verona-player-simple-6.0.html" "$TC_PATH/data/ws_$TC_WS_ID/Resource"

