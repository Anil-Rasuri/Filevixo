FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    python3-uno \
    fonts-dejavu \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install -r requirements.txt

COPY . .

RUN mkdir -p /app/temp/libreoffice-profile

EXPOSE 8000

CMD ["sh", "-c", "soffice --headless --nologo --nodefault --nofirststartwizard --norestore --nolockcheck -env:UserInstallation=file:///app/temp/libreoffice-profile --accept='socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext' >/tmp/libreoffice.log 2>&1 & exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]