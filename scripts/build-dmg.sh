#!/usr/bin/env bash
# ==============================================================================
# build-dmg.sh - Production Release DMG Build Script for macOS Kanban App
# ==============================================================================
set -euo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m"

# Project root directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Default configurations
TARGET=""
SIGN_FLAG="--no-sign"
OUT_DIR="${ROOT_DIR}/release"
DO_CLEAN=false
SKIP_TESTS=false

# Print help message
show_help() {
  echo -e "${BOLD}Usage:${NC} $(basename "$0") [OPTIONS]

Build production release macOS DMG installer for Kanban desktop app.

${BOLD}Options:${NC}
  -t, --target <TRIPLE>     Target architecture (e.g., aarch64-apple-darwin, x86_64-apple-darwin, universal-apple-darwin)
  -s, --sign                Enforce code signing (requires configured Apple Developer Identity)
  -u, --no-sign             Skip code signing (default, ideal for local builds & testing)
  -o, --out-dir <DIR>       Destination directory for generated DMG (default: ./release)
      --clean               Clean previous build artifacts before building
      --skip-tests          Skip running automated test suite prior to build
  -h, --help                Show this help message

${BOLD}Examples:${NC}
  ./scripts/build-dmg.sh                                  # Build DMG for current architecture
  ./scripts/build-dmg.sh --target universal-apple-darwin  # Build universal binary DMG
  ./scripts/build-dmg.sh --clean --out-dir ./dist-dmg     # Clean build into custom directory
  npm run build:dmg                                      # Build via npm script"
}

# Parse command-line options
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target)
      TARGET="$2"
      shift 2
      ;;
    -s|--sign)
      SIGN_FLAG=""
      shift
      ;;
    -u|--no-sign)
      SIGN_FLAG="--no-sign"
      shift
      ;;
    -o|--out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    --clean)
      DO_CLEAN=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown option $1${NC}" >&2
      show_help
      exit 1
      ;;
  esac
done

echo -e "${BOLD}${CYAN}======================================================${NC}"
echo -e "${BOLD}${CYAN}   macOS Kanban App - Production DMG Builder         ${NC}"
echo -e "${BOLD}${CYAN}======================================================${NC}"

# 1. Environment & OS check
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo -e "${RED}Error: DMG packaging is only supported on macOS (Darwin).${NC}" >&2
  exit 1
fi

CURRENT_ARCH="$(uname -m)"
echo -e "${BLUE}▶ Host System:${NC} macOS ($(sw_vers -productVersion 2>/dev/null || echo "Darwin")) [${CURRENT_ARCH}]"

# 2. Check required developer tools
echo -e "${BLUE}▶ Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js is not installed or not in PATH.${NC}" >&2
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm is not installed or not in PATH.${NC}" >&2
  exit 1
fi

if ! command -v cargo &> /dev/null; then
  if [ -f "$HOME/.cargo/env" ]; then
    # shellcheck source=/dev/null
    source "$HOME/.cargo/env"
  fi
fi

if ! command -v cargo &> /dev/null; then
  echo -e "${RED}Error: Cargo (Rust) is not installed or not in PATH.${NC}" >&2
  echo -e "${YELLOW}  Install Rust via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y${NC}" >&2
  echo -e "${YELLOW}  Then source it:   source \"\$HOME/.cargo/env\"${NC}" >&2
  exit 1
fi

if ! command -v rustc &> /dev/null; then
  echo -e "${RED}Error: Rustc is not installed or not in PATH.${NC}" >&2
  exit 1
fi

echo -e "  ✓ Node:  $(node --version)"
echo -e "  ✓ Rust:  $(rustc --version | awk '{print $1, $2}')"
echo -e "  ✓ Cargo: $(cargo --version | awk '{print $1, $2}')"

# 3. Optional clean
cd "${ROOT_DIR}"
if [ "${DO_CLEAN}" = true ]; then
  echo -e "${YELLOW}▶ Cleaning previous build artifacts...${NC}"
  rm -rf "${ROOT_DIR}/dist"
  rm -rf "${OUT_DIR}"
  cargo clean --manifest-path "${ROOT_DIR}/src-tauri/Cargo.toml"
  echo -e "  ✓ Clean completed"
fi

# 4. Run automated test suite (if not skipped)
if [ "${SKIP_TESTS}" = false ]; then
  echo -e "${BLUE}▶ Running automated test suite (Vitest)...${NC}"
  npx vitest run
  echo -e "${GREEN}  ✓ All test suites passed cleanly${NC}"
else
  echo -e "${YELLOW}▶ Skipping automated tests (--skip-tests active)${NC}"
fi

# 5. Typecheck & Frontend Production Build
echo -e "${BLUE}▶ Building web application assets (Vite + TypeScript)...${NC}"
npm run build
echo -e "${GREEN}  ✓ Frontend production bundle generated in ./dist${NC}"

# 6. Build Tauri Production DMG
echo -e "${BLUE}▶ Packaging macOS Release DMG with Tauri 2...${NC}"

TAURI_ARGS=(build --bundles dmg)

if [ -n "${SIGN_FLAG}" ]; then
  TAURI_ARGS+=("${SIGN_FLAG}")
fi

if [ -n "${TARGET}" ]; then
  echo -e "  Compiling for target: ${TARGET}"
  TAURI_ARGS+=(--target "${TARGET}")
fi

npx tauri "${TAURI_ARGS[@]}"

# 7. Locate generated DMG file
if [ -n "${TARGET}" ]; then
  DMG_SOURCE_DIR="${ROOT_DIR}/src-tauri/target/${TARGET}/release/bundle/dmg"
else
  DMG_SOURCE_DIR="${ROOT_DIR}/src-tauri/target/release/bundle/dmg"
fi

GENERATED_DMG="$(find "${DMG_SOURCE_DIR}" -name "*.dmg" -maxdepth 1 2>/dev/null | head -n 1)"

if [ -z "${GENERATED_DMG}" ] || [ ! -f "${GENERATED_DMG}" ]; then
  echo -e "${RED}Error: Generated DMG bundle not found in ${DMG_SOURCE_DIR}.${NC}" >&2
  exit 1
fi

DMG_FILENAME="$(basename "${GENERATED_DMG}")"

# 8. Copy to output directory
mkdir -p "${OUT_DIR}"
FINAL_DMG_PATH="${OUT_DIR}/${DMG_FILENAME}"
cp -f "${GENERATED_DMG}" "${FINAL_DMG_PATH}"

# 9. Calculate SHA-256 Checksum
CHECKSUM_FILE="${FINAL_DMG_PATH}.sha256"
shasum -a 256 "${FINAL_DMG_PATH}" > "${CHECKSUM_FILE}"
CHECKSUM_VALUE="$(awk '{print $1}' "${CHECKSUM_FILE}")"

# 10. File size
FILE_SIZE="$(du -h "${FINAL_DMG_PATH}" | awk '{print $1}')"

# 11. Sync MCP Release Binary into local /Applications/Kanban.app if present
if [ -d "/Applications/Kanban.app" ]; then
  echo -e "${BLUE}▶ Syncing updated MCP binary to /Applications/Kanban.app...${NC}"
  mkdir -p "/Applications/Kanban.app/Contents/MacOS"
  mkdir -p "/Applications/Kanban.app/Contents/Resources/mcp"
  cp -f "${ROOT_DIR}/scripts/kanban-mcp" "/Applications/Kanban.app/Contents/MacOS/kanban-mcp"
  chmod +x "/Applications/Kanban.app/Contents/MacOS/kanban-mcp"
  cp -f "${ROOT_DIR}/dist/mcp/cli.js" "/Applications/Kanban.app/Contents/Resources/mcp/cli.js"
  cp -f "${ROOT_DIR}/dist/mcp/sql-wasm.wasm" "/Applications/Kanban.app/Contents/Resources/mcp/sql-wasm.wasm"
  echo -e "${GREEN}  ✓ Synced /Applications/Kanban.app/Contents/MacOS/kanban-mcp${NC}"
fi

# 12. Final Summary Report
echo -e "\n${BOLD}${GREEN}======================================================${NC}"
echo -e "${BOLD}${GREEN}   ✓ Production Release DMG Built Successfully!      ${NC}"
echo -e "${BOLD}${GREEN}======================================================${NC}"
echo -e "${BOLD}File:${NC}       ${FINAL_DMG_PATH}"
echo -e "${BOLD}Size:${NC}       ${FILE_SIZE}"
echo -e "${BOLD}SHA-256:${NC}    ${CHECKSUM_VALUE}"
echo -e "${BOLD}Checksum:${NC}   ${CHECKSUM_FILE}"
echo -e "${BOLD}Target:${NC}     ${TARGET:-current (${CURRENT_ARCH})}"
echo -e "------------------------------------------------------"
echo -e "To mount and test the installer:"
echo -e "  ${CYAN}open \"${FINAL_DMG_PATH}\"${NC}"
echo -e "------------------------------------------------------\n"
