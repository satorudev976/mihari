# mihari

Gmail のサブスク・請求系メールを監視し、LINE 公式アカウント経由でユーザーにプッシュ通知するサービス。

## 概要

| 項目 | 内容 |
|------|------|
| 目的 | Gmail 内のサブスクリプション・請求メールを自動検出し LINE で通知 |
| プラットフォーム | iOS (Expo / React Native) |
| バックエンド | Google Cloud Run (Node.js / TypeScript) |
| 通知方式 | ポーリング (Cloud Scheduler) → 将来 Gmail Pub/Sub へ拡張可能 |

## アーキテクチャ

```
┌──────────────┐       ┌──────────────────────────────────┐
│  iOS App     │       │  Google Cloud                     │
│  (Expo)      │       │                                   │
│              │──────▶│  Cloud Run (Express API)          │
│  - Google    │       │    ├ /auth/google                 │
│    OAuth     │       │    ├ /line/link/start             │
│  - LINE連携  │       │    ├ /line/webhook                │
│  - フィルタ  │       │    ├ /filters (CRUD)              │
│    設定      │       │    └ /jobs/poll                   │
└──────────────┘       │                                   │
                       │  Cloud Scheduler ──▶ /jobs/poll   │
                       │  Firestore (DB)                   │
                       │  Secret Manager (secrets)         │
                       └──────────┬───────────┬────────────┘
                                  │           │
                           ┌──────▼──┐  ┌─────▼──────┐
                           │ Gmail   │  │ LINE       │
                           │ API     │  │ Messaging  │
                           │(OAuth2) │  │ API        │
                           └─────────┘  └────────────┘
```

## プロジェクト構成

```
mihari/
├── README.md
├── deploy.sh                    # GCP デプロイスクリプト
├── docs/
│   ├── architecture.md          # アーキテクチャ仕様 + シーケンス図
│   ├── api-spec.md              # API 仕様書
│   └── firestore-schema.md      # Firestore スキーマ定義
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env.example
│   └── src/
│       ├── index.ts             # Express エントリポイント
│       ├── types/index.ts       # 型定義
│       ├── utils/
│       │   ├── firestore.ts     # Firestore 接続
│       │   ├── crypto.ts        # AES-256-GCM 暗号化
│       │   └── logger.ts        # 構造化 JSON ログ
│       ├── middleware/
│       │   └── schedulerAuth.ts # Scheduler 認証ガード
│       ├── routes/
│       │   ├── auth.ts          # Google OAuth
│       │   ├── line.ts          # LINE 連携・Webhook
│       │   └── filters.ts      # フィルタ CRUD
│       ├── services/
│       │   ├── gmail.ts         # Gmail API 操作
│       │   ├── line.ts          # LINE push/reply
│       │   └── linkCode.ts     # 6桁連携コード
│       └── jobs/
│           └── poll.ts          # ポーリングジョブ
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── app.json
    ├── lib/
    │   ├── api.ts               # バックエンド API クライアント
    │   └── auth.ts              # Google OAuth フック
    └── app/
        ├── _layout.tsx          # Stack ナビゲーション
        ├── index.tsx            # ホーム画面
        ├── link-line.tsx        # LINE 連携画面
        ├── filters.tsx          # フィルタ一覧
        └── add-filter.tsx       # フィルタ追加
```

## 必要な外部サービス

| サービス | 用途 | 設定場所 |
|---------|------|---------|
| Google Cloud プロジェクト | Cloud Run, Firestore, Scheduler, Secret Manager | [GCP Console](https://console.cloud.google.com) |
| Google OAuth 2.0 | Gmail API アクセス | GCP > API とサービス > 認証情報 |
| LINE Developers | Messaging API (公式アカウント) | [LINE Developers](https://developers.line.biz) |

## セットアップ手順

### 1. 前提条件のインストール

```bash
# Node.js 20+
node -v  # v20.x.x

# gcloud CLI
gcloud version

# Expo CLI
npx expo --version
```

### 2. GCP プロジェクト設定

```bash
# プロジェクト作成 & API 有効化
gcloud projects create YOUR_PROJECT_ID
gcloud config set project YOUR_PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  gmail.googleapis.com
```

#### Firestore データベース作成

```bash
gcloud firestore databases create --location=asia-northeast1
```

#### Google OAuth 認証情報

1. GCP Console → API とサービス → 認証情報 → OAuth 2.0 クライアント ID を作成
2. アプリケーションの種類: **iOS** (Bundle ID: `com.jp.pripri.mihari`)
3. スコープ: `https://www.googleapis.com/auth/gmail.readonly`
4. `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` をメモ

#### LINE 公式アカウント設定

1. [LINE Developers](https://developers.line.biz) でプロバイダー作成
2. Messaging API チャネルを作成
3. チャネルアクセストークン（長期）を発行
4. Webhook URL は後ほど Cloud Run の URL + `/line/webhook` を設定

### 3. Secret Manager にシークレットを登録

```bash
# 暗号化キー生成
TOKEN_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# 各シークレットを登録
echo -n "YOUR_GOOGLE_CLIENT_ID" | gcloud secrets create google-client-id --data-file=-
echo -n "YOUR_GOOGLE_CLIENT_SECRET" | gcloud secrets create google-client-secret --data-file=-
echo -n "YOUR_LINE_CHANNEL_ACCESS_TOKEN" | gcloud secrets create line-channel-access-token --data-file=-
echo -n "YOUR_LINE_CHANNEL_SECRET" | gcloud secrets create line-channel-secret --data-file=-
echo -n "$TOKEN_KEY" | gcloud secrets create token-encryption-key --data-file=-
echo -n "YOUR_SCHEDULER_SECRET" | gcloud secrets create scheduler-secret --data-file=-
```

### 4. バックエンドのローカル起動

```bash
cd backend
npm install
cp .env.example .env
# .env を編集して各値を設定
npm run dev
# → http://localhost:8080 で起動
```

### 5. GCP へデプロイ

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=asia-northeast1  # 任意

./deploy.sh
```

デプロイ後の出力に表示される Service URL を以下に設定:
- **LINE Developers** → Messaging API → Webhook URL: `https://YOUR_URL/line/webhook`
- **GCP Console** → OAuth 認証情報 → リダイレクト URI

### 6. フロントエンド (iOS アプリ)

```bash
cd frontend
npm install

# 環境変数を設定
export EXPO_PUBLIC_API_URL=https://YOUR_CLOUD_RUN_URL
export EXPO_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID

npx expo start --ios
```

## 使い方

1. **Gmail 連携** — アプリで「Google でログイン」→ Gmail readonly 権限を許可
2. **LINE 連携** — アプリで「連携コード発行」→ LINE 公式アカウントを友だち追加 → コードを送信
3. **フィルタ設定** — プリセット（領収書・サブスク更新・決済サービス）を追加、またはカスタムクエリを作成
4. **自動通知** — Cloud Scheduler が定期的にメールをチェックし、新着を LINE で通知

## 詳細ドキュメント

- [アーキテクチャ仕様・シーケンス図](./docs/architecture.md)
- [API 仕様書](./docs/api-spec.md)
- [Firestore スキーマ定義](./docs/firestore-schema.md)

## ライセンス

Private
