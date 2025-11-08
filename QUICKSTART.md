# My-sky クイックスタートガイド

このガイドでは、My-skyプロジェクトをローカル環境で素早くセットアップして起動する方法を説明します。

## 📋 前提条件

### 必須ツール
- **Node.js** 18以上
- **Java** 17以上
- **Maven** 3.8以上
- **PostgreSQL** 14以上
- **Git**

### オプション
- **Docker** & Docker Compose
- **AWS CLI** (本番デプロイ用)

## 🚀 1. プロジェクトのクローン

```bash
git clone https://github.com/shanks665/My-sky.git
cd My-sky-main
```

## 🗄️ 2. データベースのセットアップ

### PostgreSQLのインストール

**Windows:**
```powershell
# Chocolateyを使用
choco install postgresql

# または、公式インストーラーをダウンロード
https://www.postgresql.org/download/windows/
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### データベース作成

```bash
# PostgreSQLに接続
psql -U postgres

# データベース作成（SQLプロンプト内で）
CREATE DATABASE mysky;
\q
```

## 🔧 3. バックエンドAPI起動

```bash
cd mysky-api

# アプリケーション起動
./mvnw spring-boot:run

# または、Windowsの場合
mvnw.cmd spring-boot:run
```

バックエンドAPIは `http://localhost:8080` で起動します。

### APIの確認

ブラウザで以下のURLにアクセス：
- **ヘルスチェック**: http://localhost:8080/api/v1/auth/health
- **Swagger UI**: http://localhost:8080/swagger-ui/index.html

## 📱 4. モバイルアプリ起動（オプション）

```bash
cd ../My-sky-main

# 依存関係のインストール
npm install

# Androidエミュレーター起動
npm run android

# または、iOSシミュレーター起動（macOSのみ）
npm run ios
```

## 🌐 5. Webアプリ起動（オプション）

```bash
cd ../mysky-web

# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev
```

Webアプリは `http://localhost:5173` で起動します。

## 🐳 Docker Composeを使用した起動（推奨）

すべてのサービスを一度に起動：

```bash
# プロジェクトルートで
docker-compose up -d

# ログ確認
docker-compose logs -f
```

サービス：
- **PostgreSQL**: `localhost:5432`
- **mysky-api**: `http://localhost:8080`
- **mysky-web**: `http://localhost:3000`

### Docker Composeの停止

```bash
docker-compose down
```

## ✅ 動作確認

### 1. ユーザー登録テスト

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "displayName": "Test User",
    "dateOfBirth": "2000-01-01"
  }'
```

### 2. ログインテスト

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usernameOrEmail": "testuser",
    "password": "password123"
  }'
```

レスポンスからJWTトークンを取得します。

### 3. 認証付きリクエストテスト

```bash
curl -X GET http://localhost:8080/api/v1/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## 🔧 トラブルシューティング

### データベース接続エラー

```bash
# PostgreSQLが起動しているか確認
# Windows
Get-Service postgresql*

# macOS/Linux
ps aux | grep postgres

# PostgreSQLを再起動
# Windows
net stop postgresql-x64-14
net start postgresql-x64-14

# macOS
brew services restart postgresql

# Linux
sudo systemctl restart postgresql
```

### ポート競合エラー

```bash
# ポート8080が使用中の場合
./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8081
```

### Maven依存関係エラー

```bash
cd mysky-api
./mvnw clean install -U
```

### Node.js依存関係エラー

```bash
# キャッシュをクリア
npm cache clean --force

# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

## 📚 次のステップ

### APIドキュメントを確認
http://localhost:8080/swagger-ui/index.html

### 詳細なドキュメント
- [バックエンドAPI README](mysky-api/README.md)
- [メインREADME](README.md)

### 開発ワークフロー
1. 新機能は `feature/` ブランチで開発
2. プルリクエストを作成
3. コードレビュー後にマージ

## 🎯 よく使うコマンド

```bash
# バックエンド
cd mysky-api
./mvnw spring-boot:run          # 起動
./mvnw test                     # テスト実行
./mvnw clean package            # ビルド

# モバイルアプリ
cd My-sky-main
npm run android                 # Android起動
npm run ios                     # iOS起動
npm test                        # テスト実行

# Webアプリ
cd mysky-web
npm run dev                     # 開発サーバー起動
npm run build                   # ビルド
npm run preview                 # ビルド確認

# Docker
docker-compose up -d            # 全サービス起動
docker-compose down             # 全サービス停止
docker-compose logs -f          # ログ監視
```

## 💡 ヒント

- **開発時**: Hot Reloadが有効なので、コード変更は自動的に反映されます
- **データベース**: 開発環境では `ddl-auto: update` が有効で、エンティティ変更時にスキーマが自動更新されます
- **API仕様**: Swagger UIで実際にAPIを試すことができます
- **ログ**: デバッグログは `application.yml` で設定できます

## 📧 サポート

問題が発生した場合：
1. [GitHub Issues](https://github.com/shanks665/My-sky/issues) で検索
2. 新しいIssueを作成
3. メール: support@mysky.app

---

**Happy Coding! 🚀**
