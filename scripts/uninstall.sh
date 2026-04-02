#!/usr/bin/env bash
# Remove the globally installed @patternfly/patternfly-cli package from npm.
# Does not remove Node.js, nvm, Corepack, or GitHub CLI.

# Set script to stop on most failures.
set -euo pipefail

error() {
  printf '\n[%s] ERROR: %s\n\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
  exit 1
}

info() {
  printf '[uninstall] %s\n' "$*"
}

warn() {
  printf '[uninstall] WARNING: %s\n' "$*" >&2
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1
}

ensure_nvm_loaded() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    return 0
  fi
  return 1
}

ensure_node_for_npm() {
  if require_cmd node && require_cmd npm; then
    return 0
  fi
  if ensure_nvm_loaded; then
    nvm use default >/dev/null 2>&1 || true
  fi
  if require_cmd node && require_cmd npm; then
    return 0
  fi
  error "Node.js and npm are required to uninstall the package. Install Node or load nvm (see install script), then try again."
}

uninstall_patternfly_cli() {
  info "Removing @patternfly/patternfly-cli from global npm packages."
  npm uninstall -g @patternfly/patternfly-cli || error "npm failed to uninstall @patternfly/patternfly-cli. Check permissions and which Node/npm you are using ($(command -v npm 2>/dev/null || echo 'npm not found'))."
}

main() {
  info "Uninstalling PatternFly CLI (global npm package only)."
  ensure_node_for_npm
  uninstall_patternfly_cli

  if require_cmd patternfly-cli; then
    warn "patternfly-cli is still on PATH at $(command -v patternfly-cli). You may have another global install under a different Node version or runtime."
  fi

  printf '\n'
  printf 'SUCCESS: @patternfly/patternfly-cli has been removed from this npm global prefix.\n'
  printf '\n'
}

main "$@"
