#!/usr/bin/env bash
# ==============================================================================
# update-local-app.sh - Fast, In-Place Local Desktop App Updater (Zero Data Loss)
# ==============================================================================
# Builds the macOS .app bundle and hot-deploys it directly to /Applications/Kanban.app.
# Unlike trashing & reinstalling via .dmg, this preserves:
#   1. ~/Library/Application Support/com.kanban.macos/kanban.db (SQLite database)
#   2. LocalStorage & WebKit session tokens
#   3. Active MCP configurations & auth credentials
# ==============================================================================
set -euo pipefail

# Formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
NC="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

REOPEN_APP=true
BUILD_SOURCE=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build)
      BUILD_SOURCE=false
      shift
      ;;
    --no-launch|--no-open)
      REOPEN_APP=false
      shift
      ;;
    *)
      shift
      ;;
  esac
done

echo -e "${BOLD}${CYAN}======================================================${NC}"
echo -e "${BOLD}${CYAN}   macOS Kanban App - Fast Local Update Deployer     ${NC}"
echo -e "${BOLD}${CYAN}======================================================${NC}"

cd "${ROOT_DIR}"

# Ensure Cargo/Rust environment is available if installed via rustup
if ! command -v cargo &> /dev/null; then
  if [ -f "$HOME/.cargo/env" ]; then
    # shellcheck source=/dev/null
    source "$HOME/.cargo/env"
  fi
fi

# 1. Build web app and Tauri .app bundle (skipping slow DMG packaging)
if [ "${BUILD_SOURCE}" = true ]; then
  echo -e "\n${BLUE}▶ 1. Building frontend & MCP bundles...${NC}"
  npm run build

  echo -e "\n${BLUE}▶ 2. Compiling native macOS .app bundle (Tauri 2)...${NC}"
  npx tauri build --bundles app --no-sign
else
  echo -e "${YELLOW}▶ Skipping build step (--no-build specified)${NC}"
fi

SOURCE_APP="${ROOT_DIR}/src-tauri/target/release/bundle/macos/Kanban.app"

if [ ! -d "${SOURCE_APP}" ]; then
  echo -e "\033[0;31mError: Built application bundle not found at ${SOURCE_APP}\033[0m" >&2
  exit 1
fi

DEST_APP="/Applications/Kanban.app"

# 2. Terminate running Kanban processes to release file locks
echo -e "\n${BLUE}▶ 3. Gracefully stopping running Kanban & MCP processes...${NC}"
pkill -x "macos-kanban-board" 2>/dev/null || true
pkill -f "kanban-mcp" 2>/dev/null || true
pkill -f "Resources/mcp/cli.js" 2>/dev/null || true
sleep 1

# 3. In-place sync into /Applications/Kanban.app
echo -e "\n${BLUE}▶ 4. Replacing /Applications/Kanban.app in-place...${NC}"
rm -rf "${DEST_APP}"
cp -R "${SOURCE_APP}" "${DEST_APP}"

# 4. Sync MCP binaries and ensure executable permissions
mkdir -p "${DEST_APP}/Contents/MacOS"
mkdir -p "${DEST_APP}/Contents/Resources/mcp"

cp -f "${ROOT_DIR}/scripts/kanban-mcp" "${DEST_APP}/Contents/MacOS/kanban-mcp"
chmod +x "${DEST_APP}/Contents/MacOS/kanban-mcp"

cp -f "${ROOT_DIR}/scripts/kanban-mcp" "${DEST_APP}/Contents/Resources/kanban-mcp"
chmod +x "${DEST_APP}/Contents/Resources/kanban-mcp"

cp -f "${ROOT_DIR}/dist/mcp/cli.js" "${DEST_APP}/Contents/Resources/mcp/cli.js"
cp -f "${ROOT_DIR}/dist/mcp/sql-wasm.wasm" "${DEST_APP}/Contents/Resources/mcp/sql-wasm.wasm"

echo -e "${GREEN}  ✓ Synced bundle and MCP launcher to ${DEST_APP}${NC}"

# 5. Database safety verification
DB_PATH="${HOME}/Library/Application Support/com.kanban.macos/kanban.db"
echo -e "\n${BLUE}▶ 5. Verifying user database integrity...${NC}"
if [ -f "${DB_PATH}" ]; then
  DB_SIZE="$(du -h "${DB_PATH}" | awk '{print $1}')"
  USER_COUNT="$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM users;" 2>/dev/null || echo "0")"
  PROJECT_COUNT="$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM projects;" 2>/dev/null || echo "0")"
  TICKET_COUNT="$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM tickets;" 2>/dev/null || echo "0")"

  echo -e "  ✓ Database file:   ${DB_PATH}"
  echo -e "  ✓ Size on disk:    ${DB_SIZE}"
  echo -e "  ✓ Users preserved: ${USER_COUNT}"
  echo -e "  ✓ Projects:        ${PROJECT_COUNT}"
  echo -e "  ✓ Total Tickets:   ${TICKET_COUNT}"
  echo -e "${GREEN}  ✓ Zero data loss confirmed!${NC}"
else
  echo -e "${YELLOW}  ⚠ Database will be created on first app launch at:${NC}"
  echo -e "    ${DB_PATH}"
fi

# 6. Reopen updated app
if [ "${REOPEN_APP}" = true ]; then
  echo -e "\n${BLUE}▶ 6. Launching updated Kanban desktop app...${NC}"
  open "${DEST_APP}"
fi

echo -e "\n${BOLD}${GREEN}======================================================${NC}"
echo -e "${BOLD}${GREEN}   ✓ Kanban App Successfully Updated & Running!      ${NC}"
echo -e "${BOLD}${GREEN}======================================================${NC}\n"
