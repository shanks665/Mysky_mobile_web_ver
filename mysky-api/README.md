# My-sky API - バックエンドサービス

位置情報ベースのソーシャルネットワーキングアプリケーションのバックエンドAPI

## 🚀 技術スタック

- **Java 17**
- **Spring Boot 3.2.0**
- **Spring Security** + JWT認証
- **Spring Data JPA** + Hibernate
- **PostgreSQL**
- **AWS S3** (ファイルストレージ)
- **OpenAPI/Swagger** (APIドキュメント)

## 📋 前提条件

- Java 17以上
- Maven 3.8以上
- PostgreSQL 14以上
- Docker (オプション)

## ⚙️ セットアップ

### 1. データベース設定

PostgreSQLデータベースを作成：

```sql
CREATE DATABASE mysky;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE mysky TO postgres;
```

### 2. 環境変数設定

`.env` ファイルを作成（オプション）：

```bash
DB_USERNAME=postgres
DB_PASSWORD=postgres
JWT_SECRET=mySecretKeyForJWTTokenGenerationAndValidation1234567890
S3_BUCKET_NAME=mysky-uploads
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY=your-access-key
AWS_SECRET_KEY=your-secret-key
```

### 3. アプリケーション起動

```bash
# Mavenを使用
./mvnw spring-boot:run

# または、ビルドしてから実行
./mvnw clean package
java -jar target/mysky-api-1.0.0.jar
```

アプリケーションは `http://localhost:8080` で起動します。

## 📖 APIドキュメント

アプリケーション起動後、以下のURLでAPIドキュメントにアクセスできます：

- **Swagger UI**: http://localhost:8080/swagger-ui/index.html
- **OpenAPI JSON**: http://localhost:8080/v3/api-docs

## 🔗 主要エンドポイント

### 認証 (`/api/v1/auth`)

```
POST   /api/v1/auth/register    # ユーザー登録
POST   /api/v1/auth/login       # ログイン
GET    /api/v1/auth/health      # ヘルスチェック
```

### ユーザー (`/api/v1/users`)

```
GET    /api/v1/users/me         # 現在のユーザー情報
GET    /api/v1/users/{id}       # ユーザー詳細
PUT    /api/v1/users/{id}       # ユーザー更新
DELETE /api/v1/users/{id}       # ユーザー削除
GET    /api/v1/users/search     # ユーザー検索
GET    /api/v1/users/nearby     # 近くのユーザー
POST   /api/v1/users/{id}/follow    # フォロー
DELETE /api/v1/users/{id}/follow    # フォロー解除
```

### サークル (`/api/v1/circles`)

```
GET    /api/v1/circles          # サークル一覧
POST   /api/v1/circles          # サークル作成
GET    /api/v1/circles/{id}     # サークル詳細
PUT    /api/v1/circles/{id}     # サークル更新
DELETE /api/v1/circles/{id}     # サークル削除
POST   /api/v1/circles/{id}/join    # サークル参加
DELETE /api/v1/circles/{id}/leave   # サークル退会
```

### イベント (`/api/v1/events`)

```
POST   /api/v1/events           # イベント作成
GET    /api/v1/events/{id}      # イベント詳細
PUT    /api/v1/events/{id}      # イベント更新
DELETE /api/v1/events/{id}      # イベント削除
GET    /api/v1/events/upcoming  # 今後のイベント
POST   /api/v1/events/{id}/attend    # イベント参加
DELETE /api/v1/events/{id}/attend    # 参加キャンセル
```

### 投稿 (`/api/v1/posts`)

```
POST   /api/v1/posts            # 投稿作成
GET    /api/v1/posts/{id}       # 投稿詳細
PUT    /api/v1/posts/{id}       # 投稿更新
DELETE /api/v1/posts/{id}       # 投稿削除
GET    /api/v1/posts/feed       # フィード取得
POST   /api/v1/posts/{id}/like  # いいね
DELETE /api/v1/posts/{id}/like  # いいね解除
```

## 🔐 認証

APIは JWT (JSON Web Token) ベースの認証を使用します。

### 1. ユーザー登録

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "testuser",
    "password": "password123",
    "displayName": "Test User",
    "dateOfBirth": "2000-01-01"
  }'
```

### 2. ログイン

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usernameOrEmail": "testuser",
    "password": "password123"
  }'
```

レスポンス：
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": 1,
    "username": "testuser",
    "email": "user@example.com"
  }
}
```

### 3. 認証が必要なエンドポイントへのアクセス

```bash
curl -X GET http://localhost:8080/api/v1/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🐳 Docker

### Dockerイメージのビルド

```bash
docker build -t mysky-api:latest .
```

### Docker Composeで起動

```bash
cd ..
docker-compose up -d
```

## 🧪 テスト

```bash
# すべてのテストを実行
./mvnw test

# カバレッジレポート付き
./mvnw verify
```

## 📁 プロジェクト構造

```
mysky-api/
├── src/
│   ├── main/
│   │   ├── java/com/mysky/api/
│   │   │   ├── config/          # 設定クラス
│   │   │   ├── controller/      # RESTコントローラー
│   │   │   ├── dto/             # データ転送オブジェクト
│   │   │   ├── entity/          # JPAエンティティ
│   │   │   ├── exception/       # 例外ハンドラー
│   │   │   ├── repository/      # データリポジトリ
│   │   │   ├── security/        # セキュリティ設定
│   │   │   └── service/         # ビジネスロジック
│   │   └── resources/
│   │       └── application.yml  # アプリケーション設定
│   └── test/                    # テストコード
├── Dockerfile
├── pom.xml
└── README.md
```

## 🛠️ トラブルシューティング

### データベース接続エラー

```bash
# PostgreSQLが起動しているか確認
psql -U postgres -d mysky

# 接続情報を確認
spring.datasource.url=jdbc:postgresql://localhost:5432/mysky
```

### ポート競合

```bash
# ポート8080が使用中の場合、別のポートを指定
./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8081
```

## 📝 ライセンス

MIT License

## 👥 貢献

プルリクエストを歓迎します！
