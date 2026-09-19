# syntax=docker/dockerfile:1
FROM python:3.12-slim

ARG TARGETARCH
ARG ANDROID_PLATFORMS_REPO=https://github.com/Sable/android-platforms.git
ARG ANDROID_PLATFORMS_REF=master
ARG APPSHARK_REPO=https://github.com/cxxsheng/appshark.git
ARG APPSHARK_REF=main
ARG JADX_VERSION=v1.5.6
ARG DEX2JAR_VERSION=2.4.37
ARG VINEFLOWER_VERSION=1.12.0
ARG ANDROID_API_LEVELS="android-23 android-26 android-28 android-30 android-31 android-33 android-34 android-35"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    GRADLE_HOME=/opt/gradle \
    PATH="/opt/gradle/bin:/opt/jadx/bin:/opt/dex2jar:$PATH" \
    PYTHONPATH=/opt/engine \
    WORKER_DIR=/opt/engine

RUN apt-get update && apt-get install -y --no-install-recommends \
        default-jdk-headless dos2unix git wget unzip curl tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN wget -q https://services.gradle.org/distributions/gradle-7.3.3-bin.zip \
    && unzip -q gradle-7.3.3-bin.zip \
    && rm gradle-7.3.3-bin.zip \
    && mv gradle-7.3.3 gradle

WORKDIR /appshark_engine
RUN git clone --depth 1 --branch "${APPSHARK_REF}" "${APPSHARK_REPO}" /appshark_engine/appshark

WORKDIR /appshark_engine/appshark
RUN set -eu; \
    tmp_dir="$(mktemp -d)"; \
    git clone --depth 1 --filter=blob:none --sparse --branch "${ANDROID_PLATFORMS_REF}" \
      "${ANDROID_PLATFORMS_REPO}" "${tmp_dir}/android-platforms"; \
    git -C "${tmp_dir}/android-platforms" sparse-checkout set ${ANDROID_API_LEVELS}; \
    target="/appshark_engine/appshark/config/tools/platforms"; \
    mkdir -p "${target}"; \
    for d in ${ANDROID_API_LEVELS}; do \
      if [ -f "${tmp_dir}/android-platforms/${d}/android.jar" ]; then \
        mkdir -p "${target}/${d}"; \
        cp -f "${tmp_dir}/android-platforms/${d}/android.jar" "${target}/${d}/android.jar"; \
      fi; \
    done; \
    rm -rf "${tmp_dir}"

RUN --mount=type=cache,target=/root/.gradle \
    gradle build -x test \
    && mkdir -p /appshark_engine/appshark/uploads

WORKDIR /opt
RUN JADX_CLEAN=${JADX_VERSION#v} \
    && wget -q "https://github.com/skylot/jadx/releases/download/${JADX_VERSION}/jadx-${JADX_CLEAN}.zip" \
    && unzip -q "jadx-${JADX_CLEAN}.zip" -d jadx \
    && rm "jadx-${JADX_CLEAN}.zip" \
    && chmod +x /opt/jadx/bin/jadx \
    && mkdir -p /appshark_engine/appshark/config/tools/jadx \
    && cp -r /opt/jadx/bin /appshark_engine/appshark/config/tools/jadx/ \
    && cp -r /opt/jadx/lib /appshark_engine/appshark/config/tools/jadx/

RUN wget -q "https://github.com/ThexXTURBOXx/dex2jar/releases/download/${DEX2JAR_VERSION}/dex-tools-${DEX2JAR_VERSION}.zip" \
    && unzip -q "dex-tools-${DEX2JAR_VERSION}.zip" \
    && rm "dex-tools-${DEX2JAR_VERSION}.zip" \
    && extracted="$(find /opt -maxdepth 3 -type f -name 'd2j-dex2jar.sh' | head -n 1)" \
    && test -n "${extracted}" \
    && rm -rf /opt/dex2jar \
    && mv "$(dirname "${extracted}")" /opt/dex2jar \
    && chmod +x /opt/dex2jar/d2j-*.sh \
    && dos2unix /opt/dex2jar/*.sh 2>/dev/null || true \
    && test -x /opt/dex2jar/d2j-dex2jar.sh

RUN mkdir -p /opt/vineflower \
    && wget -q "https://github.com/Vineflower/vineflower/releases/download/${VINEFLOWER_VERSION}/vineflower-${VINEFLOWER_VERSION}.jar" \
        -O /opt/vineflower/vineflower.jar

RUN curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh \
    | sh -s -- -b /usr/local/bin

WORKDIR /appshark_engine/appshark
COPY worker/requirements.txt /opt/engine/worker/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r /opt/engine/worker/requirements.txt
COPY detectors.yaml .
COPY Rules /appshark_engine/appshark/config/rules
COPY EngineConfig.json5 /appshark_engine/appshark/config/EngineConfig.json5
COPY worker /opt/engine/worker
COPY entrypoint.sh /usr/local/bin/engine-entrypoint.sh
RUN dos2unix /usr/local/bin/engine-entrypoint.sh \
    && chmod +x /usr/local/bin/engine-entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/engine-entrypoint.sh"]
