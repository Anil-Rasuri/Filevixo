from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.responses import FileResponse

from utils.core import (
    validate_image_upload,
    read_uploaded_bytes,
    MAX_IMAGE_SIZE,
    open_image_from_bytes,
    get_unique_output_path,
    delete_file,
)

from PIL import Image

import base64
import io
import os


router = APIRouter()


# ============================================================
# OPTIONAL HEIC / HEIF SUPPORT
# ============================================================

HEIF_AVAILABLE = False

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
    HEIF_AVAILABLE = True
except ImportError:
    HEIF_AVAILABLE = False


# ============================================================
# OUTPUT SIZE
# ============================================================

MIN_OUTPUT_BYTES = 50 * 1024
MAX_OUTPUT_BYTES = 100 * 1024
ALLOWED_MAX_OUTPUT_KB = {100, 200}


# ============================================================
# SUPPORTED FORMATS
# ============================================================

SUPPORTED_FORMATS = {
    "jpg": "JPEG",
    "jpeg": "JPEG",
    "png": "PNG",
    "webp": "WEBP",
    "gif": "GIF",
    "bmp": "BMP",
    "tiff": "TIFF",
    "ico": "ICO",
    "avif": "AVIF",
    "heic": "HEIF",
    "heif": "HEIF",
    "svg": "SVG",
}


# ============================================================
# MIME TYPES
# ============================================================

MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
    "ico": "image/x-icon",
    "avif": "image/avif",
    "heic": "image/heic",
    "heif": "image/heif",
    "svg": "image/svg+xml",
}


# ============================================================
# FORMAT HELPERS
# ============================================================

def normalize_output_format(
    output_format: str,
) -> str:
    value = (
        output_format or "jpg"
    ).strip().lower()

    if value not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported output format: "
                f"{value}. Supported formats are: "
                f"{', '.join(SUPPORTED_FORMATS.keys())}."
            ),
        )

    return value


def normalize_for_jpeg(
    image: Image.Image,
) -> Image.Image:
    if image.mode in (
        "RGB",
        "L",
    ):
        return image.convert("RGB")

    if "A" in image.getbands():
        background = Image.new(
            "RGB",
            image.size,
            (255, 255, 255),
        )

        alpha = image.getchannel("A")

        background.paste(
            image.convert("RGBA"),
            mask=alpha,
        )

        return background

    return image.convert("RGB")


def normalize_for_png(
    image: Image.Image,
) -> Image.Image:
    if image.mode in (
        "RGB",
        "RGBA",
        "L",
        "LA",
        "P",
    ):
        return image.copy()

    return image.convert("RGBA")


def normalize_for_webp(
    image: Image.Image,
) -> Image.Image:
    if image.mode in (
        "RGB",
        "RGBA",
    ):
        return image.copy()

    if "A" in image.getbands():
        return image.convert("RGBA")

    return image.convert("RGB")


def normalize_for_bmp(
    image: Image.Image,
) -> Image.Image:
    return image.convert("RGB")


def normalize_for_tiff(
    image: Image.Image,
) -> Image.Image:
    if image.mode in (
        "RGB",
        "RGBA",
        "L",
        "LA",
    ):
        return image.copy()

    return image.convert("RGB")


def normalize_for_ico(
    image: Image.Image,
) -> Image.Image:
    if image.mode in (
        "RGB",
        "RGBA",
    ):
        return image.copy()

    return image.convert("RGBA")


def normalize_for_gif(
    image: Image.Image,
) -> Image.Image:
    if image.mode == "P":
        return image.copy()

    return image.convert(
        "P",
        palette=Image.Palette.ADAPTIVE,
    )


# ============================================================
# IMAGE → SVG
# ============================================================

def create_svg_from_image(
    image: Image.Image,
) -> bytes:
    png_buffer = io.BytesIO()

    png_image = normalize_for_png(image)

    try:
        png_image.save(
            png_buffer,
            format="PNG",
            optimize=False,
            compress_level=6,
        )
    finally:
        png_image.close()

    encoded = base64.b64encode(
        png_buffer.getvalue()
    ).decode("ascii")

    width = image.width
    height = image.height

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    width="{width}"
    height="{height}"
    viewBox="0 0 {width} {height}"
>
    <image
        width="{width}"
        height="{height}"
        preserveAspectRatio="none"
        href="data:image/png;base64,{encoded}"
    />
</svg>
"""

    return svg.encode("utf-8")


# ============================================================
# FAST IMAGE ENCODER
# ============================================================

def save_image_to_bytes(
    image: Image.Image,
    output_format: str,
    dpi: int,
    quality: int = 85,
) -> bytes:

    buffer = io.BytesIO()

    output_format = output_format.lower()

    if output_format == "svg":
        return create_svg_from_image(image)

    if output_format in (
        "jpg",
        "jpeg",
    ):
        processed = normalize_for_jpeg(image)

        try:
            processed.save(
                buffer,
                format="JPEG",
                quality=quality,
                optimize=False,
                progressive=False,
                dpi=(dpi, dpi),
            )
        finally:
            processed.close()

    elif output_format == "png":
        processed = normalize_for_png(image)

        try:
            processed.save(
                buffer,
                format="PNG",
                optimize=False,
                compress_level=6,
                dpi=(dpi, dpi),
            )
        finally:
            processed.close()

    elif output_format == "webp":
        processed = normalize_for_webp(image)

        try:
            processed.save(
                buffer,
                format="WEBP",
                quality=quality,
                method=3,
            )
        finally:
            processed.close()

    elif output_format == "gif":
        processed = normalize_for_gif(image)

        try:
            processed.save(
                buffer,
                format="GIF",
                optimize=False,
            )
        finally:
            processed.close()

    elif output_format == "bmp":
        processed = normalize_for_bmp(image)

        try:
            processed.save(
                buffer,
                format="BMP",
            )
        finally:
            processed.close()

    elif output_format == "tiff":
        processed = normalize_for_tiff(image)

        try:
            processed.save(
                buffer,
                format="TIFF",
                compression="tiff_lzw",
                dpi=(dpi, dpi),
            )
        finally:
            processed.close()

    elif output_format == "ico":
        processed = normalize_for_ico(image)

        try:
            processed.save(
                buffer,
                format="ICO",
            )
        finally:
            processed.close()

    elif output_format == "avif":
        processed = normalize_for_webp(image)

        try:
            processed.save(
                buffer,
                format="AVIF",
                quality=quality,
            )
        except Exception as error:
            raise HTTPException(
                status_code=400,
                detail=(
                    "AVIF output is not available "
                    "in this Pillow installation. "
                    "Please install a Pillow build "
                    "with AVIF support."
                ),
            ) from error
        finally:
            processed.close()

    elif output_format in (
        "heic",
        "heif",
    ):
        if not HEIF_AVAILABLE:
            raise HTTPException(
                status_code=400,
                detail=(
                    "HEIC/HEIF support is not installed. "
                    "Run: pip install pillow-heif"
                ),
            )

        processed = normalize_for_jpeg(image)

        try:
            processed.save(
                buffer,
                format="HEIF",
                quality=quality,
            )
        except Exception as error:
            raise HTTPException(
                status_code=400,
                detail=(
                    "HEIC/HEIF output is not "
                    "available in the current "
                    "Pillow HEIF installation."
                ),
            ) from error
        finally:
            processed.close()

    else:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported output format: "
                f"{output_format}"
            ),
        )

    return buffer.getvalue()


# ============================================================
# RESIZE IMAGE FAST
# ============================================================

def resize_image_fast(
    image: Image.Image,
    width: int,
    height: int,
) -> Image.Image:
    """
    Fast resize.

    BILINEAR is substantially faster than LANCZOS
    and is suitable for an online resize tool where
    speed is important.
    """

    if (
        image.width == width
        and image.height == height
    ):
        return image.copy()

    resized = image.resize(
        (
            int(width),
            int(height),
        ),
        Image.Resampling.BILINEAR,
    )

    resized.load()

    return resized


# ============================================================
# SVG SIZE TARGET
# ============================================================

def create_svg_with_size_target(
    image: Image.Image,
    max_output_bytes: int,
) -> bytes:

    working = image

    try:
        for _ in range(10):
            result = create_svg_from_image(
                working
            )

            size = len(result)

            if (
                MIN_OUTPUT_BYTES
                <= size
                <= max_output_bytes
            ):
                return result

            if size > MAX_OUTPUT_BYTES:
                new_width = max(
                    1,
                    int(working.width * 0.80),
                )

                new_height = max(
                    1,
                    int(working.height * 0.80),
                )

            else:
                new_width = min(
                    10000,
                    max(
                        working.width + 1,
                        int(working.width * 1.15),
                    ),
                )

                new_height = min(
                    10000,
                    max(
                        working.height + 1,
                        int(working.height * 1.15),
                    ),
                )

            if (
                new_width == working.width
                and new_height == working.height
            ):
                break

            next_image = resize_image_fast(
                working,
                new_width,
                new_height,
            )

            if working is not image:
                working.close()

            working = next_image

        final_result = create_svg_from_image(
            working
        )

        if len(final_result) < MIN_OUTPUT_BYTES:
            padding_size = (
                MIN_OUTPUT_BYTES
                - len(final_result)
                + 256
            )

            padding = (
                "<!--"
                + ("F" * padding_size)
                + "-->"
            ).encode("utf-8")

            marker = b"</svg>"

            final_result = (
                final_result.replace(
                    marker,
                    padding + marker,
                )
            )

        if len(final_result) > max_output_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The resized SVG could not "
                    "be created within the "
                    "50 KB to 100 KB range."
                ),
            )

        return final_result

    finally:
        if working is not image:
            try:
                working.close()
            except Exception:
                pass


# ============================================================
# SIZE TARGET ENCODER
# ============================================================

def _pad_output_to_minimum(
    result: bytes,
) -> bytes:
    """
    Keep the requested dimensions unchanged while ensuring
    the encoded file is above the 50 KB minimum.

    Extra bytes are appended only when the encoder naturally
    produces a file smaller than the configured minimum.
    """

    if len(result) >= MIN_OUTPUT_BYTES:
        return result

    padding_size = MIN_OUTPUT_BYTES - len(result) + 1024
    return result + (b"\0" * padding_size)


def create_output_with_size_target(
    image: Image.Image,
    output_format: str,
    dpi: int,
    max_output_bytes: int,
) -> bytes:

    # ========================================================
    # SVG
    # ========================================================

    if output_format == "svg":
        result = create_svg_with_size_target(
            image,
            max_output_bytes,
        )

        return _pad_output_to_minimum(result)

    # ========================================================
    # QUALITY-BASED FORMATS
    # ========================================================

    quality_formats = {
        "jpg",
        "jpeg",
        "webp",
        "avif",
        "heic",
        "heif",
    }

    if output_format in quality_formats:
        # Fast first attempt.
        result = save_image_to_bytes(
            image,
            output_format,
            dpi,
            quality=82,
        )

        if len(result) <= max_output_bytes:
            return _pad_output_to_minimum(result)

        # Small number of quality attempts for speed.
        for quality in (68, 55, 45, 35, 25, 18):
            result = save_image_to_bytes(
                image,
                output_format,
                dpi,
                quality=quality,
            )

            if len(result) <= max_output_bytes:
                return _pad_output_to_minimum(result)

        # ====================================================
        # Dimension adjustment only when the file is too large.
        # ====================================================

        working = image

        try:
            for _ in range(6):
                result = save_image_to_bytes(
                    working,
                    output_format,
                    dpi,
                    quality=72,
                )

                if len(result) <= max_output_bytes:
                    return _pad_output_to_minimum(result)

                scale = 0.82

                new_width = min(10000, max(1, int(working.width * scale)))
                new_height = min(10000, max(1, int(working.height * scale)))

                if new_width == working.width and new_height == working.height:
                    break

                next_image = resize_image_fast(
                    working,
                    new_width,
                    new_height,
                )

                if working is not image:
                    working.close()

                working = next_image

            result = save_image_to_bytes(
                working,
                output_format,
                dpi,
                quality=85,
            )

            if len(result) <= max_output_bytes:
                return _pad_output_to_minimum(result)

        finally:
            if working is not image:
                try:
                    working.close()
                except Exception:
                    pass

    # ========================================================
    # LOSSLESS / OTHER FORMATS
    # ========================================================

    result = save_image_to_bytes(
        image,
        output_format,
        dpi,
        quality=85,
    )

    if len(result) <= max_output_bytes:
        return _pad_output_to_minimum(result)

    working = image

    try:
        for _ in range(8):
            result = save_image_to_bytes(
                working,
                output_format,
                dpi,
                quality=85,
            )

            if len(result) <= max_output_bytes:
                return _pad_output_to_minimum(result)

            scale = 0.80

            new_width = min(10000, max(1, int(working.width * scale)))
            new_height = min(10000, max(1, int(working.height * scale)))

            if new_width == working.width and new_height == working.height:
                break

            next_image = resize_image_fast(
                working,
                new_width,
                new_height,
            )

            if working is not image:
                working.close()

            working = next_image

        final_result = save_image_to_bytes(
            working,
            output_format,
            dpi,
            quality=85,
        )

        if len(final_result) <= max_output_bytes:
            return _pad_output_to_minimum(final_result)

    finally:
        if working is not image:
            try:
                working.close()
            except Exception:
                pass

    raise HTTPException(
        status_code=400,
        detail=(
            "The resized image could not be created "
            "within the selected file-size limit. "
            "Try a smaller output dimension or a larger maximum size."
        ),
    )


# ============================================================
# RESIZE ENDPOINT
# ============================================================

@router.post("/api/resize-image")
async def resize_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    width: int = Form(...),
    height: int = Form(...),
    maintain_aspect: bool = Form(False),
    unit: str = Form("px"),
    output_format: str = Form("jpg"),
    dpi: int = Form(96),
    max_size_kb: float | None = Form(None),
):
    # ========================================================
    # VALIDATE UPLOAD
    # ========================================================

    validate_image_upload(file)

    # ========================================================
    # VALIDATE DIMENSIONS
    # ========================================================

    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Width and height must be "
                "greater than zero."
            ),
        )

    if width > 10000 or height > 10000:
        raise HTTPException(
            status_code=400,
            detail=(
                "Maximum image dimensions "
                "are 10000 × 10000 pixels."
            ),
        )

    # ========================================================
    # DPI
    # ========================================================

    dpi = max(
        1,
        min(
            1200,
            dpi,
        ),
    )

    # ========================================================
    # FORMAT
    # ========================================================

    output_format = normalize_output_format(
        output_format
    )

    # ========================================================
    # MAXIMUM FILE SIZE
    # ========================================================

    selected_max_kb = int(max_size_kb or 100)

    if selected_max_kb not in ALLOWED_MAX_OUTPUT_KB:
        raise HTTPException(
            status_code=400,
            detail="Maximum file size must be either 100 KB or 200 KB.",
        )

    selected_max_bytes = selected_max_kb * 1024

    # ========================================================
    # READ UPLOAD
    # ========================================================

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = None
    resized = None
    output_path = None

    try:
        # ====================================================
        # OPEN ORIGINAL
        # ====================================================

        image = open_image_from_bytes(
            data
        )

        image.load()

        original_width = image.width
        original_height = image.height

        # ====================================================
        # ASPECT RATIO
        # ====================================================

        if maintain_aspect:
            ratio = min(
                width / original_width,
                height / original_height,
            )

            width = max(
                1,
                int(
                    original_width * ratio
                ),
            )

            height = max(
                1,
                int(
                    original_height * ratio
                ),
            )

        # ====================================================
        # FAST RESIZE
        # ====================================================

        resized = resize_image_fast(
            image,
            int(width),
            int(height),
        )

        # ====================================================
        # CREATE 50–100 KB OUTPUT
        # ====================================================

        output_bytes = (
            create_output_with_size_target(
                resized,
                output_format,
                dpi,
                selected_max_bytes,
            )
        )

        # ====================================================
        # FINAL SIZE CHECK
        # ====================================================

        output_size = len(output_bytes)

        if output_size < MIN_OUTPUT_BYTES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The resized image is smaller "
                    "than the required minimum "
                    "file size of 50 KB."
                ),
            )

        if output_size > selected_max_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The resized image is larger "
                    "than the selected maximum "
                    f"file size of {selected_max_kb} KB."
                ),
            )

        # ====================================================
        # EXTENSION
        # ====================================================

        extension = (
            "jpg"
            if output_format == "jpeg"
            else output_format
        )

        # ====================================================
        # OUTPUT PATH
        # ====================================================

        output_path = get_unique_output_path(
            extension,
            "filevixo-resized",
        )

        # ====================================================
        # WRITE OUTPUT
        # ====================================================

        with open(
            output_path,
            "wb",
        ) as output_file:
            output_file.write(
                output_bytes
            )

        # ====================================================
        # VERIFY FILE
        # ====================================================

        if not os.path.exists(
            output_path
        ):
            raise HTTPException(
                status_code=500,
                detail=(
                    "The resized image "
                    "could not be created."
                ),
            )

        disk_size = os.path.getsize(
            output_path
        )

        if (
            disk_size < MIN_OUTPUT_BYTES
            or disk_size > selected_max_bytes
        ):
            raise HTTPException(
                status_code=500,
                detail=(
                    "The generated file does not "
                    "meet the required 50 KB to "
                    "100 KB size range."
                ),
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
                "Image resize failed: "
                f"{error}"
            ),
        )

    finally:
        if resized is not None:
            try:
                resized.close()
            except Exception:
                pass

        if image is not None:
            try:
                image.close()
            except Exception:
                pass

    # ========================================================
    # DELETE AFTER RESPONSE
    # ========================================================

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return FileResponse(
        path=output_path,
        media_type=MIME_TYPES.get(
            output_format,
            "application/octet-stream",
        ),
        filename=(
            f"filevixo-resized."
            f"{extension}"
        ),
    )