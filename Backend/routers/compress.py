from fastapi import APIRouter

from utils.core import *


router = APIRouter()


@router.post("/api/compress-image")
async def compress_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    quality: int = Form(80),
    target_size_kb: Optional[int] = Form(None),
    targetSizeKB: Optional[int] = Form(None),
    targetSize: Optional[int] = Form(None),
    target_size: Optional[int] = Form(None),
    max_size_kb: Optional[int] = Form(None),
    maxSizeKB: Optional[int] = Form(None),
    maxSize: Optional[int] = Form(None),
):
    validate_image_upload(file)

    target_size_kb = next(
        (value for value in (
            target_size_kb, targetSizeKB, targetSize, target_size,
            max_size_kb, maxSizeKB, maxSize
        ) if value is not None),
        None,
    )

    if target_size_kb is not None and target_size_kb <= 0:
        raise HTTPException(
            status_code=400,
            detail="Target size must be greater than zero.",
        )

    data = await read_uploaded_bytes(file, MAX_IMAGE_SIZE)
    image = open_image_from_bytes(data)
    output_path = get_unique_output_path("jpg", "filevixo-compressed")

    try:
        quality = max(1, min(95, quality))

        if target_size_kb is not None:
            target_bytes = target_size_kb * 1024
            with HEAVY_OPERATION_LOCK:
                actual_size = compress_image_to_target_size(
                    image, output_path, target_bytes, "jpg"
                )
            if actual_size > target_bytes:
                raise HTTPException(
                    status_code=500,
                    detail="Could not meet the requested maximum file size.",
                )
        else:
            normalized = normalize_image(image)
            try:
                normalized.save(
                    output_path,
                    format="JPEG",
                    quality=quality,
                    optimize=True,
                )
            finally:
                if normalized is not image:
                    normalized.close()

    except ValueError as error:
        delete_file(str(output_path))
        raise HTTPException(status_code=400, detail=str(error))
    except HTTPException:
        delete_file(str(output_path))
        raise
    except Exception as error:
        delete_file(str(output_path))
        raise HTTPException(
            status_code=500,
            detail=f"Image compression failed: {error}",
        )
    finally:
        try:
            image.close()
        except Exception:
            pass
        del data
        gc.collect()

    if target_size_kb is not None:
        actual_size = output_path.stat().st_size
        target_bytes = target_size_kb * 1024
        if actual_size > target_bytes:
            delete_file(str(output_path))
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Maximum-size safety check failed: output is "
                    f"{actual_size / 1024:.1f} KB, target is "
                    f"{target_size_kb} KB."
                ),
            )

    background_tasks.add_task(delete_file, str(output_path))
    return FileResponse(
        path=output_path,
        media_type="image/jpeg",
        filename="filevixo-compressed.jpg",
    )
