from fastapi import APIRouter

from utils.core import *


router = APIRouter()


# Word files can cause LibreOffice to use significant RAM.
# Keep this operation below the general 25 MB upload limit.
MAX_WORD_TO_PDF_SIZE = 10 * 1024 * 1024  # 10 MB


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

    extension = Path(file.filename).suffix.lower()

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

    safe_filename = Path(file.filename).name
    input_path = temp_dir / safe_filename
    output_path = temp_dir / f"{input_path.stem}.pdf"

    try:
        input_path.write_bytes(data)

        # Release uploaded file bytes before starting LibreOffice.
        del data
        gc.collect()

        soffice_path = find_libreoffice()

        if not soffice_path:
            raise HTTPException(
                status_code=500,
                detail="LibreOffice is not installed on the server.",
            )

        # Use a unique LibreOffice profile for this conversion.
        lo_profile = temp_dir / "lo-profile"
        lo_profile.mkdir(parents=True, exist_ok=True)

        profile_uri = lo_profile.resolve().as_uri()

        with HEAVY_OPERATION_LOCK:
            result = subprocess.run(
                [
                    soffice_path,
                    "--headless",
                    "--nologo",
                    "--nodefault",
                    "--nofirststartwizard",
                    "--norestore",
                    "--nolockcheck",
                    f"-env:UserInstallation={profile_uri}",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(temp_dir),
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

        # Release subprocess output immediately.
        del result
        gc.collect()

        if output_path.exists() is False:
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
            filename=f"{input_path.stem}.pdf",
        )

    except subprocess.TimeoutExpired:
        delete_directory(temp_dir)
        gc.collect()

        raise HTTPException(
            status_code=504,
            detail="Word to PDF conversion timed out.",
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
            detail=f"Word to PDF conversion failed: {error}",
        )

    finally:
        gc.collect()