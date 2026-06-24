#!/usr/bin/env python3
"""
Dev server with no-cache headers.
Replaces `python3 -m http.server 8000` during debugging.
Sends Cache-Control: no-store on every response, so the browser
always fetches the latest JS modules.
"""

import http.server
import socketserver
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Aggressive no-cache for ALL responses
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        # Allow ES module loading from file:// and http://
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, format, *args):
        # Quieter logs
        pass


with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Serving with no-cache headers at http://localhost:{PORT}/")
    print(f"  Open in browser. Every request will fetch fresh files.")
    print(f"  Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        httpd.shutdown()
