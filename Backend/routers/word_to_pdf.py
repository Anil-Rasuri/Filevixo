from fastapi import APIRouter

from utils.core import *


router = APIRouter()


@router.post("/api/word-to-pdf")
async def word_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    extension = Path(file.filename).suffix.lower()
    if extension not in {".doc", ".docx"}:
        raise HTTPException(
            status_code=400,
            detail="Only DOC and DOCX files are supported.",
        )

    data = await read_uploaded_bytes(file, MAX_PDF_SIZE)
    temp_dir = Path(
        tempfile.mkdtemp(
            prefix="filevixo-word-pdf-",
            dir=TEMP_DIR,
        )
    )

    safe_filename = Path(file.filename).name
    input_path = temp_dir / safe_filename
    output_path = temp_dir / f"{input_path.stem}.pdf"
    input_path.write_bytes(data)
    del data
    gc.collect()

    try:
        soffice_path = find_libreoffice()
        if not soffice_path:
            raise HTTPException(
                status_code=500,
                detail="LibreOffice is not installed on the server.",
            )

        # A unique profile is mandatory here. It prevents LibreOffice from
        # using a stale/corrupt default profile. On Windows, resolve().as_uri()
        # produces the correct file:///C:/... URI.
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
                capture_output=True,
                text=True,
                timeout=90,
            )

        if result.returncode != 0:
            error_message = (
                result.stderr.strip()
                or result.stdout.strip()
                or "Unknown LibreOffice error."
            )
            raise HTTPException(
                status_code=500,
                detail=f"Word to PDF conversion failed: {error_message}",
            )

        if not output_path.exists():
            diagnostic = (
                result.stderr.strip()
                or result.stdout.strip()
                or "LibreOffice produced no output."
            )
            raise HTTPException(
                status_code=500,
                detail=(
                    "LibreOffice did not create the PDF output. "
                    f"Details: {diagnostic}"
                ),
            )

        background_tasks.add_task(delete_directory, temp_dir)
        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=f"{input_path.stem}.pdf",
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
            detail=f"Word to PDF conversion failed: {error}",
        )
    finally:
        gc.collect()
