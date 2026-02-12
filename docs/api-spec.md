# API 仕様書

Base URL: `https://<CLOUD_RUN_URL>`

## 共通仕様

- Content-Type: `application/json`
- レスポンスは全て JSON 形式
- エラーレスポンス: `{ "error": "エラーメッセージ" }`

---

## 1. ヘルスチェック

### `GET /`

サービスの稼働確認。

**Response** `200 OK`
```json
{
  "status": "ok",
  "service": "subscrip-notify"
}
```

---

## 2. 認証 (Auth)

### `POST /auth/google`

iOS アプリから Google OAuth の authCode を受け取り、refresh token を暗号化して保存する。

**Request Body**
```json
{
  "uid": "user-unique-id",
  "authCode": "4/0AXXXX...",
  "redirectUri": "subscripnotify://oauth"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|------|------|------|
| uid | string | Yes | ユーザー識別子 |
| authCode | string | Yes | Google OAuth 認可コード |
| redirectUri | string | Yes | OAuth リダイレクト URI (アプリの scheme) |

**処理内容**
1. authCode を Google へ送信し `refresh_token` / `access_token` を取得
2. `refresh_token` を AES-256-GCM で暗号化
3. Firestore `users/{uid}` に保存 (merge)

**Response** `200 OK`
```json
{
  "ok": true
}
```

**Error** `500`
```json
{
  "error": "Google auth failed"
}
```

---

## 3. LINE 連携

### `POST /line/link/start`

6桁の連携コードを発行する。有効期限は 10 分。

**Request Body**
```json
{
  "uid": "user-unique-id"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|------|------|------|
| uid | string | Yes | ユーザー識別子 |

**処理内容**
1. `crypto.randomInt(100000, 999999)` で 6桁コード生成
2. Firestore `linkCodes/{code}` に保存

**Response** `200 OK`
```json
{
  "code": "482916",
  "expiresAt": "2026-02-12T15:30:00.000Z"
}
```

---

### `POST /line/webhook`

LINE Messaging API からの Webhook を受信する。LINE Developers の Webhook URL に設定する。

**Request Body** — LINE Platform が送信するイベント形式

**処理するイベント**

#### follow イベント (友だち追加)

ウェルカムメッセージを reply で返信:

> 友だち追加ありがとうございます！
> アプリに表示された6桁の連携コードをこちらに送信してください。

#### message イベント (テキスト)

テキストが 6桁の数字 (`/^\d{6}$/`) の場合、連携コードとして処理:

1. `linkCodes/{code}` を検索
2. 有効期限内かつ未使用なら:
   - `users/{uid}.line.userId` に LINE userId を保存
   - `users/{uid}.line.enabled` を `true` に設定
   - `linkCodes/{code}.used` を `true` に更新
   - reply「連携が完了しました！サブスク通知をお届けします。」
3. 無効または期限切れの場合:
   - reply「コードが無効または期限切れです。アプリから再発行してください。」

**Response** `200 OK`
```json
{
  "ok": true
}
```

---

## 4. フィルタ (Filters)

### `GET /filters?uid={uid}`

ユーザーのフィルタ一覧を取得する。作成日時の降順でソートされる。

**Query Parameters**

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| uid | string | Yes | ユーザー識別子 |

**Response** `200 OK`
```json
{
  "filters": [
    {
      "id": "abc123",
      "title": "領収書・請求書",
      "query": "subject:(領収書 OR レシート OR 請求)",
      "enabled": true,
      "createdAt": { "_seconds": 1739350000, "_nanoseconds": 0 },
      "updatedAt": { "_seconds": 1739350000, "_nanoseconds": 0 }
    }
  ]
}
```

---

### `POST /filters`

新しいフィルタを作成する。

**Request Body**
```json
{
  "uid": "user-unique-id",
  "title": "領収書・請求書",
  "query": "subject:(領収書 OR レシート OR 請求 OR 支払い OR ご利用明細)",
  "enabled": true
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|------|------|------|
| uid | string | Yes | ユーザー識別子 |
| title | string | Yes | フィルタの表示名 |
| query | string | Yes | Gmail 検索クエリ |
| enabled | boolean | No | デフォルト `true` |

**Response** `201 Created`
```json
{
  "id": "abc123",
  "ok": true
}
```

---

### `PATCH /filters/{filterId}?uid={uid}`

フィルタを更新する。送信したフィールドのみ更新される。

**Query Parameters**

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| uid | string | Yes | ユーザー識別子 |

**Request Body**
```json
{
  "title": "更新後のタイトル",
  "query": "新しいクエリ",
  "enabled": false
}
```

全フィールド任意。送信したフィールドのみ更新される。

**Response** `200 OK`
```json
{
  "ok": true
}
```

---

### `DELETE /filters/{filterId}?uid={uid}`

フィルタを削除する。

**Query Parameters**

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| uid | string | Yes | ユーザー識別子 |

**Response** `200 OK`
```json
{
  "ok": true
}
```

---

## 5. ジョブ (Jobs)

### `POST /jobs/poll`

Cloud Scheduler から定期実行されるポーリングジョブ。全対象ユーザーの Gmail を検索し、新着メールを LINE で通知する。

**認証**

以下のいずれかで保護:
- `x-scheduler-secret` ヘッダ: Secret Manager に保存した共有シークレット
- `Authorization: Bearer <token>` ヘッダ: Cloud Run IAM 認証 (OIDC トークン)

**処理フロー**

```
1. Firestore から line.enabled == true のユーザーを全取得
2. 各ユーザーについて:
   a. refresh token を復号し access token を取得
   b. enabled == true のフィルタを取得
   c. 各フィルタのクエリ + "newer_than:2d" で Gmail を検索
   d. 各メッセージについて:
      - sent/{messageId} の存在を確認（二重送信防止）
      - 未送信なら metadata を取得し LINE push
      - sent/{messageId} を保存
   e. lastCheckedAt を更新
3. 全体の送信件数を返却
```

**Response** `200 OK`
```json
{
  "ok": true,
  "processed": 5
}
```

**LINE 通知メッセージ形式**
```
【領収書・請求書】
件名: Amazon.co.jp ご注文の確認
差出人: auto-confirm@amazon.co.jp
日時: Thu, 12 Feb 2026 10:30:00 +0900
概要: ご注文ありがとうございます。合計 ¥1,280...
```

---

## 6. フィルタクエリのプリセット

| プリセット名 | Gmail 検索クエリ |
|------------|----------------|
| 領収書・請求書 | `subject:(領収書 OR レシート OR 請求 OR 支払い OR ご利用明細)` |
| サブスク更新 | `subject:(更新 OR renewal OR subscription OR 定期 OR membership)` |
| 決済サービス | `from:(stripe OR paypal OR apple OR google OR amazon)` |

ユーザーはプリセットをベースにカスタマイズ可能。Gmail の検索構文がそのまま使用できる。

---

## 7. エラーコード一覧

| HTTP Status | 発生箇所 | 意味 |
|-------------|---------|------|
| 400 | 全エンドポイント | 必須パラメータ不足 |
| 403 | `/jobs/poll` | 認証失敗 (Scheduler secret / IAM) |
| 500 | 全エンドポイント | サーバー内部エラー |
