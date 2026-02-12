import { messagingApi } from "@line/bot-sdk";
import { logger } from "../utils/logger";

function getClient(): messagingApi.MessagingApiClient {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  return new messagingApi.MessagingApiClient({ channelAccessToken });
}

export async function pushMessage(lineUserId: string, text: string): Promise<void> {
  const client = getClient();
  await client.pushMessage({
    to: lineUserId,
    messages: [{ type: "text", text }],
  });
  logger.info("LINE push sent", { lineUserId: lineUserId.slice(0, 8) + "..." });
}

export async function replyMessage(replyToken: string, text: string): Promise<void> {
  const client = getClient();
  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}
