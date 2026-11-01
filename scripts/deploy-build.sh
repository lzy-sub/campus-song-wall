#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
exec sh scripts/deploy-build-linux.sh