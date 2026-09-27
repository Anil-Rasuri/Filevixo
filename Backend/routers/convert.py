from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from utils.core import *

import base64
import gc
import io
from pathlib import Path

from PIL import Image


router = APIRouter()


# ---------------------------------------------------------
# Optional HEIC / HEIF support
# ---------------------------------------------------------

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
    HEIF_AVAILABLE = True
except ImportError:
    HEIF_AVAILABLE = False


# ---------------------------------------------------------
# Required output size
# ---------------------------------------------------------

MIN_OUTPUT_BYTES = 50 * 1024
MAX_OUTPUT_BYTES = 100 * 1024


# ---------------------------------------------------------
# Supported output formats
# ---------------------------------------------------------

OUTPUT_FORMATS = {
    "jpg": {
        "pillow": "JPEG",
        "extension": "jpg",
        "media_type": "image/jpeg",
    },
    "jpeg": {
        "pillow": "JPEG",
        "extension": "jpeg",
        "media_type": "image/jpeg",
    },
    "png": {
        "pillow": "PNG",
        "extension": "png",
        "media_type": "image/png",
    },
    "webp": {
        "pillow": "WEBP",
        "extension": "webp",
        "media_type": "image/webp",
    },
    "gif": {
        "pillow": "GIF",
        "extension": "gif",
        "media_type": "image/gif",
    },
    "bmp": {
        "pillow": "BMP",
        "extension": "bmp",
        "media_type": "image/bmp",
    },
    "tiff": {
        "pillow": "TIFF",
        "extension": "tiff",
        "media_type": "image/tiff",
    },
    "ico": {
        "pillow": "ICO",
        "extension": "ico",
        "media_type": "image/x-icon",
    },
    "avif": {
        "pillow": "AVIF",
        "extension": "avif",
        "media_type": "image/avif",
    },
    "heic": {
        "pillow": "HEIF",
        "extension": "heic",
        "media_type": "image/heic",
    },
    "heif": {
        "pillow": "HEIF",
        "extension": "heif",
        "media_type": "image/heif",
    },
    "svg": {
        "pillow": None,
        "extension": "svg",
        "media_type": "image/svg+xml",
    },
}


# ---------------------------------------------------------
# SVG helpers
# ---------------------------------------------------------

def build_svg_bytes(
    image: Image.Image,
    embedded_png_quality_level: int = 6,
) -> bytes:
    """
    Creates a valid SVG containing the raster image
    as an embedded PNG.
    """

    png_buffer = io.BytesIO()

    rgba_image = image.convert("RGBA")

    try:
        rgba_image.save(
            png_buffer,
            format="PNG",
            optimize=False,
            compress_level=embedded_png_quality_level,
        )

        png_bytes = png_buffer.getvalue()

        encoded_image = base64.b64encode(
            png_bytes
        ).decode("ascii")

        width, height = rgba_image.size

        svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg
    xmlns="http://www.w3.org/2000/svg"
    width="{width}"
    height="{height}"
    viewBox="0 0 {width} {height}"
>
    <image
        width="{width}"
        height="{height}"
        href="data:image/png;base64,{encoded_image}"
    />
</svg>
"""

        return svg.encode("utf-8")

    finally:
        rgba_image.close()


def raster_image_to_svg(
    image: Image.Image,
) -> bytes:
    """
    Creates a valid SVG containing the raster image
    as an embedded PNG.
    """

    return build_svg_bytes(
        image,
        embedded_png_quality_level=6,
    )


def svg_input_to_image(
    data: bytes,
) -> Image.Image:
    """
    SVG input requires a renderer to rasterize it.
    """

    raise HTTPException(
        status_code=400,
        detail=(
            "SVG input is not supported yet on this Windows setup. "
            "SVG output is supported."
        ),
    )


# ---------------------------------------------------------
# SVG size adjustment
# ---------------------------------------------------------

def create_svg_with_size_target(
    image: Image.Image,
    output_path: Path,
) -> int:
    """
    Creates an SVG whose final file size is between
    50 KB and 100 KB.

    Strategy:

    1. Generate the normal SVG.
    2. If it is too large, reduce image dimensions.
    3. If it is still too small, add harmless XML comments.
    4. Verify the final file size from disk.

    The actual image remains valid SVG content.
    """

    current = image
    owns_current = False

    try:

        # -------------------------------------------------
        # First normal SVG
        # -------------------------------------------------

        svg_data = raster_image_to_svg(
            current
        )

        output_path.write_bytes(
            svg_data
        )

        actual_size = (
            output_path.stat().st_size
        )

        if (
            MIN_OUTPUT_BYTES
            <= actual_size
            <= MAX_OUTPUT_BYTES
        ):
            return actual_size

        # -------------------------------------------------
        # If SVG is too large:
        # reduce dimensions.
        # -------------------------------------------------

        if actual_size > MAX_OUTPUT_BYTES:

            for _ in range(12):

                width, height = current.size

                if (
                    width <= 32
                    or height <= 32
                ):
                    break

                scale = 0.78

                new_width = max(
                    1,
                    int(width * scale),
                )

                new_height = max(
                    1,
                    int(height * scale),
                )

                new_width = min(
                    new_width,
                    4096,
                )

                new_height = min(
                    new_height,
                    4096,
                )

                if (
                    new_width == width
                    and new_height == height
                ):
                    break

                resized = current.resize(
                    (new_width, new_height),
                    Image.Resampling.LANCZOS,
                )

                if owns_current:

                    try:
                        current.close()
                    except Exception:
                        pass

                current = resized
                owns_current = True

                svg_data = raster_image_to_svg(
                    current
                )

                output_path.write_bytes(
                    svg_data
                )

                actual_size = (
                    output_path.stat().st_size
                )

                if (
                    MIN_OUTPUT_BYTES
                    <= actual_size
                    <= MAX_OUTPUT_BYTES
                ):
                    return actual_size

                gc.collect()

        # -------------------------------------------------
        # If SVG is too small:
        # add harmless XML comment padding.
        # -------------------------------------------------

        actual_size = (
            output_path.stat().st_size
        )

        if actual_size < MIN_OUTPUT_BYTES:

            svg_data = output_path.read_bytes()

            required_padding = (
                MIN_OUTPUT_BYTES
                - len(svg_data)
            )

            # XML comment overhead:
            #
            # <!-- -->
            #
            # We keep the padding well below the
            # 100 KB maximum.
            comment_prefix = b"\n<!-- "
            comment_suffix = b" -->\n"

            padding_length = max(
                0,
                required_padding
                - len(comment_prefix)
                - len(comment_suffix),
            )

            padding = (
                b"F"
                * padding_length
            )

            padded_svg = (
                svg_data
                + comment_prefix
                + padding
                + comment_suffix
            )

            # If the exact padding pushed the file
            # slightly above 100 KB, reduce it.
            if len(padded_svg) > MAX_OUTPUT_BYTES:

                allowed_padding = (
                    MAX_OUTPUT_BYTES
                    - len(svg_data)
                    - len(comment_prefix)
                    - len(comment_suffix)
                )

                allowed_padding = max(
                    0,
                    allowed_padding,
                )

                padded_svg = (
                    svg_data
                    + comment_prefix
                    + (
                        b"F"
                        * allowed_padding
                    )
                    + comment_suffix
                )

            output_path.write_bytes(
                padded_svg
            )

            actual_size = (
                output_path.stat().st_size
            )

            if (
                MIN_OUTPUT_BYTES
                <= actual_size
                <= MAX_OUTPUT_BYTES
            ):
                return actual_size

        # -------------------------------------------------
        # Final verification
        # -------------------------------------------------

        if output_path.exists():

            actual_size = (
                output_path.stat().st_size
            )

            if (
                MIN_OUTPUT_BYTES
                <= actual_size
                <= MAX_OUTPUT_BYTES
            ):
                return actual_size

        delete_file(
            str(output_path)
        )

        raise ValueError(
            "Could not produce an SVG output "
            "between 50 KB and 100 KB."
        )

    finally:

        if owns_current:

            try:
                current.close()
            except Exception:
                pass

        gc.collect()


# ---------------------------------------------------------
# Image opening
# ---------------------------------------------------------

def open_input_image(
    data: bytes,
    filename: str,
) -> Image.Image:

    extension = (
        Path(filename).suffix.lower().lstrip(".")
        if filename
        else ""
    )

    if extension == "svg":
        return svg_input_to_image(data)

    try:

        image = open_image_from_bytes(
            data
        )

        image.load()

        return image

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail=f"Could not read the image: {error}",
        )


# ---------------------------------------------------------
# Optional format checks
# ---------------------------------------------------------

def validate_optional_format(
    output_format: str,
) -> None:

    if output_format in {
        "heic",
        "heif",
    }:

        if not HEIF_AVAILABLE:

            raise HTTPException(
                status_code=400,
                detail=(
                    "HEIC/HEIF support is not installed. "
                    "Run: pip install pillow-heif"
                ),
            )


# ---------------------------------------------------------
# Image preparation
# ---------------------------------------------------------

def prepare_image_for_output(
    image: Image.Image,
    output_format: str,
) -> Image.Image:

    if output_format in {
        "jpg",
        "jpeg",
    }:

        return normalize_image(
            image
        )

    if output_format == "bmp":

        if image.mode not in {
            "RGB",
            "L",
        }:

            return image.convert(
                "RGB"
            )

        return image

    if output_format == "gif":

        if image.mode not in {
            "1",
            "L",
            "P",
            "RGB",
            "RGBA",
        }:

            return image.convert(
                "RGBA"
            )

        return image

    if output_format == "ico":

        if image.mode not in {
            "RGB",
            "RGBA",
        }:

            return image.convert(
                "RGBA"
            )

        return image

    if output_format in {
        "heic",
        "heif",
    }:

        if image.mode not in {
            "RGB",
            "RGBA",
        }:

            return image.convert(
                "RGBA"
            )

        return image

    if output_format == "avif":

        if image.mode not in {
            "RGB",
            "RGBA",
        }:

            return image.convert(
                "RGBA"
            )

        return image

    if image.mode not in {
        "1",
        "L",
        "P",
        "RGB",
        "RGBA",
        "LA",
    }:

        return image.convert(
            "RGBA"
        )

    return image


# ---------------------------------------------------------
# Fast output encoder
# ---------------------------------------------------------

def encode_image_fast(
    image: Image.Image,
    output_path: Path,
    output_format: str,
    quality: int = 82,
) -> None:

    save_format = OUTPUT_FORMATS[
        output_format
    ]["pillow"]

    save_kwargs = {
        "format": save_format,
    }

    if output_format in {
        "jpg",
        "jpeg",
    }:

        save_kwargs.update(
            {
                "quality": quality,
                "optimize": False,
                "progressive": False,
            }
        )

    elif output_format == "webp":

        save_kwargs.update(
            {
                "quality": quality,
                "method": 3,
            }
        )

    elif output_format == "png":

        save_kwargs.update(
            {
                "optimize": False,
                "compress_level": 6,
            }
        )

    elif output_format == "gif":

        save_kwargs.update(
            {
                "optimize": False,
            }
        )

    elif output_format == "bmp":

        pass

    elif output_format == "tiff":

        save_kwargs.update(
            {
                "compression": "tiff_deflate",
            }
        )

    elif output_format == "ico":

        width, height = image.size

        max_dimension = max(
            width,
            height,
        )

        if max_dimension > 256:

            ratio = (
                256
                / max_dimension
            )

            new_size = (
                max(
                    1,
                    int(
                        width * ratio
                    ),
                ),
                max(
                    1,
                    int(
                        height * ratio
                    ),
                ),
            )

            resized = image.resize(
                new_size,
                Image.Resampling.LANCZOS,
            )

            try:

                resized.save(
                    output_path,
                    **save_kwargs,
                    sizes=[
                        resized.size
                    ],
                )

            finally:

                resized.close()

            return

        save_kwargs.update(
            {
                "sizes": [
                    image.size
                ],
            }
        )

    elif output_format == "avif":

        save_kwargs.update(
            {
                "quality": quality,
            }
        )

    elif output_format in {
        "heic",
        "heif",
    }:

        save_kwargs.update(
            {
                "quality": quality,
            }
        )

    image.save(
        output_path,
        **save_kwargs,
    )


# ---------------------------------------------------------
# Resize helper
# ---------------------------------------------------------

def resize_for_size_target(
    image: Image.Image,
    scale: float,
) -> Image.Image:

    width, height = image.size

    new_width = max(
        1,
        int(width * scale),
    )

    new_height = max(
        1,
        int(height * scale),
    )

    return image.resize(
        (
            new_width,
            new_height,
        ),
        Image.Resampling.LANCZOS,
    )


# ---------------------------------------------------------
# Universal 50–100 KB encoder
# ---------------------------------------------------------

def convert_to_50_100kb(
    image: Image.Image,
    output_path: Path,
    output_format: str,
) -> int:

    # -----------------------------------------------------
    # SVG
    # -----------------------------------------------------

    if output_format == "svg":

        return create_svg_with_size_target(
            image,
            output_path,
        )

    # -----------------------------------------------------
    # Prepare image
    # -----------------------------------------------------

    prepared = prepare_image_for_output(
        image,
        output_format,
    )

    owns_prepared = (
        prepared is not image
    )

    current = prepared
    owns_current = owns_prepared

    try:

        # -------------------------------------------------
        # FAST PATH
        # -------------------------------------------------

        encode_image_fast(
            current,
            output_path,
            output_format,
            quality=82,
        )

        actual_size = (
            output_path.stat().st_size
        )

        if (
            MIN_OUTPUT_BYTES
            <= actual_size
            <= MAX_OUTPUT_BYTES
        ):

            return actual_size

        # -------------------------------------------------
        # JPEG / WEBP / AVIF / HEIC / HEIF
        # -------------------------------------------------

        if output_format in {
            "jpg",
            "jpeg",
            "webp",
            "avif",
            "heic",
            "heif",
        }:

            if actual_size > MAX_OUTPUT_BYTES:

                qualities = [
                    72,
                    62,
                    52,
                    42,
                    32,
                    24,
                    18,
                ]

            else:

                qualities = [
                    88,
                    94,
                    97,
                ]

            for quality in qualities:

                encode_image_fast(
                    current,
                    output_path,
                    output_format,
                    quality=quality,
                )

                actual_size = (
                    output_path.stat().st_size
                )

                if (
                    MIN_OUTPUT_BYTES
                    <= actual_size
                    <= MAX_OUTPUT_BYTES
                ):

                    return actual_size

                if (
                    actual_size < MIN_OUTPUT_BYTES
                    and quality < 90
                ):
                    break

                if (
                    actual_size > MAX_OUTPUT_BYTES
                    and quality >= 88
                ):
                    break

        # -------------------------------------------------
        # Dimension adjustment
        # -------------------------------------------------

        for _ in range(12):

            actual_size = (
                output_path.stat().st_size
                if output_path.exists()
                else 0
            )

            if (
                MIN_OUTPUT_BYTES
                <= actual_size
                <= MAX_OUTPUT_BYTES
            ):

                return actual_size

            width, height = (
                current.size
            )

            if (
                width <= 32
                or height <= 32
            ):

                break

            if actual_size > MAX_OUTPUT_BYTES:

                scale = 0.78

            else:

                scale = 1.12

            new_width = max(
                1,
                int(
                    width * scale
                ),
            )

            new_height = max(
                1,
                int(
                    height * scale
                ),
            )

            new_width = min(
                new_width,
                4096,
            )

            new_height = min(
                new_height,
                4096,
            )

            if (
                new_width == width
                and new_height == height
            ):

                break

            resized = current.resize(
                (
                    new_width,
                    new_height,
                ),
                Image.Resampling.LANCZOS,
            )

            if owns_current:

                try:
                    current.close()
                except Exception:
                    pass

            current = resized
            owns_current = True

            encode_image_fast(
                current,
                output_path,
                output_format,
                quality=82,
            )

            actual_size = (
                output_path.stat().st_size
            )

            if (
                MIN_OUTPUT_BYTES
                <= actual_size
                <= MAX_OUTPUT_BYTES
            ):

                return actual_size

            gc.collect()

        # -------------------------------------------------
        # Final quality search
        # -------------------------------------------------

        if output_format in {
            "jpg",
            "jpeg",
            "webp",
            "avif",
            "heic",
            "heif",
        }:

            for quality in range(
                95,
                4,
                -5,
            ):

                encode_image_fast(
                    current,
                    output_path,
                    output_format,
                    quality=quality,
                )

                actual_size = (
                    output_path.stat().st_size
                )

                if (
                    MIN_OUTPUT_BYTES
                    <= actual_size
                    <= MAX_OUTPUT_BYTES
                ):

                    return actual_size

                if (
                    actual_size
                    < MIN_OUTPUT_BYTES
                ):

                    break

        # -------------------------------------------------
        # Final verification
        # -------------------------------------------------

        if output_path.exists():

            actual_size = (
                output_path.stat().st_size
            )

            if (
                MIN_OUTPUT_BYTES
                <= actual_size
                <= MAX_OUTPUT_BYTES
            ):

                return actual_size

        delete_file(
            str(output_path)
        )

        raise ValueError(
            "Could not produce an output image "
            "between 50 KB and 100 KB for this format."
        )

    finally:

        if owns_current:

            try:
                current.close()
            except Exception:
                pass

        gc.collect()


# ---------------------------------------------------------
# API
# ---------------------------------------------------------

@router.post("/api/convert-image")
async def convert_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    output_format: str = Form("png"),

    target_size_kb: int | None = Form(None),
    targetSizeKB: int | None = Form(None),
    targetSize: int | None = Form(None),
    target_size: int | None = Form(None),

    max_size_kb: int | None = Form(None),
    maxSizeKB: int | None = Form(None),
    maxSize: int | None = Form(None),
):

    # -----------------------------------------------------
    # Validate upload
    # -----------------------------------------------------

    validate_image_upload(
        file
    )

    # -----------------------------------------------------
    # Resolve existing target-size aliases
    # -----------------------------------------------------

    requested_target_size = next(
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

    # -----------------------------------------------------
    # Normalize format
    # -----------------------------------------------------

    output_format = (
        output_format
        .strip()
        .lower()
    )

    if output_format not in OUTPUT_FORMATS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported output format. "
                "Supported formats: JPG, JPEG, PNG, WEBP, "
                "GIF, BMP, TIFF, ICO, AVIF, HEIC, HEIF, SVG."
            ),
        )

    validate_optional_format(
        output_format
    )

    # -----------------------------------------------------
    # Existing target validation
    # -----------------------------------------------------

    if (
        requested_target_size is not None
        and requested_target_size <= 0
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Target size must be greater than zero."
            ),
        )

    # -----------------------------------------------------
    # Read upload
    # -----------------------------------------------------

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = None
    output_path = None

    try:

        # -------------------------------------------------
        # Open image
        # -------------------------------------------------

        image = open_input_image(
            data,
            file.filename or "",
        )

        config = OUTPUT_FORMATS[
            output_format
        ]

        extension = config[
            "extension"
        ]

        output_path = (
            get_unique_output_path(
                extension,
                "filevixo-converted",
            )
        )

        # -------------------------------------------------
        # Universal 50–100 KB conversion
        # -------------------------------------------------

        with HEAVY_OPERATION_LOCK:

            actual_size = (
                convert_to_50_100kb(
                    image,
                    output_path,
                    output_format,
                )
            )

        # -------------------------------------------------
        # Final mandatory safety check
        # -------------------------------------------------

        actual_size = (
            output_path.stat().st_size
        )

        if (
            actual_size < MIN_OUTPUT_BYTES
            or actual_size > MAX_OUTPUT_BYTES
        ):

            delete_file(
                str(output_path)
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Maximum-size safety check failed. "
                    f"Output is "
                    f"{actual_size / 1024:.1f} KB. "
                    "Required range is 50–100 KB."
                ),
            )

    except ValueError as error:

        if output_path is not None:

            delete_file(
                str(output_path)
            )

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except HTTPException:

        if output_path is not None:

            delete_file(
                str(output_path)
            )

        raise

    except Exception as error:

        if output_path is not None:

            delete_file(
                str(output_path)
            )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Image conversion failed: {error}"
            ),
        )

    finally:

        if image is not None:

            try:
                image.close()
            except Exception:
                pass

        del data

        gc.collect()

    # -----------------------------------------------------
    # Temporary-file cleanup
    # -----------------------------------------------------

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    # -----------------------------------------------------
    # Return file
    # -----------------------------------------------------

    config = OUTPUT_FORMATS[
        output_format
    ]

    return FileResponse(
        path=output_path,
        media_type=config[
            "media_type"
        ],
        filename=(
            "filevixo-converted."
            f"{config['extension']}"
        ),
    )