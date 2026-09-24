from fastapi import APIRouter

from utils.core import *


router = APIRouter()


@router.post("/api/merge-pdf")
async def merge_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    if (
        PdfReader is None
        or PdfWriter is None
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "PyPDF2 is not installed."
            ),
        )

    if len(files) < 2:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please select at least "
                "two PDF files."
            ),
        )

    if len(files) > MAX_MERGE_FILES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"You can merge a maximum "
                f"of {MAX_MERGE_FILES} PDF files."
            ),
        )

    writer = PdfWriter()
    pdf_streams = []

    total_size = 0
    output_path = None

    try:
        for uploaded_file in files:
            validate_pdf_upload(
                uploaded_file
            )

            data = await uploaded_file.read()

            if not data:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{uploaded_file.filename} "
                        "is empty."
                    ),
                )

            if len(data) > MAX_PDF_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"{uploaded_file.filename} "
                        "exceeds the 25 MB limit."
                    ),
                )

            total_size += len(data)

            if (
                total_size
                > MAX_TOTAL_MERGE_SIZE
            ):
                raise HTTPException(
                    status_code=413,
                    detail=(
                        "The combined PDF size "
                        "cannot exceed 100 MB."
                    ),
                )

            pdf_stream = io.BytesIO(
                data
            )

            pdf_streams.append(
                pdf_stream
            )

            try:
                reader = PdfReader(
                    pdf_stream
                )

            except Exception as error:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Could not read "
                        f"{uploaded_file.filename}: "
                        f"{error}"
                    ),
                )

            if reader.is_encrypted:
                try:
                    decrypted = reader.decrypt(
                        ""
                    )

                    if not decrypted:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"{uploaded_file.filename} "
                                "is password protected."
                            ),
                        )

                except HTTPException:
                    raise

                except Exception:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"{uploaded_file.filename} "
                            "is password protected."
                        ),
                    )

            for page in reader.pages:
                writer.add_page(
                    page
                )

        output_path = get_unique_output_path(
            "pdf",
            "filevixo-merged",
        )

        with open(
            output_path,
            "wb",
        ) as output_file:
            writer.write(
                output_file
            )

    except HTTPException:
        if output_path:
            delete_file(
                str(output_path)
            )

        raise

    except Exception as error:
        if output_path:
            delete_file(
                str(output_path)
            )

        raise HTTPException(
            status_code=500,
            detail=(
                "PDF merge failed: "
                f"{error}"
            ),
        )

    finally:
        try:
            writer.close()
        except Exception:
            pass

        for stream in pdf_streams:
            try:
                stream.close()
            except Exception:
                pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type="application/pdf",
        filename="filevixo-merged.pdf",
    )
