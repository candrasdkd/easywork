#!/usr/bin/env python3
"""Build one combined PDF from the dynamic Sertifikat sheet in a Tual workbook."""

from __future__ import annotations

import posixpath
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

try:
    import openpyxl
    from pypdf import PdfReader, PdfWriter
except ImportError as exc:
    raise SystemExit(
        "Komponen Python belum tersedia. Jalankan skrip ini dari paket Easywork "
        "yang menyertainya, atau hubungi pembuat skrip."
    ) from exc


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": DOC_REL_NS, "p": PKG_REL_NS}


def excel_sheet_part(archive: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relation.attrib["Id"]: relation.attrib["Target"]
        for relation in relationships.findall("p:Relationship", NS)
    }
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        if sheet.attrib.get("name") != sheet_name:
            continue
        target = targets[sheet.attrib[f"{{{DOC_REL_NS}}}id"]]
        if target.startswith("/"):
            return target.lstrip("/")
        return posixpath.normpath(posixpath.join("xl", target))
    raise ValueError(f"Sheet {sheet_name!r} tidak ditemukan.")


def set_cell_value(sheet_root: ET.Element, address: str, value: object) -> bool:
    cell = sheet_root.find(f".//m:c[@r='{address}']", NS)
    if cell is None:
        return False
    cell.attrib.pop("t", None)
    formula = cell.find("m:f", NS)
    if formula is not None:
        cell.remove(formula)
    value_cell = cell.find("m:v", NS)
    if value_cell is None:
        value_cell = ET.SubElement(cell, f"{{{MAIN_NS}}}v")
    value_cell.text = str(value)
    return True


def make_one_workbook(
    source: Path,
    destination: Path,
    selector_value: object,
    total_pages: int | None = None,
) -> None:
    with zipfile.ZipFile(source, "r") as original:
        workbook_part = "xl/workbook.xml"
        certificate_part = excel_sheet_part(original, "Sertifikat")
        rekap_part = excel_sheet_part(original, "REKAP")
        with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as output:
            for item in original.infolist():
                data = original.read(item.filename)
                if item.filename == workbook_part:
                    root = ET.fromstring(data)
                    for sheet in root.findall("m:sheets/m:sheet", NS):
                        if sheet.attrib.get("name") == "REKAP":
                            sheet.set("state", "hidden")
                        elif sheet.attrib.get("name") == "Sertifikat":
                            sheet.attrib.pop("state", None)

                    views = root.find("m:bookViews/m:workbookView", NS)
                    if views is not None:
                        views.set("activeTab", "1")
                        views.set("firstSheet", "1")

                    calculation = root.find("m:calcPr", NS)
                    if calculation is None:
                        calculation = ET.SubElement(root, f"{{{MAIN_NS}}}calcPr")
                    calculation.set("calcMode", "auto")
                    calculation.set("fullCalcOnLoad", "1")
                    calculation.set("forceFullCalc", "1")
                    data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
                elif item.filename == certificate_part:
                    root = ET.fromstring(data)
                    selector = root.find(".//m:c[@r='P7']", NS)
                    if selector is None:
                        raise ValueError("Sel P7 pada sheet Sertifikat tidak ditemukan.")
                    selector.attrib.pop("t", None)
                    value_cell = selector.find("m:v", NS)
                    if value_cell is None:
                        value_cell = ET.SubElement(selector, f"{{{MAIN_NS}}}v")
                    value_cell.text = str(selector_value)
                    if total_pages is not None:
                        set_cell_value(root, "M48", total_pages)
                        set_cell_value(root, "M49", total_pages)
                    for cell in root.findall(".//m:c", NS):
                        if cell.find("m:f", NS) is not None:
                            cached_value = cell.find("m:v", NS)
                            if cached_value is not None:
                                cell.remove(cached_value)
                    data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
                elif item.filename.startswith("xl/worksheets/") and item.filename.endswith(".xml"):
                    root = ET.fromstring(data)
                    for cell in root.findall(".//m:c", NS):
                        if cell.find("m:f", NS) is not None:
                            cached_value = cell.find("m:v", NS)
                            if cached_value is not None:
                                cell.remove(cached_value)
                    data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
                elif item.filename == rekap_part:
                    # Keep the source data in place; only its visibility changes above.
                    pass
                output.writestr(item, data)


def collect_record_numbers(workbook_path: Path) -> list[object]:
    workbook = openpyxl.load_workbook(workbook_path, data_only=True, read_only=True)
    try:
        if "REKAP" not in workbook.sheetnames or "Sertifikat" not in workbook.sheetnames:
            raise ValueError("Workbook harus memiliki sheet REKAP dan Sertifikat.")
        rekap = workbook["REKAP"]
        numbers = [
            row[0]
            for row in rekap.iter_rows(min_row=2, min_col=1, max_col=1, values_only=True)
            if row[0] is not None and str(row[0]).strip()
        ]
        if not numbers:
            raise ValueError("Tidak ada nomor data di kolom A sheet REKAP.")
        return numbers
    finally:
        workbook.close()


def unique_pdf_path(source: Path) -> Path:
    candidate = source.with_name(f"{source.stem}_SEMUA_SERTIFIKAT.pdf")
    if not candidate.exists():
        return candidate
    suffix = datetime.now().strftime("%Y%m%d_%H%M%S")
    return source.with_name(f"{source.stem}_SEMUA_SERTIFIKAT_{suffix}.pdf")


def normalize_number(value: object) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def create_pdf(
    source: Path,
    soffice: Path,
    selected_numbers: list[object] | None = None,
    total_pages: int | None = None,
    output_pdf: Path | None = None,
) -> Path:
    if source.suffix.lower() != ".xlsx":
        raise ValueError("Pilih file .xlsx (bukan .xls atau .xlsm).")
    if not source.is_file():
        raise ValueError("File Excel tidak ditemukan.")
    if not soffice.is_file():
        raise ValueError("LibreOffice tidak ditemukan untuk merender sheet Sertifikat.")

    numbers = collect_record_numbers(source)
    if selected_numbers is not None:
        selected = {normalize_number(number) for number in selected_numbers}
        numbers = [number for number in numbers if normalize_number(number) in selected]
        missing = selected - {normalize_number(number) for number in numbers}
        if missing:
            raise ValueError("Data terpilih tidak ditemukan di kolom No. sheet REKAP: " + ", ".join(sorted(missing)))
    if not numbers:
        raise ValueError("Pilih minimal satu data alat untuk dibuat PDF.")
    if total_pages is not None and not 1 <= total_pages <= 999:
        raise ValueError("Total halaman harus berupa angka 1 sampai 999.")
    output_pdf = output_pdf or unique_pdf_path(source)
    print(f"Menyiapkan {len(numbers)} sertifikat dari REKAP...")

    with tempfile.TemporaryDirectory(prefix="easywork-print-") as work_dir_text:
        work_dir = Path(work_dir_text)
        xlsx_dir = work_dir / "xlsx"
        pdf_dir = work_dir / "pdf"
        profile_dir = work_dir / "lo-profile"
        xlsx_dir.mkdir()
        pdf_dir.mkdir()
        profile_dir.mkdir()

        workbook_copies: list[Path] = []
        for index, number in enumerate(numbers, start=1):
            copy_path = xlsx_dir / f"sertifikat_{index:04d}.xlsx"
            make_one_workbook(source, copy_path, number, total_pages)
            workbook_copies.append(copy_path)

        profile_url = profile_dir.resolve().as_uri()
        command = [
            str(soffice),
            f"-env:UserInstallation={profile_url}",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(pdf_dir),
            *[str(path) for path in workbook_copies],
        ]
        print("Membuat PDF; tunggu sebentar, jangan tutup jendela ini...")
        conversion = subprocess.run(command, capture_output=True, text=True, check=False)
        if conversion.returncode != 0:
            details = (conversion.stderr or conversion.stdout).strip()
            raise RuntimeError(details or "LibreOffice gagal membuat PDF.")

        pdf_paths = [pdf_dir / f"{path.stem}.pdf" for path in workbook_copies]
        missing = [path.name for path in pdf_paths if not path.is_file()]
        if missing:
            details = (conversion.stderr or conversion.stdout).strip()
            raise RuntimeError(
                "Sebagian halaman gagal dirender: " + ", ".join(missing[:5])
                + (f"\n{details}" if details else "")
            )

        writer = PdfWriter()
        page_count = 0
        for path in pdf_paths:
            reader = PdfReader(str(path))
            if not reader.pages:
                raise RuntimeError(f"PDF kosong: {path.name}")
            for page in reader.pages:
                writer.add_page(page)
                page_count += 1

        with output_pdf.open("wb") as output:
            writer.write(output)

    print(f"Selesai: {len(numbers)} alat, {page_count} halaman.")
    print(output_pdf)
    return output_pdf


def main() -> int:
    if len(sys.argv) != 3:
        print("Pemakaian: print_certificates.py FILE.xlsx /path/ke/soffice", file=sys.stderr)
        return 2
    try:
        create_pdf(Path(sys.argv[1]).expanduser().resolve(), Path(sys.argv[2]).expanduser().resolve())
        return 0
    except Exception as exc:  # Show a clear message in the Terminal window.
        print(f"Gagal membuat PDF: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
