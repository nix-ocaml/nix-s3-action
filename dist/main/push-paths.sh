#!/usr/bin/env bash
set -xeuo pipefail

endpoint=$1 nixArgs=$2 pathsToPush=$3 pushFilter=$4

if [[ $endpoint == "" ]]; then
    echo "No endpoint set, exiting"
    exit 1
fi

if [[ $pathsToPush == "" ]]; then
    pathsToPush=$(comm -13 <(sort /tmp/store-path-pre-build) <("$(dirname "$0")"/list-nix-store.sh))

    if [[ $pushFilter != "" ]]; then
        pathsToPush=$(echo "$pathsToPush" | grep -vEe "$pushFilter")
    fi
fi

echo "nix copy --verbose --to \"$endpoint\" $nixArgs"

echo "$pathsToPush" | nix copy --verbose --to "$endpoint" $nixArgs
