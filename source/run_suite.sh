#!/bin/bash
# Build the offline and hosted pages, then run the browser test suite against them.
# Needs Node with Playwright and Chromium. Output goes to source/test-output/.
set -u
ROOT=$(cd "$(dirname "$0")" && pwd); T=$ROOT/tests; OUT=$ROOT/test-output
HTML=$ROOT/../trifle_mockup.html
rm -rf "$OUT"; mkdir -p "$OUT"
bash "$ROOT/build.sh" "$HTML" || exit 1
ARTIFACT=1 bash "$ROOT/build.sh" "$OUT/hosted.html" || exit 1
python3 "$T/wrap_hosted.py" "$OUT/hosted.html" "$OUT/hosted_wrapped.html" "$T/hosted_wrapper_head.html" || exit 1
run() { mkdir -p "$OUT/$1/shots"; (cd "$OUT/$1" && STEPS="$T/$2.js" node "$T/shoot.js" "$3" > "$OUT/$1.txt" 2>&1); }
# at most three browsers at a time; steps7 alone, because its checksum needs fast-forward to finish within its wait
for g in "steps1 steps2 steps3" "steps4 steps5 steps6" "check1 check2 check3" "steps8"; do for n in $g; do run $n $n "$HTML" & done; wait; done
run steps7 steps7 "$HTML"
run hosted_h1 hosted_h1 "$OUT/hosted_wrapped.html"
W=400 H=860 run hosted_h2_400 hosted_h2 "$OUT/hosted_wrapped.html"
W=768 H=1024 run hosted_h2_768 hosted_h2 "$OUT/hosted_wrapped.html"
fail=0
for f in "$OUT"/*.txt; do
  n=$(basename "$f" .txt)
  if grep -q "^no console errors" "$f" && ! grep -q "STEP FAILED" "$f"; then echo "pass  $n"; else echo "FAIL  $n"; fail=1; fi
done
grep -q "final checksum E9F1FA72 13673" "$OUT/steps7.txt" && echo "pass  checksum E9F1FA72 13673" || { echo "FAIL  checksum (see steps7.txt)"; fail=1; }
grep -q "Reference tests 228 of 228 pass" "$OUT/steps7.txt" && echo "pass  reference tests 228 of 228" || { echo "FAIL  reference tests (see steps7.txt)"; fail=1; }
grep -q "changes 39" "$OUT/check3.txt" && echo "pass  check3 changes 39" || { echo "FAIL  check3 changes"; fail=1; }
grep -q "^lifetimes ok" "$OUT/steps8.txt" && echo "pass  steps8 lifetime analysis" || { echo "FAIL  steps8 lifetime analysis (see steps8.txt)"; fail=1; }
grep -E "^lifetimes " "$OUT/steps8.txt" | head -1 | sed 's/^/info  /'
grep -E "ratio" "$OUT/check1.txt" | sed 's/^/info  /' | cut -c1-120
exit $fail
