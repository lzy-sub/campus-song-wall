#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
fail() { echo "deploy artifact check failed: $*" >&2; exit 1; }
[ -s .next/BUILD_ID ] || fail "missing .next/BUILD_ID"
[ -s .next/standalone/server.js ] || fail "missing .next/standalone/server.js"
[ -d .next/static ] && [ -n "$(find .next/static -type f -print -quit)" ] || fail "missing .next/static"
[ -s .next/DEPLOY_INPUT_HASH ] || fail "missing .next/DEPLOY_INPUT_HASH"
expected_hash="$(sh scripts/deploy-input-hash.sh)"
actual_hash="$(tr -d '\r\n' < .next/DEPLOY_INPUT_HASH)"
[ "$actual_hash" = "$expected_hash" ] || fail "artifacts are stale for the current source tree"
[ -s .next/DEPLOY_PLATFORM ] || fail "missing .next/DEPLOY_PLATFORM"
artifact_platform="$(tr -d '\r\n' < .next/DEPLOY_PLATFORM)"
case "$artifact_platform" in linux/amd64|linux/arm64) ;; *) fail "unsupported platform: $artifact_platform" ;; esac
forbidden="$(find .next/standalone -type f \( -name '.env' -o -name '.env.*' -o -name '*.db' -o -name '*.db-journal' -o -name '*.db-shm' -o -name '*.db-wal' \) -print -quit)"
[ -z "$forbidden" ] || fail "forbidden file in standalone: $forbidden"
echo "deploy artifacts valid ($artifact_platform, source hash $actual_hash)"