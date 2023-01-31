#!/usr/bin/env bash
set -xeuo pipefail

nixArgs=${1:--j8} endpoint=$2 pathsToPush=$3 pushFilter=$4

if [[ $pathsToPush == "" ]]; then
    pathsToPush=$(comm -13 <(sort /tmp/store-path-pre-build) <("$(dirname "$0")"/list-nix-store.sh))

    if [[ $pushFilter != "" ]]; then
        pathsToPush=$(echo "$pathsToPush" | grep -vEe "$pushFilter")
    fi
fi

nix copy $nixArgs --to "$endpoint" ${pathsToPush[@]}
