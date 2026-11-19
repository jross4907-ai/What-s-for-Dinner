#!/usr/bin/env bash
# Builds index.html (the GitHub Pages copy) from app.html (the claude.ai artifact source).
# claude.ai wraps the artifact in a page with a mobile viewport; GitHub Pages needs that wrapper in the file.
set -euo pipefail
cd "$(dirname "$0")"
{
  printf '%s\n' '<!doctype html>' '<html lang="en">' '<head>' \
    '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' \
    '<meta name="theme-color" content="#EEF2EE" media="(prefers-color-scheme: light)">' \
    '<meta name="theme-color" content="#111613" media="(prefers-color-scheme: dark)">' \
    '<meta name="apple-mobile-web-app-capable" content="yes">' \
    '<meta name="mobile-web-app-capable" content="yes">' \
    '<meta name="apple-mobile-web-app-title" content="Dinner">' \
    '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);-webkit-text-size-adjust:100%;text-size-adjust:100%}body{margin:0;font:14px/1.5 system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>' \
    '</head>' '<body>'
  cat app.html
  printf '\n%s\n' '</body>' '</html>'
} > index.html
