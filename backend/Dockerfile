FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PDF_FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf \
    PDF_FONT_BOLD_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf

RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY scripts ./scripts

RUN useradd --create-home --uid 10001 brightway \
    && mkdir -p /srv/.storage \
    && chown -R brightway:brightway /srv
USER brightway

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import os, sys, urllib.request; port = os.environ.get('PORT', '8000'); sys.exit(urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=3).status != 200)"

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
