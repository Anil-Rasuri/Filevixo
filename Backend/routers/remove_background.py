from fastapi import APIRouter

from utils.core import *


router = APIRouter()


@router.post("/api/remove-background")
async def remove_background(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not REMBG_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail=(
                "Background removal engine "
                "is not installed."
            ),
        )

    validate_image_upload(file)

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    working_image = image
    output_image = None

    try:
        if working_image.mode not in (
            "RGB",
            "RGBA",
        ):
            converted = working_image.convert(
                "RGBA"
            )

            working_image.close()

            working_image = converted

        resized_image = (
            resize_for_background_removal(
                working_image
            )
        )

        if resized_image is not working_image:
            working_image.close()
            working_image = resized_image

        session = get_remove_bg_session()

        if session is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Background removal AI model "
                    "could not be loaded."
                ),
            )

        output_image = rembg_remove(
            working_image,
            session=session,
            post_process_mask=True,
            decontaminate=True,
        )

    except HTTPException:
        raise

    except Exception as error:
        print(
            "[Filevixo] Background removal error: "
            f"{error}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "AI background removal failed: "
                f"{error}"
            ),
        )

    finally:
        try:
            working_image.close()
        except Exception:
            pass

    if output_image is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "Background removal did not "
                "produce an output image."
            ),
        )

    if output_image.mode != "RGBA":
        converted = output_image.convert(
            "RGBA"
        )

        output_image.close()

        output_image = converted

    output_path = get_unique_output_path(
        "png",
        "filevixo-background-removed",
    )

    try:
        output_image.save(
            output_path,
            format="PNG",
            optimize=True,
        )

    except Exception as error:
        delete_file(
            str(output_path)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not save background "
                f"removed image: {error}"
            ),
        )

    finally:
        try:
            output_image.close()
        except Exception:
            pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type="image/png",
        filename=(
            "filevixo-background-removed.png"
        ),
    )
