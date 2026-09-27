from fastapi import APIRouter

from utils.core import *


router = APIRouter()


MAX_WORD_TO_PDF_SIZE = 10 * 1024 * 1024  # 10 MB

# Persistent LibreOffice instance started by Docker.
LIBREOFFICE_HOST = "127.0.0.1"
LIBREOFFICE_PORT = 2002

_SOFFICE_PATH = None


def get_soffice_path():
    global _SOFFICE_PATH

    if _SOFFICE_PATH is None:
        _SOFFICE_PATH = find_libreoffice()

    return _SOFFICE_PATH


def convert_with_warm_libreoffice(
    soffice_path: str,
    input_path: Path,
    output_dir: Path,
):
    """
    Use the already-running LibreOffice instance.

    The Docker container starts LibreOffice once.
    This function only launches the lightweight
    conversion command.
    """

    result = subprocess.run(
        [
            soffice_path,
            "--headless",
            "--nologo",
            "--nodefault",
            "--nofirststartwizard",
            "--norestore",
            "--nolockcheck",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(input_path),
        ],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=60,
    )

    stdout = result.stdout.strip()
    stderr = result.stderr.strip()

    return_code = result.returncode

    del result

    return return_code, stdout, stderr


@router.post("/api/word-to-pdf")
async def word_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    extension = Path(
        file.filename
    ).suffix.lower()

    if extension not in {".doc", ".docx"}:
        raise HTTPException(
            status_code=400,
            detail="Only DOC and DOCX files are supported.",
        )

    data = await read_uploaded_bytes(
        file,
        MAX_WORD_TO_PDF_SIZE,
    )

    temp_dir = Path(
        tempfile.mkdtemp(
            prefix="filevixo-word-pdf-",
            dir=TEMP_DIR,
        )
    )

    safe_filename = Path(
        file.filename
    ).name

    input_path = temp_dir / safe_filename

    output_path = (
        temp_dir /
        f"{input_path.stem}.pdf"
    )

    try:
        input_path.write_bytes(data)

        del data

        soffice_path = get_soffice_path()

        if not soffice_path:
            raise HTTPException(
                status_code=500,
                detail="LibreOffice is not installed on the server.",
            )

        return_code, stdout, stderr = (
            convert_with_warm_libreoffice(
                soffice_path,
                input_path,
                temp_dir,
            )
        )

        if (
            return_code != 0
            or not output_path.exists()
        ):
            diagnostic = (
                stderr
                or stdout
                or "LibreOffice produced no output."
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "LibreOffice did not create the PDF output. "
                    f"Details: {diagnostic}"
                ),
            )

        background_tasks.add_task(
            delete_directory,
            temp_dir,
        )

        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=(
                f"{input_path.stem}.pdf"
            ),
        )

    except subprocess.TimeoutExpired:
        delete_directory(temp_dir)

        raise HTTPException(
            status_code=504,
            detail="Word to PDF conversion timed out.",
        )

    except HTTPException:
        delete_directory(temp_dir)
        raise

    except Exception as error:
        delete_directory(temp_dir)

        raise HTTPException(
            status_code=500,
            detail=(
                f"Word to PDF conversion failed: {error}"
            ),
        )