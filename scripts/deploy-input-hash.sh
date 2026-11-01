#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
input_files="$(
  git ls-files --cached --others --exclude-standard -- \
    app components lib prisma public \
    next.config.ts package.json pnpm-lock.yaml tsconfig.json 2>/dev/null \
    | LC_ALL=C sort
)"
if [ -z "$input_files" ]; then
  echo "No deploy input files found." >&2
  exit 1
fi
printf '%s\n' "$input_files" | while IFS= read -r input_file; do
  [ -f "$input_file" ] || continue
  printf '%s  %s\n' "$(git hash-object "$input_file")" "$input_file"
done | git hash-object --stdin