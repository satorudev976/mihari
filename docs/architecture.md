# アーキテクチャ仕様書

## 1. システム全体像

```
┌─────────────┐    HTTPS     ┌─────────────────────────────────────┐
│  iOS App    │─────────────▶│  Cloud Run  (Express / TypeScript)  │
│  (Expo)     │◀─────────────│                                     │
└─────────────┘              │  /auth/google      OAuth交換        │
                             │  /line/link/start   コード発行      │
                             │  /line/webhook      LINE受信        │
                             │  /filters           CRUD            │
                             │  /jobs/poll         ポーリング      │
                             └──┬──────┬──────┬──────┬─────────────┘
                                │      │      │      │
                   ┌────────────┘      │      │      └─────────────┐
                   ▼                   ▼      ▼                    ▼
            ┌────────────┐    ┌──────────┐ ┌──────────┐   ┌──────────────┐
            │ Firestore  │    │ Gmail    │ │ LINE     │   │ Cloud        │
            │ (DB)       │    │ API      │ │ Messaging│   │ Scheduler    │
            └────────────┘    └──────────┘ │ API      │   │ (cron)       │
                                           └──────────┘   └──────────────┘
```

### コンポーネント一覧

| コンポーネント | 役割 | 技術 |
|-------------|------|------|
| iOS App | ユーザー操作 (ログイン・連携・フィルタ設定) | Expo / React Native |
| Cloud Run | API サーバー + ジョブ実行 | Node.js 20 / Express / TypeScript |
| Firestore | ユーザー情報・フィルタ・送信履歴の永続化 | Google Cloud Firestore |
| Secret Manager | シークレット管理 (API キー・暗号鍵) | Google Cloud Secret Manager |
| Cloud Scheduler | 定期ポーリングトリガー | cron ジョブ → HTTP POST |
| Gmail API | メール検索 (OAuth2 / readonly) | Google APIs |
| LINE Messaging API | プッシュ通知・Webhook 受信 | LINE Bot SDK |

---

## 2. シーケンス図

### 2.1 Google OAuth 連携フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as iOS App
    participant Google as Google OAuth
    participant API as Cloud Run
    participant DB as Firestore

    User->>App: 「Googleでログイン」タップ
    App->>Google: OAuth認可リクエスト<br/>(scope: gmail.readonly,<br/>access_type: offline,<br/>prompt: consent)
    Google->>User: ログイン & 権限同意画面
    User->>Google: 許可
    Google->>App: authCode を返却

    App->>API: POST /auth/google<br/>{ uid, authCode, redirectUri }
    API->>Google: authCode → token交換
    Google-->>API: { refresh_token, access_token }
    API->>API: refresh_token を AES-256-GCM で暗号化
    API->>DB: users/{uid} に refreshTokenEnc を保存
    API-->>App: { ok: true }
    App-->>User: 「Gmail連携完了」表示
```

### 2.2 LINE 連携フロー（連携コード方式）

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as iOS App
    participant API as Cloud Run
    participant DB as Firestore
    participant LINE as LINE App
    participant LAPI as LINE Messaging API

    User->>App: 「連携コード発行」タップ
    App->>API: POST /line/link/start { uid }
    API->>API: 6桁コード生成 (crypto.randomInt)
    API->>DB: linkCodes/{code} に保存<br/>{ uid, expiresAt: +10min, used: false }
    API-->>App: { code: "123456", expiresAt }
    App-->>User: コードを画面に表示

    User->>LINE: 公式アカウントを友だち追加
    LAPI->>API: POST /line/webhook<br/>event.type = "follow"
    API->>LAPI: reply「連携コードを送信してください」

    User->>LINE: 「123456」を送信
    LAPI->>API: POST /line/webhook<br/>event.type = "message"<br/>text = "123456"
    API->>DB: linkCodes/123456 を検索
    DB-->>API: { uid, expiresAt, used: false }
    API->>DB: linkCodes/123456.used = true
    API->>DB: users/{uid}.line = { userId, enabled: true }
    API->>LAPI: reply「連携が完了しました！」
    LAPI-->>LINE: メッセージ配信
    LINE-->>User: 「連携が完了しました！」
```

### 2.3 ポーリング（メール検出 → LINE 通知）フロー

```mermaid
sequenceDiagram
    participant Sched as Cloud Scheduler
    participant API as Cloud Run
    participant DB as Firestore
    participant Gmail as Gmail API
    participant LINE as LINE Messaging API

    Sched->>API: POST /jobs/poll<br/>(x-scheduler-secret ヘッダ)
    API->>API: schedulerAuth ミドルウェアで認証

    API->>DB: users where line.enabled == true を取得
    DB-->>API: ユーザー一覧

    loop 各ユーザーについて
        API->>API: refreshTokenEnc を復号
        API->>Gmail: refreshToken → accessToken 取得
        Gmail-->>API: accessToken

        API->>DB: users/{uid}/filters where enabled == true
        DB-->>API: フィルタ一覧

        loop 各フィルタについて
            API->>Gmail: messages.list<br/>q = "{filter.query} newer_than:2d"
            Gmail-->>API: messageId 一覧

            loop 各メッセージについて
                API->>DB: users/{uid}/sent/{messageId} 存在確認
                alt 未送信の場合
                    API->>Gmail: messages.get (metadata)
                    Gmail-->>API: Subject, From, Date, snippet
                    API->>LINE: pushMessage<br/>「【フィルタ名】件名: ... 差出人: ...」
                    LINE-->>API: 200 OK
                    API->>DB: users/{uid}/sent/{messageId} を保存
                end
            end
        end
    end

    API-->>Sched: { ok: true, processed: N }
```

### 2.4 フィルタ CRUD フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as iOS App
    participant API as Cloud Run
    participant DB as Firestore

    User->>App: フィルタ一覧を開く
    App->>API: GET /filters?uid=xxx
    API->>DB: users/{uid}/filters を取得
    DB-->>API: フィルタ一覧
    API-->>App: { filters: [...] }

    User->>App: プリセットを選択 or カスタム入力
    App->>API: POST /filters<br/>{ uid, title, query, enabled }
    API->>DB: users/{uid}/filters に追加
    API-->>App: { id, ok: true }

    User->>App: フィルタの on/off 切り替え
    App->>API: PATCH /filters/{id}?uid=xxx<br/>{ enabled: false }
    API->>DB: users/{uid}/filters/{id} を更新
    API-->>App: { ok: true }

    User->>App: フィルタ削除
    App->>API: DELETE /filters/{id}?uid=xxx
    API->>DB: users/{uid}/filters/{id} を削除
    API-->>App: { ok: true }
```

---

## 3. セキュリティ設計

### 3.1 トークン暗号化

```
暗号化方式: AES-256-GCM
鍵管理:    TOKEN_ENCRYPTION_KEY (base64, 32 bytes) → Secret Manager
保存形式:  base64( IV[12] + AuthTag[16] + Ciphertext )
```

- Gmail の refresh token は平文では Firestore に保存しない
- 暗号化鍵は Secret Manager で管理し、Cloud Run の環境変数として注入

### 3.2 エンドポイント保護

| エンドポイント | 保護方式 |
|-------------|---------|
| `/jobs/poll` | `x-scheduler-secret` ヘッダ or Cloud Run IAM 認証 |
| `/line/webhook` | LINE Platform からの HTTPS 呼び出し (将来: 署名検証追加) |
| `/auth/*`, `/filters/*` | uid ベース (将来: Firebase Auth / JWT 追加) |

### 3.3 Gmail API スコープ

`gmail.readonly` のみ使用。メールの送信・削除・変更は一切行わない。

---

## 4. 二重送信防止

```
1. Gmail API で messageId 一覧を取得
2. 各 messageId について sent/{messageId} の存在を確認
3. 存在しなければ LINE push → sent に記録
4. 存在すればスキップ
```

Firestore のドキュメント ID として Gmail messageId を使用するため、万が一の並行実行でも安全。

---

## 5. スケーラビリティ設計

### 現在 (MVP)

- Cloud Scheduler → 単一の `/jobs/poll` エンドポイント
- ユーザーを直列に処理

### 将来の拡張パス

| 段階 | 変更内容 |
|------|---------|
| **Phase 1** | `/jobs/poll` 内で `Promise.allSettled` による並列化 |
| **Phase 2** | Cloud Tasks に各ユーザーをキュー投入し Cloud Run がワーカーとして処理 |
| **Phase 3** | Gmail Push (users.watch + Pub/Sub + history.list) に移行しポーリング廃止 |

### Gmail Push 移行時の設計

```
Gmail users.watch API
    ↓ (変更通知)
Cloud Pub/Sub topic
    ↓ (push subscription)
Cloud Run /webhooks/gmail-push
    ↓
history.list で差分取得 → フィルタ照合 → LINE push
```

`/jobs/poll` と `/webhooks/gmail-push` を並行稼働させ、段階的に移行可能。

---

## 6. プラン設計

| 項目 | Free | Pro |
|------|------|-----|
| ポーリング間隔 | 15分 | 5分 |
| フィルタ数 | 3 | 無制限 |
| Gmail アカウント | 1 | 複数 |
| LINE 通知 | 月200件 | 無制限 |
