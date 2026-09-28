from fastapi import APIRouter
import threading

from utils.core import *


router = APIRouter()


# Word files can use significant RAM during conversion.
# Keep this operation below the general 25 MB upload limit.
MAX_WORD_TO_PDF_SIZE = 10 * 1024 * 1024  # 10 MB


# Persistent LibreOffice UNO server.
LIBREOFFICE_HOST = "127.0.0.1"
LIBREOFFICE_PORT = 2002


# A single LibreOffice instance is shared by the backend.
# Serialize conversions to keep memory usage predictable on Render Free.
WORD_TO_PDF_LOCK = threading.Lock()


# Python script executed by Debian's system Python.
#
# python3-uno is installed for the system Python, so we deliberately
# use /usr/bin/python3 instead of the application's Python environment.
UNO_CONVERSION_SCRIPT = r"""
import sys
import time
from pathlib import Path

import uno


INPUT_PATH = Path(sys.argv[1]).resolve()
OUTPUT_PATH = Path(sys.argv[2]).resolve()
HOST = sys.argv[3]
PORT = sys.argv[4]


def make_property(name, value):
    prop = uno.createUnoStruct("com.sun.star.beans.PropertyValue")
    prop.Name = name
    prop.Value = value
    return prop


def file_url(path):
    return uno.systemPathToFileUrl(str(path))


# Connect to the already-running LibreOffice process.
local_context = uno.getComponentContext()

resolver = local_context.ServiceManager.createInstanceWithContext(
    "com.sun.star.bridge.UnoUrlResolver",
    local_context,
)

connection_url = (
    f"uno:socket,host={HOST},port={PORT};"
    "urp;StarOffice.ComponentContext"
)


remote_context = None

last_error = None

for _ in range(30):
    try:
        remote_context = resolver.resolve(connection_url)
        break
    except Exception as error:
        last_error = error
        time.sleep(0.5)


if remote_context is None:
    raise RuntimeError(
        f"Unable to connect to LibreOffice: {last_error}"
    )


service_manager = remote_context.ServiceManager

desktop = service_manager.createInstanceWithContext(
    "com.sun.star.frame.Desktop",
    remote_context,
)


input_url = file_url(INPUT_PATH)
output_url = file_url(OUTPUT_PATH)


load_properties = (
    make_property("Hidden", True),
    make_property("ReadOnly", True),
    make_property(
        "UpdateDocMode",
        3,
    ),
)


document = None

try:
    document = desktop.loadComponentFromURL(
        input_url,
        "_blank",
        0,
        load_properties,
    )

    if document is None:
        raise RuntimeError(
            "LibreOffice could not open the Word document."
        )

    export_properties = (
        make_property(
            "FilterName",
            "writer_pdf_Export",
        ),
        make_property(
            "Overwrite",
            True,
        ),
    )

    document.storeToURL(
        output_url,
        export_properties,
    )

finally:
    if document is not None:
        try:
            document.close(True)
        except Exception:
            try:
                document.dispose()
            except Exception:
                pass


if not OUTPUT_PATH.exists():
    raise RuntimeError(
        "LibreOffice did not create the PDF output."
    )

print("PDF_CREATED")
"""


def get_soffice_path():
    """
    Kept for compatibility with the existing project utilities.

    The new implementation does not launch soffice for each request.
    LibreOffice is started once by Docker and accessed through UNO.
    """
    return find_libreoffice()


def convert_word_with_uno(
    input_path: Path,
    output_path: Path,
):
    """
    Convert a Word document using the persistent LibreOffice UNO server.

    This function intentionally uses Debian's system Python because
    python3-uno is installed for that Python environment.
    """

    result = subprocess.run(
        [
            "/usr/bin/python3",
            "-c",
            UNO_CONVERSION_SCRIPT,
            str(input_path),
            str(output_path),
            LIBREOFFICE_HOST,
            str(LIBREOFFICE_PORT),
        ],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=60,
    )

    stdout = result.stdout.strip()
    stderr = result.stderr.strip()

    if result.returncode != 0:
        diagnostic = (
            stderr
            or stdout
            or "LibreOffice UNO conversion failed."
        )

        raise RuntimeError(
            f"LibreOffice conversion failed. Details: {diagnostic}"
        )

    if not output_path.exists():
        diagnostic = (
            stderr
            or stdout
            or "LibreOffice produced no PDF output."
        )

        raise RuntimeError(
            f"LibreOffice did not create the PDF output. "
            f"Details: {diagnostic}"
        )


@router.post("/api/word-to-pdf")
async def word_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    extension = Path(file.filename).suffix.lower()

    if extension not in {".doc", ".docx"}:
        raise HTTPException(
            status_code=400,
            detail="Only DOC and DOCX files are supported.",
        )

    data = await read_uploaded_bytes(
        file,
        MAX_WORD_TO_PDF_SIZE,
    )

    temp_dir = Path(
        tempfile.mkdtemp(
            prefix="filevixo-word-pdf-",
            dir=TEMP_DIR,
        )
    )

    safe_filename = Path(file.filename).name

    input_path = temp_dir / safe_filename
    output_path = temp_dir / f"{input_path.stem}.pdf"

    try:
        input_path.write_bytes(data)

        # Release uploaded bytes before conversion.
        del data

        # LibreOffice is shared by the backend.
        # Serialize conversions to avoid excessive memory usage.
        with WORD_TO_PDF_LOCK:
            await asyncio.to_thread(
                convert_word_with_uno,
                input_path,
                output_path,
            )

        background_tasks.add_task(
            delete_directory,
            temp_dir,
        )

        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=f"{input_path.stem}.pdf",
        )

    except subprocess.TimeoutExpired:
        delete_directory(temp_dir)

        raise HTTPException(
            status_code=504,
            detail="Word to PDF conversion timed out.",
        )

    except HTTPException:
        delete_directory(temp_dir)
        raise

    except Exception as error:
        delete_directory(temp_dir)

        raise HTTPException(
            status_code=500,
            detail=f"Word to PDF conversion failed: {error}",
        )