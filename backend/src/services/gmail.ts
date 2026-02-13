import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { decrypt } from "../utils/crypto";
import type { GmailMessageSummary } from "../types";

export function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not set");
  }
  return new google.auth.OAuth2(clientId);
}

export async function exchangeCodeForTokens(
  authCode: string,
  redirectUri: string
): Promise<{ refreshToken: string; accessToken: string; expiresAt: Date }> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken({ code: authCode, redirect_uri: redirectUri });

  if (!tokens.refresh_token) {
    throw new Error("No refresh_token returned. Ensure access_type=offline and prompt=consent.");
  }

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? "",
    expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
  };
}

export async function getAccessToken(refreshTokenEnc: string): Promise<string> {
  const refreshToken = decrypt(refreshTokenEnc);
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to refresh access token");
  return token;
}

export async function searchMessages(
  accessToken: string,
  query: string,
  maxResults = 10
): Promise<GmailMessageSummary[]> {
  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: client });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messageIds = listRes.data.messages ?? [];
  if (messageIds.length === 0) return [];

  const results: GmailMessageSummary[] = [];

  for (const { id, threadId } of messageIds) {
    if (!id) continue;

    const msg = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });

    const headers = msg.data.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    results.push({
      messageId: id,
      threadId: threadId ?? "",
      subject: getHeader("Subject"),
      from: getHeader("From"),
      date: getHeader("Date"),
      snippet: msg.data.snippet ?? "",
    });
  }

  return results;
}
