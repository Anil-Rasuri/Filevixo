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

def raster_image_to_svg(image: Image.Image) -> bytes:
    """
    Creates a valid SVG containing the raster image as
    an embedded PNG.

    This does NOT require CairoSVG.
    """

    png_buffer = io.BytesIO()

    rgba_image = image.convert("RGBA")

    rgba_image.save(
        png_buffer,
        format="PNG",
        optimize=True,
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


def svg_input_to_image(data: bytes) -> Image.Image:
    """
    SVG input requires a renderer to rasterize it.

    CairoSVG is intentionally not imported here because
    the current Windows environment does not have the
    native Cairo library.

    SVG output is supported without Cairo.
    """

    raise HTTPException(
        status_code=400,
        detail=(
            "SVG input is not supported yet on this Windows setup. "
            "SVG output is supported."
        ),
    )


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

    # SVG input
    if extension == "svg":
        return svg_input_to_image(data)

    try:
        image = open_image_from_bytes(data)
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

    if output_format in {"heic", "heif"}:

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

    # JPEG / JPG
    if output_format in {"jpg", "jpeg"}:

        return normalize_image(image)

    # BMP
    if output_format == "bmp":

        if image.mode not in {"RGB", "L"}:
            return image.convert("RGB")

        return image

    # GIF
    if output_format == "gif":

        if image.mode not in {
            "1",
            "L",
            "P",
            "RGB",
            "RGBA",
        }:
            return image.convert("RGBA")

        return image

    # ICO
    if output_format == "ico":

        if image.mode not in {
            "RGB",
            "RGBA",
        }:
            return image.convert("RGBA")

        return image

    # HEIC / HEIF
    if output_format in {
        "heic",
        "heif",
    }:

        if image.mode not in {
            "RGB",
            "RGBA",
        }:
            return image.convert("RGBA")

        return image

    # AVIF
    if output_format == "avif":

        if image.mode not in {
            "RGB",
            "RGBA",
        }:
            return image.convert("RGBA")

        return image

    # PNG / WEBP / TIFF
    if image.mode not in {
        "1",
        "L",
        "P",
        "RGB",
        "RGBA",
        "LA",
    }:
        return image.convert("RGBA")

    return image


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

    validate_image_upload(file)

    # -----------------------------------------------------
    # Resolve target size
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Normalize format
    # -----------------------------------------------------

    output_format = output_format.strip().lower()

    if output_format not in OUTPUT_FORMATS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported output format. "
                "Supported formats: JPG, JPEG, PNG, WEBP, "
                "GIF, BMP, TIFF, ICO, AVIF, HEIC, HEIF, SVG."
            ),
        )

    validate_optional_format(output_format)

    # -----------------------------------------------------
    # Validate target size
    # -----------------------------------------------------

    if (
        target_size_kb is not None
        and target_size_kb <= 0
    ):

        raise HTTPException(
            status_code=400,
            detail="Target size must be greater than zero.",
        )

    # -----------------------------------------------------
    # Read file
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

        extension = config["extension"]

        output_path = get_unique_output_path(
            extension,
            "filevixo-converted",
        )

        # -------------------------------------------------
        # SVG output
        # -------------------------------------------------

        if output_format == "svg":

            svg_data = raster_image_to_svg(
                image
            )

            output_path.write_bytes(
                svg_data
            )

        # -------------------------------------------------
        # Target-size conversion
        # -------------------------------------------------

        elif target_size_kb is not None:

            target_bytes = (
                target_size_kb * 1024
            )

            with HEAVY_OPERATION_LOCK:

                actual_size = (
                    compress_image_to_target_size(
                        image,
                        output_path,
                        target_bytes,
                        extension,
                    )
                )

            if actual_size > target_bytes:

                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Could not meet the requested "
                        "maximum file size."
                    ),
                )

        # -------------------------------------------------
        # Normal conversion
        # -------------------------------------------------

        else:

            processed_image = image
            owns_processed = False

            try:

                prepared = (
                    prepare_image_for_output(
                        image,
                        output_format,
                    )
                )

                if prepared is not image:

                    processed_image = prepared
                    owns_processed = True

                save_kwargs = {
                    "format": config["pillow"]
                }

                # -----------------------------------------
                # JPG / JPEG
                # -----------------------------------------

                if output_format in {
                    "jpg",
                    "jpeg",
                }:

                    save_kwargs.update(
                        {
                            "quality": 90,
                            "optimize": True,
                        }
                    )

                # -----------------------------------------
                # WEBP
                # -----------------------------------------

                elif output_format == "webp":

                    save_kwargs.update(
                        {
                            "quality": 90,
                            "method": 6,
                        }
                    )

                # -----------------------------------------
                # PNG
                # -----------------------------------------

                elif output_format == "png":

                    save_kwargs.update(
                        {
                            "optimize": True,
                        }
                    )

                # -----------------------------------------
                # GIF
                # -----------------------------------------

                elif output_format == "gif":

                    if processed_image.mode == "RGBA":

                        converted = (
                            processed_image.convert(
                                "P",
                                palette=Image.Palette.ADAPTIVE,
                            )
                        )

                        if owns_processed:

                            try:
                                processed_image.close()
                            except Exception:
                                pass

                        processed_image = converted
                        owns_processed = True

                    save_kwargs.update(
                        {
                            "optimize": True
                        }
                    )

                # -----------------------------------------
                # TIFF
                # -----------------------------------------

                elif output_format == "tiff":

                    save_kwargs.update(
                        {
                            "compression": "tiff_deflate"
                        }
                    )

                # -----------------------------------------
                # ICO
                # -----------------------------------------

                elif output_format == "ico":

                    width, height = (
                        processed_image.size
                    )

                    max_dimension = max(
                        width,
                        height,
                    )

                    if max_dimension > 256:

                        ratio = (
                            256 / max_dimension
                        )

                        new_size = (
                            max(
                                1,
                                int(width * ratio),
                            ),
                            max(
                                1,
                                int(height * ratio),
                            ),
                        )

                        resized = (
                            processed_image.resize(
                                new_size,
                                Image.Resampling.LANCZOS,
                            )
                        )

                        if owns_processed:

                            try:
                                processed_image.close()
                            except Exception:
                                pass

                        processed_image = resized
                        owns_processed = True

                    save_kwargs.update(
                        {
                            "sizes": [
                                processed_image.size
                            ]
                        }
                    )

                # -----------------------------------------
                # AVIF
                # -----------------------------------------

                elif output_format == "avif":

                    save_kwargs.update(
                        {
                            "quality": 80
                        }
                    )

                # -----------------------------------------
                # HEIC / HEIF
                # -----------------------------------------

                elif output_format in {
                    "heic",
                    "heif",
                }:

                    save_kwargs.update(
                        {
                            "quality": 90
                        }
                    )

                # -----------------------------------------
                # Save output
                # -----------------------------------------

                processed_image.save(
                    output_path,
                    **save_kwargs,
                )

            finally:

                if owns_processed:

                    try:
                        processed_image.close()
                    except Exception:
                        pass

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
    # Target-size safety check
    # -----------------------------------------------------

    if target_size_kb is not None:

        actual_size = (
            output_path.stat().st_size
        )

        target_bytes = (
            target_size_kb * 1024
        )

        if actual_size > target_bytes:

            delete_file(
                str(output_path)
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Maximum-size safety check failed: "
                    f"output is "
                    f"{actual_size / 1024:.1f} KB, "
                    f"target is "
                    f"{target_size_kb} KB."
                ),
            )

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
        media_type=config["media_type"],
        filename=(
            f"filevixo-converted."
            f"{config['extension']}"
        ),
    )