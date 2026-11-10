#!/usr/bin/env bash
# LAM managed Codex proxy entry
set -euo pipefail

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
LAM_PROFILE_HOME="${CODEX_HOME%/}"
LAM_PROXY_PROFILE=""
case "$LAM_PROFILE_HOME" in
  "$HOME/.codex") LAM_PROXY_PROFILE="main" ;;
  "$HOME"/.codex-*) LAM_PROXY_PROFILE="${LAM_PROFILE_HOME#"$HOME/.codex-"}" ;;
esac
case "$LAM_PROXY_PROFILE" in
  *[!a-zA-Z0-9_-]*) LAM_PROXY_PROFILE="" ;;
esac

if [ -n "$LAM_PROXY_PROFILE" ]; then
  LAM_PROXY_FILE="${LAM_HOME:-$HOME}/.lam/config/account-proxies/$LAM_PROXY_PROFILE.json"
  if [ -f "$LAM_PROXY_FILE" ]; then
    LAM_PROXY_ENABLED="$(/usr/bin/plutil -extract enabled raw -o - "$LAM_PROXY_FILE")"
    if [ "$LAM_PROXY_ENABLED" = "true" ]; then
      LAM_PROXY_URL="$(/usr/bin/plutil -extract url raw -o - "$LAM_PROXY_FILE")"
      export HTTP_PROXY="$LAM_PROXY_URL" HTTPS_PROXY="$LAM_PROXY_URL" ALL_PROXY="$LAM_PROXY_URL"
      export http_proxy="$LAM_PROXY_URL" https_proxy="$LAM_PROXY_URL" all_proxy="$LAM_PROXY_URL"
      export NO_PROXY="localhost,127.0.0.1,::1" no_proxy="localhost,127.0.0.1,::1"
    fi
  fi
fi

CODEX_BIN="${CODEX_BIN:-}"
if [ -z "$CODEX_BIN" ]; then
  IFS=: read -r -a LAM_CODEX_PATH_ENTRIES <<< "${PATH:-}"
  for LAM_CODEX_DIRECTORY in "${LAM_CODEX_PATH_ENTRIES[@]}"; do
    LAM_CODEX_CANDIDATE="${LAM_CODEX_DIRECTORY:-.}/codex"
    # cmux already wraps this invocation; returning to its shim creates a cycle.
    case "$LAM_CODEX_CANDIDATE" in
      */cmux-cli-shims/*/codex|*/cmux-cli-shims/codex) continue ;;
    esac
    if [ -n "${CMUX_CODEX_WRAPPER_SHIM:-}" ] && [ "$LAM_CODEX_CANDIDATE" -ef "$CMUX_CODEX_WRAPPER_SHIM" ]; then
      continue
    fi
    if [ -f "$LAM_CODEX_CANDIDATE" ] && [ -x "$LAM_CODEX_CANDIDATE" ] && ! [ "$LAM_CODEX_CANDIDATE" -ef "$0" ]; then
      CODEX_BIN="$LAM_CODEX_CANDIDATE"
      break
    fi
  done
fi

if [ -z "$CODEX_BIN" ] || [ ! -x "$CODEX_BIN" ]; then
  echo "Original codex command not found. Install Codex or set CODEX_BIN=/path/to/codex." >&2
  exit 127
fi
if [ "$CODEX_BIN" -ef "$0" ]; then
  echo "CODEX_BIN points to the LAM entry itself; use the original Codex executable." >&2
  exit 126
fi
exec "$CODEX_BIN" "$@"
