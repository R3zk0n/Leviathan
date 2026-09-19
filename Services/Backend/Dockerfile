# syntax=docker/dockerfile:1
FROM python:3.11-slim

ARG TARGETPLATFORM
ARG TARGETARCH
ARG RADARE2_VERSION=6.2.0
ARG R2GHIDRA_VERSION=6.2.0
ARG JADX_VERSION=v1.5.6

ENV TARGETPLATFORM=$TARGETPLATFORM \
    TARGETARCH=$TARGETARCH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    JAVA_HOME=/usr/lib/jvm/default-java \
    PATH="/opt/jadx/jadx/bin:$PATH" \
    R2GHIDRA_SLEIGHHOME=/usr/share/radare2/r2ghidra_sleigh \
    RADARE2_VERSION=$RADARE2_VERSION \
    R2GHIDRA_VERSION=$R2GHIDRA_VERSION

RUN apt-get update && apt-get install -y --no-install-recommends \
        apt-transport-https \
        ca-certificates \
        libssl-dev \
        libffi-dev \
        gcc \
        python3-dev \
        build-essential \
        libpq-dev \
        netcat-openbsd \
        git \
        wget \
        curl \
        unzip \
        pkg-config \
        default-jre-headless \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libgdk-pixbuf-xlib-2.0-0 \
        libcairo2 \
        libgobject-2.0-0 \
        libgirepository1.0-dev \
        gir1.2-pango-1.0 \
    && ln -sfn "$(dirname "$(dirname "$(readlink -f "$(which java)")")")" /usr/lib/jvm/default-java \
    && rm -rf /var/lib/apt/lists/*

COPY constraints.txt /tmp/constraints.txt
COPY docker /tmp/docker
RUN chmod +x /tmp/docker/install-r2.sh

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip wheel 'setuptools<81'

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install \
        celery redis pyaxmlparser flask_jwt_extended frida frida-tools playwright \
        'capstone>=5.0.1,<6' 'androguard>=4.1.0'

WORKDIR /opt/jadx
RUN JADX_CLEAN=${JADX_VERSION#v} \
    && wget -q "https://github.com/skylot/jadx/releases/download/${JADX_VERSION}/jadx-${JADX_CLEAN}.zip" \
    && unzip -q "jadx-${JADX_CLEAN}.zip" -d jadx \
    && rm "jadx-${JADX_CLEAN}.zip"

WORKDIR /opt
RUN /tmp/docker/install-r2.sh
RUN python /tmp/docker/install-strongarm.py
RUN python /tmp/docker/install-ipsw.py
RUN python /tmp/docker/install-icdump.py

WORKDIR /usr/src/app
COPY requirements.txt /usr/src/app/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    grep -vE '^\s*(icdump|strongarm)' requirements.txt > /tmp/requirements_filtered.txt \
    && pip install -c /tmp/constraints.txt -r /tmp/requirements_filtered.txt \
    && pip install -c /tmp/constraints.txt jinja2 weasyprint lief k2l matplotlib \
    && pip install --force-reinstall \
        'requests<2.29.0' 'urllib3<2.0' 'setuptools<81' \
        'typing_extensions>=4.6.0' 'alembic>=1.13.0' 'dataset>=1.6.0'

COPY . /usr/src/app
RUN chmod +x /usr/src/app/entrypoint.sh /usr/src/app/entrypoint.ios.sh \
    && mkdir -p /var/log/celery

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
