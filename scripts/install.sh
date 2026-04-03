#!/usr/bin/env bash
# Install Node (via nvm + Node.js 24 when Node is missing), enable Corepack,
# install GitHub CLI when missing, and install @patternfly/patternfly-cli globally.

set -euo pipefail

if [ -z "${HOME:-}" ]; then
  printf '\nERROR: HOME is not set. Set it to your home directory and re-run this script.\n\n' >&2
  exit 1
fi

NVM_VERSION="${NVM_VERSION:-v0.40.3}"

error() {
  printf '\n[%s] ERROR: %s\n\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
  exit 1
}

info() {
  printf '[install] %s\n' "$*"
}

warn() {
  printf '[install] WARNING: %s\n' "$*" >&2
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1
}

# Run a command with elevation only when needed (non-root). Root can omit sudo.
run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    require_cmd sudo || error "sudo is required to install system packages (install sudo or run this script as root)."
    sudo "$@"
  fi
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

install_node_via_nvm() {
  info "Node.js not found. Installing nvm (${NVM_VERSION}) and Node.js 24."
  if ! require_cmd curl && ! require_cmd wget; then
    error "Need curl or wget to install nvm. Install one of them and re-run this script."
  fi

  if [ ! -d "$HOME/.nvm" ]; then
    local install_url="https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh"
    if require_cmd curl; then
      curl -fsSL "$install_url" | bash || error "Failed to install nvm."
    else
      wget -qO- "$install_url" | bash || error "Failed to install nvm."
    fi
  else
    info "nvm is already present at ${HOME}/.nvm"
  fi

  ensure_nvm_loaded || error "nvm was installed but nvm.sh could not be loaded from ${NVM_DIR}/nvm.sh."

  nvm install 24 || error "nvm failed to install Node.js 24."
  nvm use 24 || error "nvm failed to activate Node.js 24."
  nvm alias default 24 2>/dev/null || true

  info "Node.js $(node --version) and npm $(npm --version) are ready (npm ships with this Node release)."
}

ensure_node() {
  if require_cmd node && require_cmd npm && require_cmd corepack; then
    info "Node.js is already installed: $(command -v node) ($(node --version)), npm $(npm --version)"
    return 0
  fi
  if require_cmd node; then
    error "Node.js is on PATH but this installer also requires npm and Corepack (corepack). Install a full Node.js toolchain, then re-run."
  fi
  install_node_via_nvm
}

ensure_nvm_in_path_for_npm_globals() {
  # If node came from nvm but this shell never sourced nvm, try to load it.
  if ! require_cmd node; then
    ensure_nvm_loaded && nvm use default >/dev/null 2>&1 || true
  fi
  if require_cmd node; then
    return 0
  fi
  error "Node.js is not available in PATH after setup."
}

install_gh_macos() {
  if require_cmd brew; then
    info "Installing GitHub CLI with Homebrew."
    brew install gh || error "Homebrew failed to install gh. See messages above."
    return 0
  fi
  error "GitHub CLI is not installed and Homebrew was not found. Install Homebrew from https://brew.sh then re-run, or install gh manually from https://cli.github.com/."
}

install_gh_linux_apt() {
  info "Installing GitHub CLI with apt (Debian/Ubuntu)."
  run_as_root apt-get update -y || error "apt-get update failed."
  if ! require_cmd curl; then
    run_as_root apt-get install -y curl || error "Failed to install curl (needed for GitHub CLI apt setup)."
  fi
  run_as_root install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg |
    run_as_root tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null || error "Failed to add GitHub CLI apt key."
  run_as_root chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" |
    run_as_root tee /etc/apt/sources.list.d/github-cli.list >/dev/null || error "Failed to add GitHub CLI apt source."
  run_as_root apt-get update -y || error "apt-get update failed after adding GitHub CLI source."
  run_as_root apt-get install -y gh || error "apt failed to install gh."
}

install_gh_linux_dnf() {
  info "Installing GitHub CLI with dnf (Fedora/RHEL-compatible)."
  run_as_root dnf install -y 'dnf-command(config-manager)' || warn "dnf-command(config-manager) may already be installed; continuing."
  local gh_repo="https://cli.github.com/packages/rpm/gh-cli.repo"
  # DNF 5 (Fedora 41+): addrepo --from-repofile=. DNF 4: --add-repo URL
  # See https://dnf5.readthedocs.io/en/stable/dnf5_plugins/config-manager.8.html
  if dnf config-manager addrepo --help >/dev/null 2>&1; then
    run_as_root dnf config-manager addrepo --from-repofile="${gh_repo}" || error "Failed to add gh dnf repository."
  else
    run_as_root dnf config-manager --add-repo "${gh_repo}" || error "Failed to add gh dnf repository."
  fi
  run_as_root dnf install -y gh || error "dnf failed to install gh."
}

install_gh_linux_yum() {
  info "Installing GitHub CLI with yum (older RHEL/CentOS)."
  run_as_root yum install -y yum-utils || error "yum-utils installation failed."
  run_as_root yum-config-manager --add-repo https://cli.github.com/packages/rpm/gh-cli.repo || error "Failed to add gh yum repository."
  run_as_root yum install -y gh || error "yum failed to install gh."
}

install_gh_linux_pacman() {
  info "Installing GitHub CLI with pacman (Arch)."
  run_as_root pacman -Syu --noconfirm github-cli || error "pacman failed to install github-cli."
}

install_gh_linux_zypper() {
  info "Installing GitHub CLI with zypper (openSUSE)."
  run_as_root zypper refresh
  run_as_root zypper install -y gh || error "zypper failed to install gh."
}

install_gh_linux_apk() {
  info "Installing GitHub CLI with apk (Alpine)."
  run_as_root apk add --no-cache github-cli || error "apk failed to install github-cli."
}

install_gh_linux() {
  if [ ! -r /etc/os-release ]; then
    error "Cannot read /etc/os-release. Install gh manually: https://cli.github.com/manual/installation"
  fi
  # shellcheck source=/dev/null
  . /etc/os-release
  local id_lc
  id_lc="$(printf '%s' "${ID:-unknown}" | tr '[:upper:]' '[:lower:]')"

  case "$id_lc" in
    ubuntu | debian | linuxmint | pop | elementary | zorin | kali)
      install_gh_linux_apt
      ;;
    fedora | nobara | ultramarine)
      install_gh_linux_dnf
      ;;
    rhel | centos | rocky | almalinux)
      if require_cmd dnf; then
        install_gh_linux_dnf
      else
        install_gh_linux_yum
      fi
      ;;
    arch | manjaro | endeavouros)
      install_gh_linux_pacman
      ;;
    opensuse-tumbleweed | opensuse-leap | sled | sles)
      install_gh_linux_zypper
      ;;
    alpine)
      install_gh_linux_apk
      ;;
    *)
      if printf '%s' "${ID_LIKE:-}" | tr '[:upper:]' '[:lower:]' | grep -qE '(debian|ubuntu)'; then
        install_gh_linux_apt
      elif printf '%s' "${ID_LIKE:-}" | tr '[:upper:]' '[:lower:]' | grep -q 'fedora'; then
        install_gh_linux_dnf
      elif printf '%s' "${ID_LIKE:-}" | tr '[:upper:]' '[:lower:]' | grep -q 'rhel\|centos'; then
        if require_cmd dnf; then
          install_gh_linux_dnf
        else
          install_gh_linux_yum
        fi
      else
        error "Unsupported Linux distribution: ${ID:-unknown}. Install gh manually from https://cli.github.com/manual/installation"
      fi
      ;;
  esac
}

ensure_gh() {
  if require_cmd gh; then
    info "GitHub CLI is already installed: $(command -v gh) ($(gh --version 2>/dev/null | head -n1 || echo 'version unknown'))"
    return 0
  fi

  case "$(uname -s)" in
    Darwin)
      install_gh_macos
      ;;
    Linux)
      install_gh_linux
      ;;
    *)
      error "Unsupported OS: $(uname -s). Install gh manually from https://cli.github.com/."
      ;;
  esac
}

enable_corepack_step() {
  info "Enabling Corepack."
  corepack enable || error "corepack enable failed. Ensure Node.js is recent enough (16.9+) and try again."
}

install_patternfly_cli() {
  info "Installing @patternfly/patternfly-cli globally from npm."
  npm install -g @patternfly/patternfly-cli || error "npm failed to install @patternfly/patternfly-cli globally. Check permissions and your network."
}

main() {
  info "Starting PatternFly CLI environment setup."
  ensure_node
  ensure_nvm_in_path_for_npm_globals
  enable_corepack_step
  ensure_gh
  install_patternfly_cli

  printf 'To see available commands, run the CLI with:\n'
  printf '  patternfly-cli --help\n'
  printf '\n'
  printf '\n'
  printf 'SUCCESS: PatternFly CLI is installed.\n'
  printf '\n'
  
}

main "$@"
