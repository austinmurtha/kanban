#!/usr/bin/env bash
set -euo pipefail

docker compose up --build -d
echo "App started at http://localhost:8000"
