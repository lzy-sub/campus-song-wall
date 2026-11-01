#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for deploy-build-linux.sh" >&2
  exit 1
fi
deploy_platform="${DEPLOY_PLATFORM:-linux/amd64}"
host_uid="$(id -u)"
host_gid="$(id -g)"
cache_suffix="$(printf '%s' "$deploy_platform" | tr '/:' '--')"
builder_image="campus-song-wall-builder:$cache_suffix"
modules_volume="campus-song-wall-node-modules-$cache_suffix"
store_volume="campus-song-wall-pnpm-store-$cache_suffix"
docker build --platform "$deploy_platform" -f docker/build.Dockerfile -t "$builder_image" docker
docker run --rm --platform "$deploy_platform" \
  -v "$PWD:/app" -v "$modules_volume:/app/node_modules" -v "$store_volume:/app/.pnpm-store" \
  -w /app -e HOST_UID="$host_uid" -e HOST_GID="$host_gid" "$builder_image" sh -c '
    set -eu
    corepack enable
    pnpm install
    pnpm build
    find .next/standalone -type f \( -name ".env" -o -name ".env.*" -o -name "*.db" -o -name "*.db-journal" -o -name "*.db-shm" -o -name "*.db-wal" \) -delete
    chown -R "$HOST_UID:$HOST_GID" .next 2>/dev/null || true
  '
printf '%s\n' "$deploy_platform" > .next/DEPLOY_PLATFORM
sh scripts/write-deploy-input-hash.sh
sh scripts/check-deploy-artifacts.sh
echo "deploy artifacts ready: git add -f .next/standalone .next/static .next/BUILD_ID .next/DEPLOY_INPUT_HASH .next/DEPLOY_PLATFORM"