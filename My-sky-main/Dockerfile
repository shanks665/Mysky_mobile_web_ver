FROM node:18-alpine AS builder

# 必要なパッケージをインストール
RUN apk add --no-cache \
    bash \
    git \
    curl \
    openssh-client \
    python3 \
    g++ \
    make \
    && rm -rf /var/cache/apk/*

# アプリケーションディレクトリを作成
WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci

# ソースコードをコピー
COPY . .

# TypeScriptをコンパイル
RUN npm run tsc

# テスト実行
RUN npm test

# Androidビルド環境用のイメージ
FROM adoptopenjdk/openjdk11:alpine AS android-builder

# Android SDKのインストール
ENV ANDROID_HOME /opt/android-sdk
ENV ANDROID_SDK_ROOT /opt/android-sdk
ENV PATH ${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools

RUN apk add --no-cache \
    bash \
    curl \
    unzip \
    git \
    nodejs \
    npm \
    && rm -rf /var/cache/apk/*

# Android SDKをダウンロードしてインストール
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    curl -o cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-7583922_latest.zip && \
    unzip cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools && \
    mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest && \
    rm cmdline-tools.zip

# SDKパッケージをインストール
RUN mkdir -p /root/.android && \
    touch /root/.android/repositories.cfg && \
    yes | sdkmanager --licenses && \
    sdkmanager "platform-tools" \
    "platforms;android-31" \
    "build-tools;31.0.0" \
    "extras;android;m2repository" \
    "extras;google;m2repository" \
    "ndk;21.4.7075529"

# アプリケーションディレクトリを作成
WORKDIR /app

# ビルダーからアプリケーションをコピー
COPY --from=builder /app .

# Gradleキャッシュディレクトリの作成
RUN mkdir -p /root/.gradle

# Android APKのビルド
RUN cd android && ./gradlew assembleRelease --no-daemon

# 最終的なランタイムイメージ
FROM node:18-alpine AS runtime

WORKDIR /app

# 必要なファイルだけをコピー
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/index.js ./
COPY --from=builder /app/App.tsx ./
COPY --from=builder /app/tsconfig.json ./

# ビルド成果物をコピー
COPY --from=android-builder /app/android/app/build/outputs/apk/release/app-release.apk ./app-release.apk

# アプリを起動
CMD ["npm", "start"] 