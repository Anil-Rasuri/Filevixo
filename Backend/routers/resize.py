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
import math


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

MIN_OUTPUT_BYTES = (50 * 1024) + 1
DEFAULT_MAX_OUTPUT_BYTES = 100 * 1024
ABSOLUTE_MAX_OUTPUT_BYTES = 200 * 1024


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

def normalize_output_format(output_format: str) -> str:
    value = (output_format or "jpg").strip().lower()

    if value not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported output format: {value}. "
                f"Supported formats are: "
                f"{', '.join(SUPPORTED_FORMATS.keys())}."
            ),
        )

    return value


def normalize_for_jpeg(image: Image.Image) -> Image.Image:
    if image.mode in ("RGB", "L"):
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


def normalize_for_png(image: Image.Image) -> Image.Image:
    if image.mode in ("RGB", "RGBA", "L", "LA", "P"):
        return image.copy()

    return image.convert("RGBA")


def normalize_for_webp(image: Image.Image) -> Image.Image:
    if image.mode in ("RGB", "RGBA"):
        return image.copy()

    if "A" in image.getbands():
        return image.convert("RGBA")

    return image.convert("RGB")


def normalize_for_bmp(image: Image.Image) -> Image.Image:
    return image.convert("RGB")


def normalize_for_tiff(image: Image.Image) -> Image.Image:
    if image.mode in ("RGB", "RGBA", "L", "LA"):
        return image.copy()

    return image.convert("RGB")


def normalize_for_ico(image: Image.Image) -> Image.Image:
    if image.mode in ("RGB", "RGBA"):
        return image.copy()

    return image.convert("RGBA")


def normalize_for_gif(image: Image.Image) -> Image.Image:
    if image.mode == "P":
        return image.copy()

    return image.convert(
        "P",
        palette=Image.Palette.ADAPTIVE,
    )


# ============================================================
# IMAGE → SVG
# ============================================================

def create_svg_from_image(image: Image.Image) -> bytes:
    png_buffer = io.BytesIO()
    png_image = normalize_for_png(image)

    try:
        png_image.save(
            png_buffer,
            format="PNG",
            optimize=False,
            compress_level=3,
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
    viewBox="0 0 {width} {height}">
    <image
        width="{width}"
        height="{height}"
        preserveAspectRatio="none"
        href="data:image/png;base64,{encoded}"
    />
</svg>
"""

    return svg.encode("utf-8")


def create_svg_with_size_target(
    image: Image.Image,
    max_bytes: int,
) -> bytes:
    working = image

    try:
        for _ in range(12):
            result = create_svg_from_image(working)
            size = len(result)

            if MIN_OUTPUT_BYTES <= size <= max_bytes:
                return result

            if size > max_bytes:
                scale = max(
                    0.50,
                    min(
                        0.90,
                        math.sqrt(max_bytes / size) * 0.98,
                    ),
                )
            else:
                scale = min(
                    1.50,
                    max(
                        1.05,
                        math.sqrt(MIN_OUTPUT_BYTES / size) * 1.02,
                    ),
                )

            new_width = max(
                1,
                min(
                    10000,
                    int(working.width * scale),
                ),
            )
            new_height = max(
                1,
                min(
                    10000,
                    int(working.height * scale),
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

        final_result = create_svg_from_image(working)

        # SVG safely supports XML comments, so a small output can
        # be brought up to the 50 KB minimum without changing the image.
        if len(final_result) < MIN_OUTPUT_BYTES:
            padding_size = (
                MIN_OUTPUT_BYTES
                - len(final_result)
                + 32
            )

            padding = (
                "<!--"
                + ("F" * padding_size)
                + "-->"
            ).encode("utf-8")

            marker = b"</svg>"

            final_result = final_result.replace(
                marker,
                padding + marker,
                1,
            )

        if len(final_result) <= max_bytes:
            return final_result

        raise HTTPException(
            status_code=400,
            detail=(
                "The resized SVG could not be created "
                f"within the required 50 KB to "
                f"{max_bytes / 1024:.0f} KB range."
            ),
        )

    finally:
        if working is not image:
            try:
                working.close()
            except Exception:
                pass


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

    if output_format in ("jpg", "jpeg"):
        processed = normalize_for_jpeg(image)

        try:
            processed.save(
                buffer,
                format="JPEG",
                quality=max(5, min(100, quality)),
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
                compress_level=3,
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
                quality=max(5, min(100, quality)),
                method=1,
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
            # ICO has practical icon-size limits. Pillow will
            # encode the requested image as an ICO resource.
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
                quality=max(5, min(100, quality)),
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

    elif output_format in ("heic", "heif"):
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
                quality=max(5, min(100, quality)),
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
            detail=f"Unsupported output format: {output_format}",
        )

    return buffer.getvalue()


# ============================================================
# FAST RESIZE
# ============================================================

def resize_image_fast(
    image: Image.Image,
    width: int,
    height: int,
) -> Image.Image:
    if image.width == width and image.height == height:
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
# QUALITY-BASED FORMATS
# ============================================================

QUALITY_FORMATS = {
    "jpg",
    "jpeg",
    "webp",
    "avif",
    "heic",
    "heif",
}


def try_quality_range(
    image: Image.Image,
    output_format: str,
    dpi: int,
    min_bytes: int,
    max_bytes: int,
) -> bytes | None:
    # Fast path first.
    first = save_image_to_bytes(
        image,
        output_format,
        dpi,
        quality=82,
    )

    first_size = len(first)

    if min_bytes <= first_size <= max_bytes:
        return first

    # If the image is too large, lower quality quickly.
    if first_size > max_bytes:
        qualities = (68, 55, 42, 30, 20, 12, 6)

        for quality in qualities:
            result = save_image_to_bytes(
                image,
                output_format,
                dpi,
                quality=quality,
            )
            size = len(result)

            if min_bytes <= size <= max_bytes:
                return result

            if size < min_bytes:
                # Lower quality cannot help once the result
                # has dropped below the minimum.
                break

    # If the image is too small, increase quality.
    else:
        qualities = (92, 100)

        for quality in qualities:
            result = save_image_to_bytes(
                image,
                output_format,
                dpi,
                quality=quality,
            )
            size = len(result)

            if min_bytes <= size <= max_bytes:
                return result

            if size > max_bytes:
                break

    return None


# ============================================================
# OUTPUT PADDING WITHOUT CHANGING IMAGE DIMENSIONS
# ============================================================

def pad_output_to_min_size(
    data: bytes,
    output_format: str,
    min_bytes: int,
    max_bytes: int,
) -> bytes | None:
    """Increase file size without changing pixel dimensions."""
    if len(data) >= min_bytes:
        return data if len(data) <= max_bytes else None

    needed = min_bytes - len(data)
    fmt = output_format.lower()

    # JPEG: add valid COM marker(s) before EOI.
    if fmt in ("jpg", "jpeg"):
        if not data.endswith(b"\xff\xd9"):
            return None

        remaining = needed
        chunks: list[bytes] = []
        while remaining > 0:
            payload_size = min(remaining, 65520)
            segment = (
                b"\xff\xfe"
                + (payload_size + 2).to_bytes(2, "big")
                + (b"F" * payload_size)
            )
            chunks.append(segment)
            remaining -= payload_size

        padded = data[:-2] + b"".join(chunks) + data[-2:]
        return padded if len(padded) <= max_bytes else None

    # PNG: add a valid ancillary tEXt chunk before IEND.
    if fmt == "png":
        import zlib

        marker = b"IEND"
        marker_pos = data.rfind(marker)
        if marker_pos < 4:
            return None

        payload = b"Filevixo\x00" + (b"F" * max(0, needed - 12))
        chunk = (
            len(payload).to_bytes(4, "big")
            + b"tEXt"
            + payload
            + zlib.crc32(b"tEXt" + payload).to_bytes(4, "big")
        )
        padded = data[:marker_pos - 4] + chunk + data[marker_pos - 4:]
        return padded if len(padded) <= max_bytes else None

    # GIF: add a valid comment extension before the trailer.
    if fmt == "gif":
        if not data.endswith(b"\x3b"):
            return None

        remaining = needed
        blocks = bytearray(b"\x21\xfe")
        while remaining > 0:
            block_size = min(remaining, 255)
            blocks.append(block_size)
            blocks.extend(b"F" * block_size)
            remaining -= block_size
        blocks.append(0)

        padded = data[:-1] + bytes(blocks) + data[-1:]
        return padded if len(padded) <= max_bytes else None

    # WebP: add a valid RIFF JUNK chunk and update RIFF size.
    if fmt == "webp" and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        payload_size = needed
        chunk = b"JUNK" + payload_size.to_bytes(4, "little") + (b"F" * payload_size)
        if payload_size % 2:
            chunk += b"\x00"
        padded = data + chunk
        riff_size = len(padded) - 8
        padded = padded[:4] + riff_size.to_bytes(4, "little") + padded[8:]
        return padded if len(padded) <= max_bytes else None

    # ISO-BMFF based AVIF/HEIF: append a valid free box.
    if fmt in ("avif", "heic", "heif"):
        box_size = needed + 8
        box = box_size.to_bytes(4, "big") + b"free" + (b"F" * needed)
        padded = data + box
        return padded if len(padded) <= max_bytes else None

    # BMP/ICO/TIFF readers generally tolerate trailing bytes, but only use
    # this fallback when there is enough headroom and the container is known.
    if fmt in ("bmp", "ico", "tiff"):
        padded = data + (b"F" * needed)
        return padded if len(padded) <= max_bytes else None

    return None


# ============================================================
# GENERAL SIZE TARGET
# ============================================================

def create_output_with_size_target(
    image: Image.Image,
    output_format: str,
    dpi: int,
    max_bytes: int,
) -> bytes:
    if output_format == "svg":
        result = create_svg_from_image(image)
        if len(result) < MIN_OUTPUT_BYTES:
            padding_size = MIN_OUTPUT_BYTES - len(result) + 32
            padding = ("<!--" + ("F" * padding_size) + "-->").encode("utf-8")
            result = result.replace(b"</svg>", padding + b"</svg>", 1)
        if MIN_OUTPUT_BYTES <= len(result) <= max_bytes:
            return result
        if len(result) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"The resized SVG is larger than the selected maximum of {max_bytes / 1024:.0f} KB.",
            )
        raise HTTPException(
            status_code=400,
            detail="The resized SVG could not reach the 50 KB minimum without changing its requested dimensions.",
        )

    # First encode at the requested dimensions.
    if output_format in QUALITY_FORMATS:
        result = try_quality_range(
            image,
            output_format,
            dpi,
            MIN_OUTPUT_BYTES,
            max_bytes,
        )
    else:
        result = save_image_to_bytes(
            image,
            output_format,
            dpi,
            quality=85,
        )
        if not (MIN_OUTPUT_BYTES <= len(result) <= max_bytes):
            result = None

    if result is not None:
        return result

    # If the requested dimensions produce a file below 50 KB, pad the
    # container instead of enlarging the image. This preserves exact width
    # and height requested by the user.
    if output_format in QUALITY_FORMATS:
        base = save_image_to_bytes(image, output_format, dpi, quality=100)
    else:
        base = save_image_to_bytes(image, output_format, dpi, quality=100)

    padded = pad_output_to_min_size(
        base,
        output_format,
        MIN_OUTPUT_BYTES,
        max_bytes,
    )
    if padded is not None:
        return padded

    # If the requested dimensions are too large for the selected maximum,
    # only quality-based formats can still be reduced without changing size.
    if output_format in QUALITY_FORMATS:
        for quality in (90, 80, 70, 60, 50, 40, 30, 20, 10, 5):
            result = save_image_to_bytes(
                image,
                output_format,
                dpi,
                quality=quality,
            )
            if MIN_OUTPUT_BYTES <= len(result) <= max_bytes:
                return result

    raise HTTPException(
        status_code=400,
        detail=(
            "The resized image could not be created within the required "
            f"50 KB to {max_bytes / 1024:.0f} KB range for "
            f"{output_format.upper()} while keeping the requested dimensions."
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
    validate_image_upload(file)

    # --------------------------------------------------------
    # Validate dimensions
    # --------------------------------------------------------

    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=400,
            detail="Width and height must be greater than zero.",
        )

    if width > 10000 or height > 10000:
        raise HTTPException(
            status_code=400,
            detail=(
                "Maximum image dimensions are "
                "10000 × 10000 pixels."
            ),
        )

    # --------------------------------------------------------
    # DPI
    # --------------------------------------------------------

    dpi = max(
        1,
        min(
            1200,
            dpi,
        ),
    )

    # --------------------------------------------------------
    # Format
    # --------------------------------------------------------

    output_format = normalize_output_format(
        output_format
    )

    # --------------------------------------------------------
    # Maximum output size
    #
    # Allowed values are exactly 100 KB or 200 KB.
    # The generated file must be at least 50 KB.
    # --------------------------------------------------------

    if max_size_kb is None:
        max_size_bytes = DEFAULT_MAX_OUTPUT_BYTES

    else:
        if not math.isfinite(max_size_kb):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Maximum file size must be "
                    "100 KB or 200 KB."
                ),
            )

        if max_size_kb not in (100, 200):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Maximum file size must be "
                    "100 KB or 200 KB."
                ),
            )

        max_size_bytes = int(
            max_size_kb * 1024
        )

    if max_size_bytes < MIN_OUTPUT_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Maximum file size cannot be below 50 KB.",
        )

    if max_size_bytes > ABSOLUTE_MAX_OUTPUT_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Maximum file size cannot exceed 200 KB.",
        )

    # --------------------------------------------------------
    # Read upload
    # --------------------------------------------------------

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = None
    resized = None
    output_path = None

    try:
        # ----------------------------------------------------
        # Open original
        # ----------------------------------------------------

        image = open_image_from_bytes(data)
        image.load()

        original_width = image.width
        original_height = image.height

        # ----------------------------------------------------
        # Aspect ratio
        # ----------------------------------------------------

        if maintain_aspect:
            ratio = min(
                width / original_width,
                height / original_height,
            )

            width = max(
                1,
                int(original_width * ratio),
            )

            height = max(
                1,
                int(original_height * ratio),
            )

        # ----------------------------------------------------
        # Fast resize
        # ----------------------------------------------------

        resized = resize_image_fast(
            image,
            int(width),
            int(height),
        )

        # ----------------------------------------------------
        # Create output in the requested 50 KB → max range
        # ----------------------------------------------------

        output_bytes = create_output_with_size_target(
            resized,
            output_format,
            dpi,
            max_size_bytes,
        )

        # ----------------------------------------------------
        # Final size check
        # ----------------------------------------------------

        output_size = len(output_bytes)

        if output_size < MIN_OUTPUT_BYTES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The resized image is smaller than "
                    "the required minimum file size of 50 KB."
                ),
            )

        if output_size > max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The resized image is larger than "
                    f"the selected maximum of "
                    f"{max_size_bytes / 1024:.0f} KB."
                ),
            )

        # ----------------------------------------------------
        # Extension
        # ----------------------------------------------------

        extension = (
            "jpg"
            if output_format == "jpeg"
            else output_format
        )

        # ----------------------------------------------------
        # Output path
        # ----------------------------------------------------

        output_path = get_unique_output_path(
            extension,
            "filevixo-resized",
        )

        # ----------------------------------------------------
        # Write output
        # ----------------------------------------------------

        with open(
            output_path,
            "wb",
        ) as output_file:
            output_file.write(output_bytes)

        # ----------------------------------------------------
        # Verify file
        # ----------------------------------------------------

        if not os.path.exists(output_path):
            raise HTTPException(
                status_code=500,
                detail="The resized image could not be created.",
            )

        disk_size = os.path.getsize(output_path)

        if (
            disk_size < MIN_OUTPUT_BYTES
            or disk_size > max_size_bytes
        ):
            raise HTTPException(
                status_code=500,
                detail=(
                    "The generated file does not meet "
                    f"the required 50 KB to "
                    f"{max_size_bytes / 1024:.0f} KB range."
                ),
            )

    except HTTPException:
        if output_path:
            delete_file(str(output_path))
        raise

    except Exception as error:
        if output_path:
            delete_file(str(output_path))

        raise HTTPException(
            status_code=500,
            detail=f"Image resize failed: {error}",
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

    # --------------------------------------------------------
    # Delete after response
    # --------------------------------------------------------

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return FileResponse(
        path=output_path,
        media_type=MIME_TYPES.get(
            output_format,
            "application/octet-stream",
        ),
        filename=f"filevixo-resized.{extension}",
    )
