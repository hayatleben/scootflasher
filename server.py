#!/usr/bin/env python3
import gzip
import http.server
import json
import mimetypes
import os
import secrets
import socketserver
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get('PORT', '8000'))
LICENSE_CODES = {
    code.strip().upper()
    for code in os.environ.get('ROLLER_TUNE_CODES', 'ROLLER-TUNE-ACCESS,ROLLER-TUNE-2026,PRO-TUNING-2026-VIP').split(',')
    if code.strip()
}
CODES_FILE = ROOT / 'license_codes.json'
ADMIN_CODE = os.environ.get('ROLLER_TUNE_ADMIN_CODE', 'RT-OWNER-2026').strip().upper()
GENERATED_CODES = {}
if CODES_FILE.exists():
    try:
        GENERATED_CODES = json.loads(CODES_FILE.read_text())
        for entry in GENERATED_CODES.values():
            entry.setdefault('active', True)
            entry.setdefault('created', datetime.now().isoformat(timespec='seconds'))
        LICENSE_CODES.update(GENERATED_CODES.keys())
    except (OSError, json.JSONDecodeError):
        GENERATED_CODES = {}
STATIC_FILES = {
    '/': 'index.html',
    '/index.html': 'index.html',
    '/style.css': 'style.css',
    '/app.js': 'app.js',
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        if self.command == 'GET' and not self.path.startswith('/api/'):
            cache_policy = 'no-store' if urlparse(self.path).path in ('/', '/index.html') else 'public, max-age=3600'
            self.send_header('Cache-Control', cache_policy)
        if self.path.startswith('/api/'):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Code')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _json(self, payload, status=200):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == '/api/admin/unlock':
            payload = self._read_json()
            if payload is None:
                self._json({'valid': False, 'message': 'Invalid request body.'}, 400)
                return
            valid = str(payload.get('code', '')).strip().upper() == ADMIN_CODE
            self._json({'valid': valid, 'message': 'Admin unlocked.' if valid else 'Invalid admin code.'}, 200 if valid else 403)
            return
        if path == '/api/admin/create-code':
            if self.headers.get('X-Admin-Code', '').strip().upper() != ADMIN_CODE:
                self._json({'created': False, 'message': 'Admin access required.'}, 403)
                return
            payload = self._read_json()
            if payload is None:
                self._json({'created': False, 'message': 'Invalid request body.'}, 400)
                return
            label = str(payload.get('label', 'Customer')).strip()[:80] or 'Customer'
            code = f"RT-{secrets.token_hex(4).upper()}-{secrets.token_hex(3).upper()}"
            GENERATED_CODES[code] = {'label': label}
            LICENSE_CODES.add(code)
            CODES_FILE.write_text(json.dumps(GENERATED_CODES, indent=2))
            self._json({'created': True, 'code': code, 'label': label})
            return
        if path == '/api/admin/toggle-code':
            if self.headers.get('X-Admin-Code', '').strip().upper() != ADMIN_CODE:
                self._json({'ok': False, 'message': 'Admin access required.'}, 403)
                return
            payload = self._read_json()
            if payload is None:
                self._json({'ok': False, 'message': 'Invalid request body.'}, 400)
                return
            code = str(payload.get('code', '')).strip().upper()
            if code not in GENERATED_CODES:
                self._json({'ok': False, 'message': 'Unknown code.'}, 404)
                return
            GENERATED_CODES[code]['active'] = bool(payload.get('active'))
            CODES_FILE.write_text(json.dumps(GENERATED_CODES, indent=2))
            self._json({'ok': True, 'code': code, 'active': GENERATED_CODES[code]['active']})
            return
        if path != '/api/verify':
            self._json({'valid': False, 'message': 'Endpoint not found.'}, 404)
            return
        payload = self._read_json()
        if payload is None:
            self._json({'valid': False, 'message': 'Invalid request.'}, 400)
            return
        code = str(payload.get('code', '')).strip().upper()
        entry = GENERATED_CODES.get(code)
        if entry is not None and not entry.get('active', True):
            self._json({'valid': False, 'message': 'This license code has been blocked.'}, 403)
            return
        if code not in LICENSE_CODES:
            self._json({'valid': False, 'message': 'Invalid license code.'}, 403)
            return
        self._json({'valid': True, 'message': 'License accepted.'})

    def _read_json(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            return json.loads(self.rfile.read(length) or b'{}')
        except (ValueError, json.JSONDecodeError):
            return None

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/admin/codes':
            if self.headers.get('X-Admin-Code', '').strip().upper() != ADMIN_CODE:
                self._json({'error': 'Admin access required.'}, 403)
                return
            codes = [
                {'code': code, **info}
                for code, info in sorted(
                    GENERATED_CODES.items(),
                    key=lambda kv: kv[1].get('created', ''),
                    reverse=True
                )
            ]
            self._json({'codes': codes})
            return
        relative = STATIC_FILES.get(path)
        if relative:
            file_path = ROOT / relative
            body = file_path.read_bytes()
            accepts_gzip = 'gzip' in self.headers.get('Accept-Encoding', '')
            if accepts_gzip:
                body = gzip.compress(body, compresslevel=6)
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(str(file_path))[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Vary', 'Accept-Encoding')
            if accepts_gzip:
                self.send_header('Content-Encoding', 'gzip')
            self.end_headers()
            self.wfile.write(body)
            return
        self._json({'error': 'Not found.'}, 404)


class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    with ThreadingServer(('', PORT), Handler) as server:
        print(f'RollerTune server running at http://localhost:{PORT}')
        server.serve_forever()
