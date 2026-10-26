#!/bin/bash
# Assemble the single-file mock-up from the source parts.
# ARTIFACT=1 builds the hosted variant: no doctype, html, head or body tags (the host adds them).
set -e
H=$(cd "$(dirname "$0")" && pwd)
D=$H/src
OUT=${1:-$H/../trifle_mockup.html}
TITLE='TRIFLE Software Mock-up'
{
  if [ -n "$ARTIFACT" ]; then
    printf '<title>%s</title>\n<style>\n' "$TITLE"
  else
    printf '<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>%s</title>\n<!-- TRIFLE control and analysis software, interactive mock-up. Runs entirely on simulated data. One file, no network requests. -->\n<style>\n' "$TITLE"
  fi
  for f in $D/1[0-4]_*.css; do cat "$f"; done
  echo '</style>'
  [ -z "$ARTIFACT" ] && printf '</head>\n<body>\n'
  cat $D/15_body.html
  echo '<script id="ref-tests" type="application/json">'
  cat $H/reference/trifle_reference_tests.json
  echo '</script>'
  echo '<script>'
  for f in $D/20_engine.js $D/30_chart.js $D/40_model.js $D/4[1-9]_*.js $D/5*.js $D/6*.js $D/7*.js $D/90_boot.js; do [ -f "$f" ] && { cat "$f"; echo; }; done
  echo '</script>'
  [ -z "$ARTIFACT" ] && printf '</body>\n</html>\n'
  true
} > "$OUT"
echo "built $OUT ($(wc -c < "$OUT") bytes)"
