#!/bin/sh
# คำนวณเวอร์ชันถัดไปจาก git tag ล่าสุด (vX.Y.Z) + commit message แบบ Conventional Commits
#   BREAKING CHANGE หรือ type!:  -> major
#   feat:                        -> minor
#   อื่น ๆ (fix:, chore:, ...)   -> patch
# ถ้าไม่มี commit ใหม่หลัง tag ล่าสุด จะคืนเวอร์ชันเดิม
set -eu

LAST_TAG=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)

if [ -z "$LAST_TAG" ]; then
  BASE="0.0.0"
  LOG=$(git log --format='%s%n%b')
else
  BASE="${LAST_TAG#v}"
  LOG=$(git log "$LAST_TAG..HEAD" --format='%s%n%b')
  if [ -z "$LOG" ]; then
    echo "$BASE"
    exit 0
  fi
fi

MAJOR=$(echo "$BASE" | cut -d. -f1)
MINOR=$(echo "$BASE" | cut -d. -f2)
PATCH=$(echo "$BASE" | cut -d. -f3)

if echo "$LOG" | grep -qE '^[a-z]+(\([^)]*\))?!:|BREAKING CHANGE'; then
  MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0
elif echo "$LOG" | grep -qE '^feat(\([^)]*\))?:'; then
  MINOR=$((MINOR + 1)); PATCH=0
else
  PATCH=$((PATCH + 1))
fi

echo "$MAJOR.$MINOR.$PATCH"
