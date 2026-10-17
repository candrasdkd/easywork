#!/usr/bin/env python3
"""HTTP API that renders uploaded Easywork certificate workbooks to PDF."""

from __future__ import annotations

import json
import os
import threading
import tempfile
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

from print_certificates import create_pdf


MAX_UPLOAD_BYTES = 150 * 1024 * 1024
PRINT_SLOT = threading.BoundedSemaphore(1)


def auth_is_required() -> bool:
    return os.environ.get("EASYWORK_REQUIRE_AUTH", "").strip().lower() in {"1", "true", "yes"}


def allowed_origins() -> set[str]:
    configured = os.environ.get(
        "EASYWORK_ALLOWED_ORIGINS",
        "https://easywork.vercel.app,http://localhost:5173,http://127.0.0.1:5173",
    )
    return {origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()}


def verify_firebase_token(token: str) -> bool:
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "easywork-483f9").strip()
    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import id_token

        decoded = id_token.verify_firebase_token(token, Request(), audience=project_id)
        return (
            decoded.get("iss") == f"https://securetoken.google.com/{project_id}"
            and bool(decoded.get("sub"))
        )
    except Exception:
        return False


def parse_multipart(content_type: str, body: bytes) -> dict[str, tuple[str, bytes]]:
    headers = (
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("latin-1")
    )
    message = BytesParser(policy=policy.default).parsebytes(headers + body)
    if not message.is_multipart():
        raise ValueError("Form unggahan tidak valid.")

    fields: dict[str, tuple[str, bytes]] = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        filename = part.get_filename() or ""
        value = part.get_payload(decode=True) or b""
        fields[str(name)] = (str(filename), value)
    return fields


class CertificatePrintHandler(BaseHTTPRequestHandler):
    server_version = "EasyworkCertificateAPI/1.0"

    def _origin_is_allowed(self) -> bool:
        origin = self.headers.get("Origin", "").rstrip("/")
        return not origin or origin in allowed_origins()

    def _add_cors_headers(self) -> None:
        origin = self.headers.get("Origin", "").rstrip("/")
        if origin and origin in allowed_origins():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def _authorized(self) -> bool:
        if not auth_is_required():
            return True
        authorization = self.headers.get("Authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            return False
        return verify_firebase_token(token.strip())

    def do_GET(self) -> None:
        if not self._origin_is_allowed():
            self.send_error(403, "Origin tidak diizinkan.")
            return
        if self.path.rstrip("/") == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self._add_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"ready":true}')
            return
        self.send_error(404)

    def do_OPTIONS(self) -> None:
        if self.path.split("?", 1)[0] != "/api/certificate-print":
            self.send_error(404)
            return
        if not self._origin_is_allowed():
            self.send_error(403, "Origin tidak diizinkan.")
            return
        self.send_response(204)
        self._add_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/api/certificate-print":
            self.send_error(404)
            return
        if not self._origin_is_allowed():
            self._send_json_error("Origin tidak diizinkan.", status=403)
            return
        if not self._authorized():
            self._send_json_error("Sesi login tidak valid atau sudah kedaluwarsa. Silakan login ulang.", status=401)
            return
        if not PRINT_SLOT.acquire(blocking=False):
            self._send_json_error("Layanan sedang membuat PDF lain. Tunggu sebentar lalu coba lagi.", status=429)
            return

        try:
            self._create_pdf_response()
        finally:
            PRINT_SLOT.release()

    def _create_pdf_response(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_UPLOAD_BYTES:
                raise ValueError("Ukuran unggahan kosong atau melebihi batas 150 MB.")
            content_type = self.headers.get("Content-Type", "")
            body = self.rfile.read(length)
            fields = parse_multipart(content_type, body)

            uploaded_name, workbook_bytes = fields.get("file", ("", b""))
            if not workbook_bytes:
                raise ValueError("Pilih file Excel terlebih dahulu.")
            if Path(unquote(uploaded_name)).suffix.lower() != ".xlsx":
                raise ValueError("Pilih workbook berformat .xlsx.")

            try:
                selected_numbers = json.loads(fields.get("selectedNumbers", ("", b"[]"))[1].decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ValueError("Daftar sertifikat terpilih tidak valid.") from exc
            if not isinstance(selected_numbers, list) or not selected_numbers:
                raise ValueError("Pilih minimal satu sertifikat.")

            total_pages_text = fields.get("totalPages", ("", b"1"))[1].decode("utf-8").strip()
            try:
                total_pages = int(total_pages_text)
            except ValueError as exc:
                raise ValueError("Total halaman harus berupa angka bulat.") from exc
            if not 1 <= total_pages <= 999:
                raise ValueError("Total halaman harus antara 1 sampai 999.")

            soffice_text = os.environ.get("EASYWORK_SOFFICE_PATH", "soffice")
            soffice = Path(soffice_text).expanduser()
            with tempfile.TemporaryDirectory(prefix="easywork-web-print-") as temp_text:
                temp_dir = Path(temp_text)
                uploaded_workbook = temp_dir / "source.xlsx"
                output_pdf = temp_dir / "Sertifikat.pdf"
                uploaded_workbook.write_bytes(workbook_bytes)
                generated_pdf = create_pdf(
                    uploaded_workbook,
                    soffice,
                    selected_numbers=selected_numbers,
                    total_pages=total_pages,
                    output_pdf=output_pdf,
                )
                pdf_bytes = generated_pdf.read_bytes()

            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", 'attachment; filename="Sertifikat.pdf"')
            self.send_header("Content-Length", str(len(pdf_bytes)))
            self.send_header("Cache-Control", "no-store")
            self._add_cors_headers()
            self.end_headers()
            self.wfile.write(pdf_bytes)
        except Exception as exc:  # Return actionable processing errors to the page.
            self._send_json_error(str(exc))

    def _send_json_error(self, message: str, status: int = 400) -> None:
        payload = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self._add_cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: object) -> None:
        print(f"[cetak-sertifikat] {format % args}")


def main() -> None:
    host = os.environ.get("EASYWORK_CERTIFICATE_API_HOST", "127.0.0.1")
    port = int(os.environ.get("EASYWORK_CERTIFICATE_API_PORT", os.environ.get("PORT", "8787")))
    server = ThreadingHTTPServer((host, port), CertificatePrintHandler)
    print(f"API cetak sertifikat siap di http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
