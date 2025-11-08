# My-sky Web Application

React 18 + TypeScript + Vite で構築された位置情報ベースのソーシャルネットワーキングWebアプリケーション

## 🚀 技術スタック

- **React 18** - UIライブラリ
- **TypeScript** - 型安全性
- **Vite** - ビルドツール
- **React Router** - ルーティング
- **TanStack Query** - データフェッチング
- **Zustand** - 状態管理
- **TailwindCSS** - スタイリング
- **shadcn/ui** - UIコンポーネント
- **Lucide React** - アイコン
- **Axios** - HTTP クライアント

## 📋 前提条件

- Node.js 18以上
- npm または yarn
- mysky-api (バックエンドAPI) が起動している必要があります

## ⚙️ セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 開発サーバー起動

```bash
npm run dev
```

アプリケーションは http://localhost:5173 で起動します。

### 3. ビルド

```bash
npm run build
```

ビルドされたファイルは `dist/` ディレクトリに出力されます。

### 4. プレビュー

```bash
npm run preview
```

## 🏗️ プロジェクト構造

```
mysky-web/
├── public/              # 静的ファイル
├── src/
│   ├── components/      # Reactコンポーネント
│   │   ├── layout/      # レイアウトコンポーネント
│   │   └── ui/          # UIコンポーネント (shadcn/ui)
│   ├── hooks/           # カスタムフック
│   ├── lib/             # ユーティリティ
│   │   ├── api.ts       # APIクライアント
│   │   └── utils.ts     # ヘルパー関数
│   ├── pages/           # ページコンポーネント
│   ├── store/           # 状態管理 (Zustand)
│   ├── types/           # TypeScript型定義
│   ├── App.tsx          # アプリケーションルート
│   ├── main.tsx         # エントリーポイント
│   └── index.css        # グローバルスタイル
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 🎯 主な機能

- ✅ ユーザー認証 (ログイン/登録)
- ✅ JWT トークンベースの認証
- ✅ フィード表示
- ✅ サークル一覧・参加
- ✅ イベント一覧・参加
- ✅ ユーザープロフィール
- ✅ 位置情報ベースの探索
- ✅ レスポンシブデザイン
- ✅ PWA対応

## 🔧 環境変数

環境変数は不要です。バックエンドAPIへのプロキシ設定は `vite.config.ts` で定義されています。

```typescript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true
    }
  }
}
```

## 🎨 UIコンポーネント

このプロジェクトは [shadcn/ui](https://ui.shadcn.com/) を使用しています。

使用しているコンポーネント：
- Button
- Card
- Input
- Toast
- Dialog
- Dropdown Menu
- Avatar
- Tabs
- Separator

## 📱 PWA対応

このアプリケーションはProgressive Web App (PWA) として動作します。

- オフライン対応
- インストール可能
- プッシュ通知（将来実装予定）

## 🧪 テスト

```bash
# ユニットテスト
npm test

# カバレッジ
npm run test:coverage
```

## 📦 ビルドとデプロイ

### 本番ビルド

```bash
npm run build
```

### Dockerを使用したデプロイ

```bash
docker build -t mysky-web:latest .
docker run -p 80:80 mysky-web:latest
```

### Netlify / Vercel へのデプロイ

1. GitHubリポジトリに接続
2. ビルドコマンド: `npm run build`
3. 公開ディレクトリ: `dist`

## 🔍 トラブルシューティング

### APIエラー

バックエンドAPI (mysky-api) が起動していることを確認してください。

```bash
# mysky-apiを起動
cd ../mysky-api
./mvnw spring-boot:run
```

### ポート競合

ポート5173が使用中の場合、別のポートを指定できます：

```bash
npm run dev -- --port 3000
```

## 🤝 貢献

プルリクエストを歓迎します！

## 📝 ライセンス

MIT License

## 📧 サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
