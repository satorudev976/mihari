import { Timestamp } from "@google-cloud/firestore";

// ---- Firestore: users/{uid} ----
export interface UserDoc {
  gmail: {
    refreshTokenEnc: string;
    accessTokenCache?: string;
    accessTokenExpiresAt?: Timestamp;
    lastCheckedAt: Timestamp;
  };
  line: {
    userId: string;
    enabled: boolean;
  };
  plan: "free" | "pro";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---- Firestore: users/{uid}/filters/{filterId} ----
export interface FilterDoc {
  title: string;
  query: string;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---- Firestore: users/{uid}/sent/{messageId} ----
export interface SentDoc {
  sentAt: Timestamp;
  filterId: string;
  hash?: string;
}

// ---- Firestore: linkCodes/{code} ----
export interface LinkCodeDoc {
  uid: string;
  expiresAt: Timestamp;
  used: boolean;
}

// ---- API request/response ----
export interface GoogleAuthRequest {
  uid: string;
  authCode: string;
  redirectUri: string;
}

export interface LinkStartRequest {
  uid: string;
}

export interface LinkStartResponse {
  code: string;
  expiresAt: string;
}

export interface FilterCreateRequest {
  uid: string;
  title: string;
  query: string;
  enabled: boolean;
}

export interface FilterUpdateRequest {
  title?: string;
  query?: string;
  enabled?: boolean;
}

export interface PollResult {
  ok: boolean;
  processed: number;
}

// ---- Gmail parsed message ----
export interface GmailMessageSummary {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}
