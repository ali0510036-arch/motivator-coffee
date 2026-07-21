#!/bin/bash
# Исправление: форма входа не скрывается после логина
set -e
APP_DIR="/var/www/motivator-coffee"
cd "$APP_DIR"

python3 << 'PY'
from pathlib import Path

css = Path("public/css/admin.css")
css_text = css.read_text(encoding="utf-8")
rule = """.admin-login[hidden],
.admin-panel[hidden],
.admin-login.is-hidden,
.admin-panel.is-hidden {
  display: none !important;
}

"""
if "is-hidden" not in css_text:
    css.write_text(rule + css_text, encoding="utf-8")
    print("admin.css patched")

js = Path("public/js/admin.js")
js_text = js.read_text(encoding="utf-8")
old_show = """function showPanel() {
  $('#loginScreen').hidden = true;
  $('#adminPanel').hidden = false;
  loadOrders();
}

function showLogin() {
  localStorage.removeItem(TOKEN_KEY);
  $('#loginScreen').hidden = false;
  $('#adminPanel').hidden = true;
}"""

new_show = """function showPanel() {
  const login = $('#loginScreen');
  const panel = $('#adminPanel');
  login.hidden = true;
  login.classList.add('is-hidden');
  panel.hidden = false;
  panel.classList.remove('is-hidden');
  loadOrders();
}

function showLogin() {
  localStorage.removeItem(TOKEN_KEY);
  const login = $('#loginScreen');
  const panel = $('#adminPanel');
  login.hidden = false;
  login.classList.remove('is-hidden');
  panel.hidden = true;
  panel.classList.add('is-hidden');
}"""

if old_show in js_text:
    js.write_text(js_text.replace(old_show, new_show), encoding="utf-8")
    print("admin.js patched")
elif "is-hidden" in js_text:
    print("admin.js already patched")
else:
    print("admin.js: manual update needed")

html = Path("public/admin.html")
html_text = html.read_text(encoding="utf-8")
html_text = html_text.replace('/css/admin.css"', '/css/admin.css?v=3"')
html_text = html_text.replace('/js/admin.js"', '/js/admin.js?v=4"')
html.write_text(html_text, encoding="utf-8")
print("admin.html cache bust updated")
PY

pm2 restart motivator
echo "Done. Open http://217.149.19.170/admin in incognito and login."
