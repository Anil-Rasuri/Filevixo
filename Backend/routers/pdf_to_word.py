from fastapi import APIRouter

from utils.core import *


router = APIRouter()


# PDF-to-Word upload limit.
MAX_PDF_TO_WORD_SIZE = 10 * 1024 * 1024  # 10 MB


# PyMuPDF is used for fast PDF text extraction.
try:
    import fitz
except ImportError:
    fitz = None


def convert_pdf_to_word(
    input_path: Path,
    output_path: Path,
):
    """
    Convert PDF text to DOCX using PyMuPDF.

    This keeps the existing text-based PDF -> Word behavior while
    using PyMuPDF for faster PDF parsing and text extraction.
    """

    if fitz is None:
        raise RuntimeError(
            "PyMuPDF is not installed."
        )

    if Document is None:
        raise RuntimeError(
            "python-docx is not installed."
        )

    pdf_document = None
    document = None

    try:
        # Open PDF with PyMuPDF.
        pdf_document = fitz.open(str(input_path))

        # Check for password protection.
        if pdf_document.needs_pass:
            raise ValueError(
                "Password-protected PDFs are not supported."
            )

        document = Document()

        page_count = len(pdf_document)

        for page_number in range(page_count):
            page = pdf_document.load_page(page_number)

            # PyMuPDF text extraction.
            text = page.get_text("text") or ""
            text = text.strip()

            if text:
                # Keep the page's extracted line structure while
                # avoiding one DOCX paragraph per line.
                document.add_paragraph(text)

            if page_number < page_count - 1:
                document.add_page_break()

        document.save(str(output_path))

    finally:
        if document is not None:
            del document

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

    extension = Path(file.filename).suffix.lower()

    if extension != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    if fitz is None:
        raise HTTPException(
            status_code=500,
            detail="PyMuPDF is not installed.",
        )

    if Document is None:
        raise HTTPException(
            status_code=500,
            detail="python-docx is not installed.",
        )

    # Read and validate the uploaded PDF.
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

        # Release uploaded bytes immediately.
        del data

        # PDF parsing and DOCX generation are blocking operations.
        # Run them outside FastAPI's main event loop.
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

        original_name = Path(file.filename).stem

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