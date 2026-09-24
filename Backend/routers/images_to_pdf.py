from fastapi import APIRouter

from utils.core import *


router = APIRouter()


@router.post("/api/images-to-pdf")
async def images_to_pdf(
    background_tasks: BackgroundTasks,
    files: Optional[List[UploadFile]] = File(
        default=None
    ),
    images: Optional[List[UploadFile]] = File(
        default=None
    ),
    images_per_page: int = Form(1),
    page_size: str = Form("A4"),
    orientation: str = Form("portrait"),
    margin: str = Form("medium"),
):
    uploaded_files = (
        files
        if files
        else images
    )

    if not uploaded_files:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload at least "
                "one image."
            ),
        )

    if images_per_page not in {
        1,
        2,
        3,
        4,
        6,
        9,
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Images per page must be "
                "1, 2, 3, 4, 6, or 9."
            ),
        )

    if page_size not in {
        "A4",
        "Letter",
    }:
        page_size = "A4"

    if orientation not in {
        "portrait",
        "landscape",
    }:
        orientation = "portrait"

    if margin not in {
        "small",
        "medium",
        "large",
    }:
        margin = "medium"

    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import (
            A4,
            LETTER,
        )
        from reportlab.lib.utils import (
            ImageReader,
        )
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail=(
                "reportlab is not installed."
            ),
        )

    page_size_map = {
        "A4": A4,
        "Letter": LETTER,
    }

    page_width, page_height = (
        page_size_map[page_size]
    )

    if orientation == "landscape":
        page_width, page_height = (
            page_height,
            page_width,
        )

    margin_map = {
        "small": 24,
        "medium": 42,
        "large": 64,
    }

    margin_value = margin_map[
        margin
    ]

    usable_width = (
        page_width
        - margin_value * 2
    )

    usable_height = (
        page_height
        - margin_value * 2
    )

    if images_per_page == 1:
        rows, columns = 1, 1

    elif images_per_page == 2:
        rows, columns = 2, 1

    elif images_per_page == 3:
        rows, columns = 3, 1

    elif images_per_page == 4:
        rows, columns = 2, 2

    elif images_per_page == 6:
        rows, columns = 2, 3

    else:
        rows, columns = 3, 3

    cell_width = (
        usable_width / columns
    )

    cell_height = (
        usable_height / rows
    )

    image_objects = []
    output_path = None

    try:
        for uploaded_file in uploaded_files:
            content_type = (
                uploaded_file.content_type
                or ""
            ).lower()

            filename = (
                uploaded_file.filename
                or ""
            ).lower()

            if (
                not content_type.startswith(
                    "image/"
                )
                and not filename.endswith(
                    (
                        ".jpg",
                        ".jpeg",
                        ".png",
                        ".webp",
                    )
                )
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{uploaded_file.filename} "
                        "is not a supported image."
                    ),
                )

            data = await read_uploaded_bytes(
                uploaded_file,
                MAX_IMAGE_SIZE,
            )

            image_objects.append(
                open_image_from_bytes(
                    data
                )
            )

        output_path = get_unique_output_path(
            "pdf",
            "filevixo-images",
        )

        pdf = canvas.Canvas(
            str(output_path),
            pagesize=(
                page_width,
                page_height,
            ),
        )

        pdf.setTitle(
            "Filevixo Images PDF"
        )

        for index, image in enumerate(
            image_objects
        ):
            position_on_page = (
                index
                % images_per_page
            )

            if (
                position_on_page == 0
                and index > 0
            ):
                pdf.showPage()

            row = (
                position_on_page
                // columns
            )

            column = (
                position_on_page
                % columns
            )

            cell_x = (
                margin_value
                + column * cell_width
            )

            cell_y = (
                page_height
                - margin_value
                - (row + 1)
                * cell_height
            )

            scale = min(
                (
                    cell_width - 16
                )
                / image.width,
                (
                    cell_height - 16
                )
                / image.height,
            )

            draw_width = (
                image.width
                * scale
            )

            draw_height = (
                image.height
                * scale
            )

            draw_x = (
                cell_x
                + (
                    cell_width
                    - draw_width
                )
                / 2
            )

            draw_y = (
                cell_y
                + (
                    cell_height
                    - draw_height
                )
                / 2
            )

            image_buffer = io.BytesIO()

            rgb_image = normalize_image(
                image
            )

            rgb_image.save(
                image_buffer,
                format="JPEG",
                quality=90,
            )

            image_buffer.seek(0)

            pdf.drawImage(
                ImageReader(
                    image_buffer
                ),
                draw_x,
                draw_y,
                width=draw_width,
                height=draw_height,
                preserveAspectRatio=True,
                mask="auto",
            )

            rgb_image.close()
            image_buffer.close()

        pdf.showPage()
        pdf.save()

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
                "Images to PDF failed: "
                f"{error}"
            ),
        )

    finally:
        for image in image_objects:
            try:
                image.close()
            except Exception:
                pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type="application/pdf",
        filename="filevixo-images.pdf",
    )
