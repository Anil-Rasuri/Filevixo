from fastapi import APIRouter
from io import BytesIO

from utils.core import *


router = APIRouter()


def _encode_jpeg(image, quality: int) -> bytes:
    """
    Fast JPEG encoder.

    optimize=False is intentionally used because JPEG optimization
    can add significant CPU time, especially for larger images.
    """
    buffer = BytesIO()

    image.save(
        buffer,
        format="JPEG",
        quality=quality,
        optimize=False,
        progressive=False,
    )

    return buffer.getvalue()


def _find_fast_target_jpeg(
    image,
    target_bytes: int,
) -> bytes:
    """
    Find a JPEG that is <= target_bytes.

    Uses binary-search quality first because it requires far fewer
    JPEG encodes than repeatedly trying many quality values.

    If quality alone cannot reach the target, the image is gradually
    resized until the target can be reached.
    """

    working = image

    try:
        # ---------------------------------------------------------
        # First attempt: keep original dimensions and find quality.
        # ---------------------------------------------------------
        low = 1
        high = 95

        best_data = None

        while low <= high:
            quality = (low + high) // 2

            data = _encode_jpeg(
                working,
                quality,
            )

            if len(data) <= target_bytes:
                best_data = data

                # Try higher quality while staying under the target.
                low = quality + 1
            else:
                # Need lower quality.
                high = quality - 1

        if best_data is not None:
            return best_data

        # ---------------------------------------------------------
        # Quality 1 is still too large.
        #
        # Resize only when absolutely necessary.
        # This preserves the existing behavior for normal targets.
        # ---------------------------------------------------------
        width, height = working.size

        # Never allow zero-sized images.
        new_width = max(1, int(width * 0.85))
        new_height = max(1, int(height * 0.85))

        # Prevent endless resizing.
        for _ in range(12):
            resized = working.resize(
                (new_width, new_height),
                Image.Resampling.LANCZOS,
            )

            try:
                low = 1
                high = 95
                best_data = None

                while low <= high:
                    quality = (low + high) // 2

                    data = _encode_jpeg(
                        resized,
                        quality,
                    )

                    if len(data) <= target_bytes:
                        best_data = data
                        low = quality + 1
                    else:
                        high = quality - 1

                if best_data is not None:
                    return best_data

            finally:
                resized.close()

            # Still too large.
            new_width = max(1, int(new_width * 0.85))
            new_height = max(1, int(new_height * 0.85))

            if new_width <= 1 or new_height <= 1:
                break

        # ---------------------------------------------------------
        # Final safety attempt.
        # ---------------------------------------------------------
        final_image = working

        if new_width > 1 and new_height > 1:
            final_image = working.resize(
                (new_width, new_height),
                Image.Resampling.LANCZOS,
            )

        try:
            final_data = _encode_jpeg(
                final_image,
                1,
            )

            if len(final_data) <= target_bytes:
                return final_data

        finally:
            if final_image is not working:
                final_image.close()

        raise ValueError(
            "Could not meet the requested maximum file size."
        )

    finally:
        if working is not image:
            working.close()


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

    # -------------------------------------------------------------
    # Keep all existing frontend/backend parameter compatibility.
    # -------------------------------------------------------------
    target_size_kb = next(
        (
            value
            for value in (
                target_size_kb,
                targetSizeKB,
                targetSize,
                target_size,
                max_size_kb,
                maxSizeKB,
                maxSize,
            )
            if value is not None
        ),
        None,
    )

    if target_size_kb is not None and target_size_kb <= 0:
        raise HTTPException(
            status_code=400,
            detail="Target size must be greater than zero.",
        )

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(data)

    output_path = get_unique_output_path(
        "jpg",
        "filevixo-compressed",
    )

    try:
        quality = max(
            1,
            min(95, quality),
        )

        # =========================================================
        # TARGET SIZE MODE
        # =========================================================
        if target_size_kb is not None:

            target_bytes = target_size_kb * 1024

            normalized = normalize_image(image)

            try:
                # -------------------------------------------------
                # Fast target-size compression.
                #
                # No HEAVY_OPERATION_LOCK here.
                # The previous lock forced requests to wait behind
                # other image-processing operations.
                # -------------------------------------------------
                compressed_data = _find_fast_target_jpeg(
                    normalized,
                    target_bytes,
                )

                actual_size = len(compressed_data)

                # Absolute safety check.
                if actual_size > target_bytes:
                    raise HTTPException(
                        status_code=500,
                        detail=(
                            "Could not meet the requested "
                            "maximum file size."
                        ),
                    )

                output_path.write_bytes(
                    compressed_data
                )

                del compressed_data

            finally:
                if normalized is not image:
                    normalized.close()

        # =========================================================
        # NORMAL QUALITY MODE
        # =========================================================
        else:

            normalized = normalize_image(image)

            try:
                # -------------------------------------------------
                # Fast single-pass JPEG compression.
                #
                # optimize=False makes this considerably faster
                # for larger images.
                # -------------------------------------------------
                normalized.save(
                    output_path,
                    format="JPEG",
                    quality=quality,
                    optimize=False,
                    progressive=False,
                )

            finally:
                if normalized is not image:
                    normalized.close()

    except ValueError as error:
        delete_file(str(output_path))

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

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

    # =============================================================
    # FINAL ABSOLUTE SAFETY CHECK
    # =============================================================
    if target_size_kb is not None:

        actual_size = output_path.stat().st_size
        target_bytes = target_size_kb * 1024

        if actual_size > target_bytes:
            delete_file(str(output_path))

            raise HTTPException(
                status_code=500,
                detail=(
                    f"Maximum-size safety check failed: "
                    f"output is {actual_size / 1024:.1f} KB, "
                    f"target is {target_size_kb} KB."
                ),
            )

    # =============================================================
    # CLEANUP OUTPUT FILE AFTER RESPONSE
    # =============================================================
    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type="image/jpeg",
        filename="filevixo-compressed.jpg",
    )