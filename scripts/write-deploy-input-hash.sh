#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
sh scripts/deploy-input-hash.sh > .next/DEPLOY_INPUT_HASH