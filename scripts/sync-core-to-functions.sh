#!/usr/bin/env bash
# Copies packages/core/src into supabase/functions/_shared/core so Edge Functions (Deno) can import
# the shared domain code with relative paths. Import specifiers are rewritten from .js to .ts because
# Deno resolves module paths literally. The copy is gitignored; run before serve/test/deploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/supabase/functions/_shared/core"
rm -rf "$DEST"
mkdir -p "$DEST"
rsync -a --exclude '*.test.ts' --exclude '*.test-helpers.ts' "$ROOT/packages/core/src/" "$DEST/"
# perl, not sed: in-place editing flags differ between BSD (macOS) and GNU (Linux CI) sed.
find "$DEST" -name '*.ts' -print0 | xargs -0 perl -pi -e "s{(from '(?:\.\.?/)[^']*)\.js'}{\$1.ts'}g; s{(import '(?:\.\.?/)[^']*)\.js'}{\$1.ts'}g"
echo "synced core -> $DEST"
