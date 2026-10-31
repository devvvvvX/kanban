#!/usr/bin/env bash
# ==============================================================================
# run-tests.sh - Comprehensive Automated Test & Verification Runner for Kanban
# ==============================================================================
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo -e "${BOLD}${BLUE}=== Kanban Automated Verification Suite ===${NC}\n"

# Step 1: Typecheck
echo -e "${CYAN}[1/2] Checking TypeScript types (tsc --noEmit)...${NC}"
npm run typecheck
echo -e "${GREEN}✓ TypeScript compilation check passed.${NC}\n"

# Step 2: Vitest unit & integration tests
echo -e "${CYAN}[2/2] Running automated Vitest test suites...${NC}"
if [ $# -gt 0 ]; then
  npx vitest run "$@"
else
  npm test
fi
echo -e "\n${BOLD}${GREEN}✓ All verification suites passed successfully!${NC}"

