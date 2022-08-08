#!/bin/env bash

curl https://www-growth.scdn.co/_next/static/chunks/pages/heardle-735a6a1069ced864.js |\
    grep -Po '{"artist":.*?transcoded.*?}' |\
    sed 's/\\'/'/g' |\
    jq -s > tracks.json
