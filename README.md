# My-sky - クラウドネイティブソーシャルアプリ

位置情報ベースのソーシャルネットワーキングアプリケーション。クラウドネイティブアーキテクチャで構築された、スケーラブルでモダンなフルスタックアプリケーションです。

## 🏗️ アーキテクチャ概要

```
My-sky-main/
├── mysky-api/          # Spring Boot バックエンドAPI
├── mysky-mobile/       # React Native モバイルアプリ
└── mysky-web/          # React.js Webアプリケーション
```

### システム構成図

```
┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│                 │
│ (React Native)  │     │                 │
└─────────────────┘     │                 │
                        │   Spring Boot   │     ┌──────────────┐
┌─────────────────┐     │    REST API     │────▶│   AWS RDS    │
│    Web App      │────▶│                 │     │  PostgreSQL  │
│   (React.js)    │     │                 │     └──────────────┘
└─────────────────┘     │                 │
                        └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   AWS S3     │
                        │  File Storage│
                        └──────────────┘
```

## 📦 プロジェクト構成

### 1. mysky-api (バックエンド)
- **技術スタック**: Java 17, Spring Boot 3.2, Spring Security, JPA/Hibernate
- **データベース**: PostgreSQL (AWS RDS)
- **認証**: JWT (JSON Web Token)
- **ファイルストレージ**: AWS S3 / Google Cloud Storage
- **デプロイ**: Docker + AWS ECS / GCP GKE

**主な機能**:
- ユーザー認証・認可
- 位置情報ベースのユーザー検索
- サークル・イベント管理
- 投稿・コメント機能
- リアルタイム通知

### 2. mysky-mobile (モバイルアプリ)
- **技術スタック**: React Native 0.78, TypeScript, Firebase
- **状態管理**: React Context API
- **ナビゲーション**: React Navigation
- **テスト**: Jest, React Native Testing Library

**プラットフォーム**:
- iOS
- Android

### 3. mysky-web (Webアプリ)
- **技術スタック**: React 18, TypeScript, Vite
- **UIライブラリ**: TailwindCSS, shadcn/ui
- **状態管理**: React Query, Zustand
- **認証**: Auth0 / Firebase Auth

**機能**:
- モバイルアプリと同等の機能
- レスポンシブデザイン
- PWA対応

## 🚀 クイックスタート

### 前提条件
- Node.js 18+
- Java 17+
- Docker & Docker Compose
- AWS CLI / gcloud CLI

### ローカル開発環境のセットアップ

#### 1. バックエンドAPI起動
```bash
cd mysky-api
./mvnw spring-boot:run
```

#### 2. モバイルアプリ起動
```bash
cd mysky-mobile
npm install
npm run android  # or npm run ios
```

#### 3. Webアプリ起動
```bash
cd mysky-web
npm install
npm run dev
```

## 🐳 Docker化

### バックエンドAPI
```bash
cd mysky-api
docker build -t mysky-api:latest .
docker run -p 8080:8080 mysky-api:latest
```

### Webアプリ
```bash
cd mysky-web
docker build -t mysky-web:latest .
docker run -p 3000:80 mysky-web:latest
```

## ☁️ クラウドデプロイメント

### AWS環境
```bash
# ECRにプッシュ
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com
docker tag mysky-api:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/mysky-api:latest
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/mysky-api:latest

# ECSにデプロイ
aws ecs update-service --cluster mysky-cluster --service mysky-api-service --force-new-deployment
```

### GCP環境
```bash
# GCRにプッシュ
gcloud auth configure-docker
docker tag mysky-api:latest gcr.io/<project-id>/mysky-api:latest
docker push gcr.io/<project-id>/mysky-api:latest

# GKEにデプロイ
kubectl apply -f k8s/
```

## 🔧 開発ワークフロー

### ブランチ戦略
- `main`: 本番環境
- `develop`: 開発環境
- `feature/*`: 機能開発
- `hotfix/*`: 緊急修正

### CI/CD
- GitHub Actions
- 自動テスト実行
- Docker イメージビルド
- AWS ECS / GCP GKE デプロイ

## 📊 API仕様

### ベースURL
- 開発: `http://localhost:8080/api/v1`
- 本番: `https://api.mysky.app/v1`

### 主要エンドポイント

#### 認証
```
POST   /auth/register      # ユーザー登録
POST   /auth/login         # ログイン
POST   /auth/refresh       # トークン更新
POST   /auth/logout        # ログアウト
```

#### ユーザー
```
GET    /users              # ユーザー一覧
GET    /users/{id}         # ユーザー詳細
PUT    /users/{id}         # ユーザー更新
GET    /users/nearby       # 近くのユーザー検索
```

#### サークル
```
GET    /circles            # サークル一覧
POST   /circles            # サークル作成
GET    /circles/{id}       # サークル詳細
PUT    /circles/{id}       # サークル更新
DELETE /circles/{id}       # サークル削除
```

#### イベント
```
GET    /events             # イベント一覧
POST   /events             # イベント作成
GET    /events/{id}        # イベント詳細
PUT    /events/{id}        # イベント更新
DELETE /events/{id}        # イベント削除
```

#### 投稿
```
GET    /posts              # 投稿一覧
POST   /posts              # 投稿作成
GET    /posts/{id}         # 投稿詳細
PUT    /posts/{id}         # 投稿更新
DELETE /posts/{id}         # 投稿削除
POST   /posts/{id}/like    # いいね
POST   /posts/{id}/comment # コメント
```

## 🔒 セキュリティ

### 認証・認可
- JWT (JSON Web Token)
- OAuth 2.0 / OpenID Connect
- Spring Security

### データ保護
- HTTPS/TLS 暗号化
- パスワードハッシュ化 (BCrypt)
- SQL インジェクション対策
- XSS 対策
- CSRF 対策

## 📈 監視・ログ

### メトリクス
- AWS CloudWatch / GCP Monitoring
- Prometheus + Grafana

### ログ
- AWS CloudWatch Logs / GCP Cloud Logging
- ELK Stack (Elasticsearch, Logstash, Kibana)

### トレーシング
- AWS X-Ray / GCP Cloud Trace
- OpenTelemetry

## 🧪 テスト

### バックエンド
```bash
cd mysky-api
./mvnw test
./mvnw verify
```

### モバイル
```bash
cd mysky-mobile
npm test
npm run test:coverage
```

### Web
```bash
cd mysky-web
npm test
npm run test:e2e
```

## 📝 ライセンス

MIT License

## 👥 コントリビューション

プルリクエストを歓迎します！詳細は [CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。

## 📧 お問い合わせ

- GitHub Issues: [https://github.com/shanks665/Mysky_mobile_web_ver/issues](https://github.com/shanks665/My-sky/issues)


---

**Built with ❤️ using Spring Boot, React Native, and React.js**
