from fastapi import APIRouter

from utils.core import *


router = APIRouter()


@router.post("/api/crop-image")
async def crop_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x: int = Form(...),
    y: int = Form(...),
    width: int = Form(...),
    height: int = Form(...),
    output_format: str = Form("png"),
):
    validate_image_upload(file)

    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Crop dimensions must "
                "be greater than zero."
            ),
        )

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    if (
        x < 0
        or y < 0
        or x + width > image.width
        or y + height > image.height
    ):
        image.close()

        raise HTTPException(
            status_code=400,
            detail=(
                "Crop area is outside "
                "the image."
            ),
        )

    cropped = None

    try:
        cropped = image.crop(
            (
                x,
                y,
                x + width,
                y + height,
            )
        )

        output_format = output_format.lower()

        if output_format not in {
            "jpg",
            "jpeg",
            "png",
            "webp",
        }:
            output_format = "png"

        if output_format in (
            "jpg",
            "jpeg",
        ):
            processed = normalize_image(
                cropped
            )
            cropped.close()
            cropped = processed

        extension = (
            "jpg"
            if output_format in (
                "jpg",
                "jpeg",
            )
            else output_format
        )

        output_path = get_unique_output_path(
            extension,
            "filevixo-cropped",
        )

        if extension == "jpg":
            cropped.save(
                output_path,
                format="JPEG",
                quality=90,
                optimize=True,
            )

        elif extension == "png":
            cropped.save(
                output_path,
                format="PNG",
                optimize=True,
            )

        else:
            cropped.save(
                output_path,
                format="WEBP",
                quality=90,
            )

    except Exception as error:
        if "output_path" in locals():
            delete_file(
                str(output_path)
            )

        raise HTTPException(
            status_code=500,
            detail=(
                "Image crop failed: "
                f"{error}"
            ),
        )

    finally:
        try:
            image.close()
        except Exception:
            pass

        if cropped is not None:
            try:
                cropped.close()
            except Exception:
                pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type=(
            "image/jpeg"
            if extension == "jpg"
            else f"image/{extension}"
        ),
        filename=(
            f"filevixo-cropped.{extension}"
        ),
    )
