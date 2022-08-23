#!/usr/bin/env bash
set -euo pipefail

nixArgs=${1:--j8} endpoint=$2 pathsToPush=$3 pushFilter=$4

if [[ $pathsToPush == "" ]]; then
    pathsToPush=$(comm -13 <(sort /tmp/store-path-pre-build) <("$(dirname "$0")"/list-nix-store.sh))

    if [[ $pushFilter != "" ]]; then
        pathsToPush=$(echo "$pathsToPush" | grep -vEe "$pushFilter")
    fi
fi

echo "$pathsToPush" | nix copy --verbose $nixArgs --to "$endpoint"
