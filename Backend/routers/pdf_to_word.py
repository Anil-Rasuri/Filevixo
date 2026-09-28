import asyncio
from fastapi import APIRouter

from utils.core import *

import zipfile
from xml.sax.saxutils import escape


router = APIRouter()


MAX_PDF_TO_WORD_SIZE = 10 * 1024 * 1024  # 10 MB


try:
    import fitz
except ImportError:
    fitz = None


def build_fast_docx(
    pages: list[str],
    output_path: Path,
):
    """
    Build a minimal DOCX directly.

    This avoids the overhead of constructing a large python-docx
    object tree and is optimized for fast text-based conversion.
    """

    document_xml_parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
        "<w:body>",
    ]

    for page_index, page_text in enumerate(pages):
        if page_text:
            lines = page_text.splitlines()

            document_xml_parts.append("<w:p>")

            for line_index, line in enumerate(lines):
                if line:
                    document_xml_parts.append(
                        "<w:r><w:t xml:space=\"preserve\">"
                        + escape(line)
                        + "</w:t></w:r>"
                    )

                if line_index < len(lines) - 1:
                    document_xml_parts.append(
                        '<w:r><w:br/></w:r>'
                    )

            document_xml_parts.append("</w:p>")

        if page_index < len(pages) - 1:
            document_xml_parts.append(
                '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
            )

    document_xml_parts.extend(
        [
            "<w:sectPr>",
            '<w:pgSz w:w="12240" w:h="15840"/>',
            '<w:pgMar w:top="1440" w:right="1440" '
            'w:bottom="1440" w:left="1440" '
            'w:header="720" w:footer="720" w:gutter="0"/>',
            "</w:sectPr>",
            "</w:body>",
            "</w:document>",
        ]
    )

    document_xml = "".join(document_xml_parts)

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""

    relationships = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1"
Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
Target="word/document.xml"/>
</Relationships>"""

    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
<w:name w:val="Normal"/>
<w:rPr>
<w:sz w:val="22"/>
</w:rPr>
</w:style>
</w:styles>"""

    settings = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:zoom w:percent="100"/>
</w:settings>"""

    with zipfile.ZipFile(
        output_path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=1,
    ) as docx:
        docx.writestr(
            "[Content_Types].xml",
            content_types,
        )

        docx.writestr(
            "_rels/.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1"
Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
Target="word/document.xml"/>
</Relationships>""",
        )

        docx.writestr(
            "word/document.xml",
            document_xml,
        )

        docx.writestr(
            "word/styles.xml",
            styles,
        )

        docx.writestr(
            "word/settings.xml",
            settings,
        )

        docx.writestr(
            "word/_rels/document.xml.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>""",
        )


def convert_pdf_to_word(
    input_path: Path,
    output_path: Path,
):
    """
    Fast text-based PDF -> DOCX conversion using PyMuPDF.
    """

    if fitz is None:
        raise RuntimeError(
            "PyMuPDF is not installed."
        )

    pdf_document = None

    try:
        pdf_document = fitz.open(
            str(input_path)
        )

        if pdf_document.needs_pass:
            raise ValueError(
                "Password-protected PDFs are not supported."
            )

        pages = []

        for page in pdf_document:
            text = page.get_text(
                "text",
                sort=False,
            )

            pages.append(
                text.strip()
            )

        build_fast_docx(
            pages,
            output_path,
        )

    finally:
        if pdf_document is not None:
            pdf_document.close()


@router.post("/api/pdf-to-word")
async def pdf_to_word(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    if Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    if fitz is None:
        raise HTTPException(
            status_code=500,
            detail="PyMuPDF is not installed.",
        )

    data = await read_uploaded_bytes(
        file,
        MAX_PDF_TO_WORD_SIZE,
    )

    temp_dir = Path(
        tempfile.mkdtemp(
            prefix="filevixo-pdf-word-",
            dir=TEMP_DIR,
        )
    )

    input_path = temp_dir / "input.pdf"
    output_path = temp_dir / "converted.docx"

    try:
        input_path.write_bytes(data)

        del data

        await asyncio.to_thread(
            convert_pdf_to_word,
            input_path,
            output_path,
        )

        if not output_path.exists():
            raise HTTPException(
                status_code=500,
                detail="Word document could not be created.",
            )

        original_name = Path(
            file.filename
        ).stem

        background_tasks.add_task(
            delete_directory,
            temp_dir,
        )

        return FileResponse(
            path=output_path,
            media_type=(
                "application/vnd.openxmlformats-"
                "officedocument.wordprocessingml.document"
            ),
            filename=f"{original_name}.docx",
        )

    except HTTPException:
        delete_directory(temp_dir)
        raise

    except ValueError as error:
        delete_directory(temp_dir)

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        delete_directory(temp_dir)

        raise HTTPException(
            status_code=500,
            detail=(
                "PDF to Word conversion failed: "
                f"{error}"
            ),
        )