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
import gc
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
        output_format
        or "jpg"
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
    """
    Create a completely independent RGB image.

    This avoids using an image that may later be
    closed by another Pillow operation.
    """

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
    """
    Create an independent image suitable for PNG.
    """

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
    """
    WebP supports RGB and RGBA.
    """

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
    """
    BMP does not need alpha.
    """

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
    """
    ICO works reliably with RGBA/RGB.
    """

    if image.mode in (
        "RGB",
        "RGBA",
    ):
        return image.copy()

    return image.convert("RGBA")


def normalize_for_gif(
    image: Image.Image,
) -> Image.Image:
    """
    GIF supports palette mode.
    """

    if image.mode == "P":
        return image.copy()

    if image.mode == "RGBA":
        return image.convert(
            "P",
            palette=Image.Palette.ADAPTIVE,
        )

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
    """
    Creates a valid SVG containing the resized raster image.

    This does NOT trace the image into vector paths.
    It embeds a PNG inside the SVG.

    This avoids Cairo/CairoSVG dependencies.
    """

    png_buffer = io.BytesIO()

    png_image = normalize_for_png(
        image
    )

    try:
        png_image.save(
            png_buffer,
            format="PNG",
            optimize=True,
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
# SAVE IMAGE TO BYTES
# ============================================================

def save_image_to_bytes(
    image: Image.Image,
    output_format: str,
    dpi: int,
    quality: int = 90,
) -> bytes:

    buffer = io.BytesIO()

    output_format = (
        output_format.lower()
    )

    if output_format == "svg":
        return create_svg_from_image(
            image
        )

    if output_format in (
        "jpg",
        "jpeg",
    ):
        processed = normalize_for_jpeg(
            image
        )

        try:
            processed.save(
                buffer,
                format="JPEG",
                quality=quality,
                optimize=True,
                progressive=True,
                dpi=(dpi, dpi),
            )
        finally:
            processed.close()

    elif output_format == "png":
        processed = normalize_for_png(
            image
        )

        try:
            processed.save(
                buffer,
                format="PNG",
                optimize=True,
                dpi=(dpi, dpi),
            )
        finally:
            processed.close()

    elif output_format == "webp":
        processed = normalize_for_webp(
            image
        )

        try:
            processed.save(
                buffer,
                format="WEBP",
                quality=quality,
                method=6,
            )
        finally:
            processed.close()

    elif output_format == "gif":
        processed = normalize_for_gif(
            image
        )

        try:
            processed.save(
                buffer,
                format="GIF",
                optimize=True,
            )
        finally:
            processed.close()

    elif output_format == "bmp":
        processed = normalize_for_bmp(
            image
        )

        try:
            processed.save(
                buffer,
                format="BMP",
            )
        finally:
            processed.close()

    elif output_format == "tiff":
        processed = normalize_for_tiff(
            image
        )

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
        processed = normalize_for_ico(
            image
        )

        try:
            processed.save(
                buffer,
                format="ICO",
            )
        finally:
            processed.close()

    elif output_format == "avif":
        processed = normalize_for_webp(
            image
        )

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

        processed = normalize_for_jpeg(
            image
        )

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
# MAXIMUM FILE SIZE
# ============================================================

def create_output_with_max_size(
    image: Image.Image,
    output_format: str,
    dpi: int,
    max_size_bytes: int,
) -> bytes:

    # SVG is already generated as a complete document.
    if output_format == "svg":
        result = save_image_to_bytes(
            image,
            output_format,
            dpi,
            quality=90,
        )

        if len(result) > max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The SVG output is larger than "
                    "the selected maximum file size. "
                    "Please choose a larger limit."
                ),
            )

        return result

    # Try high quality first.
    quality_values = [
        95,
        90,
        85,
        80,
        75,
        70,
        65,
        60,
        55,
        50,
        45,
        40,
        35,
        30,
        25,
        20,
        15,
        10,
    ]

    # Formats where quality compression makes sense.
    quality_formats = {
        "jpg",
        "jpeg",
        "webp",
        "avif",
        "heic",
        "heif",
    }

    if output_format not in quality_formats:
        result = save_image_to_bytes(
            image,
            output_format,
            dpi,
            quality=90,
        )

        if len(result) > max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The resized image cannot be "
                    "saved within the selected "
                    "maximum file size using "
                    f"{output_format.upper()} format."
                ),
            )

        return result

    best_result = None

    for quality in quality_values:
        result = save_image_to_bytes(
            image,
            output_format,
            dpi,
            quality=quality,
        )

        if len(result) <= max_size_bytes:
            return result

        best_result = result

    # If quality compression was not enough,
    # progressively reduce dimensions while
    # preserving the exact requested dimensions
    # as much as possible.
    #
    # Normally the quality loop above should
    # handle JPG/WEBP/AVIF/HEIC.
    if best_result is not None:
        raise HTTPException(
            status_code=400,
            detail=(
                "The image could not be compressed "
                f"below {max_size_bytes / 1024:.0f} KB "
                "at the requested dimensions. "
                "Please increase the maximum file size "
                "or reduce the dimensions."
            ),
        )

    raise HTTPException(
        status_code=400,
        detail=(
            "Unable to create an output image "
            "within the selected file size."
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

    # IMPORTANT:
    # Frontend no longer sends this.
    # False means width and height are completely
    # independent.
    maintain_aspect: bool = Form(False),

    unit: str = Form("px"),

    output_format: str = Form("jpg"),

    dpi: int = Form(96),

    max_size_kb: float | None = Form(
        None
    ),
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
    # MAX FILE SIZE
    # ========================================================

    max_size_bytes = None

    if max_size_kb is not None:
        if (
            not isinstance(
                max_size_kb,
                (int, float),
            )
            or max_size_kb <= 0
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Maximum file size must "
                    "be greater than zero."
                ),
            )

        max_size_bytes = int(
            max_size_kb * 1024
        )

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

        # Force Pillow to actually load the image
        # while it is still valid.
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
        # RESIZE
        # ====================================================

        resized = image.resize(
            (
                int(width),
                int(height),
            ),
            Image.Resampling.LANCZOS,
        )

        # ====================================================
        # FORCE PIXELS INTO MEMORY
        #
        # This is important because it ensures
        # the resized image is independent from
        # the original image/file.
        # ====================================================

        resized.load()

        # ====================================================
        # CREATE OUTPUT BYTES
        # ====================================================

        if max_size_bytes is not None:
            output_bytes = (
                create_output_with_max_size(
                    resized,
                    output_format,
                    dpi,
                    max_size_bytes,
                )
            )
        else:
            output_bytes = save_image_to_bytes(
                resized,
                output_format,
                dpi,
                quality=90,
            )

        # ====================================================
        # FINAL SIZE CHECK
        # ====================================================

        if not output_bytes:
            raise HTTPException(
                status_code=500,
                detail=(
                    "The server generated "
                    "an empty image."
                ),
            )

        if (
            max_size_bytes is not None
            and len(output_bytes)
            > max_size_bytes
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "The generated image exceeds "
                    "the selected maximum file size."
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

        output_path = (
            get_unique_output_path(
                extension,
                "filevixo-resized",
            )
        )

        # ====================================================
        # WRITE BYTES TO DISK
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

        if (
            os.path.getsize(
                output_path
            )
            <= 0
        ):
            raise HTTPException(
                status_code=500,
                detail=(
                    "The resized image "
                    "is empty."
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
        # ====================================================
        # CLOSE ONLY THE IMAGES WE CREATED/OPENED
        # ====================================================

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

        # Release Python/Pillow memory.
        gc.collect()

    # ========================================================
    # DELETE OUTPUT AFTER RESPONSE
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