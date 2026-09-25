from fastapi import APIRouter

from utils.core import *


router = APIRouter()


# PDF-to-Word gets its own smaller limit because PDF parsing
# can use considerably more RAM than the uploaded file size.
MAX_PDF_TO_WORD_SIZE = 10 * 1024 * 1024  # 10 MB


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

    if PdfReader is None:
        raise HTTPException(
            status_code=500,
            detail="PyPDF2 is not installed.",
        )

    if Document is None:
        raise HTTPException(
            status_code=500,
            detail="python-docx is not installed.",
        )

    # Use a smaller limit specifically for PDF -> Word.
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

        # Release uploaded PDF bytes as soon as they are written to disk.
        del data
        gc.collect()

        reader = PdfReader(str(input_path))

        if reader.is_encrypted:
            try:
                decrypted = reader.decrypt("")

                if not decrypted:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Password-protected "
                            "PDFs are not supported."
                        ),
                    )

            except HTTPException:
                raise

            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Password-protected "
                        "PDFs are not supported."
                    ),
                )

        document = Document()

        page_count = len(reader.pages)

        for page_number, page in enumerate(reader.pages):
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""

            text = text.strip()

            if text:
                for line in text.splitlines():
                    line = line.strip()

                    if line:
                        document.add_paragraph(line)

            if page_number < page_count - 1:
                document.add_page_break()

        document.save(str(output_path))

        # Release objects before returning.
        del document
        del reader
        gc.collect()

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
        gc.collect()
        raise

    except Exception as error:
        delete_directory(temp_dir)
        gc.collect()

        raise HTTPException(
            status_code=500,
            detail=(
                "PDF to Word conversion failed: "
                f"{error}"
            ),
        )