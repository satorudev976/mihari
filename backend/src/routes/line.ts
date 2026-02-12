import { Router, Request, Response } from "express";
import { Timestamp } from "@google-cloud/firestore";
import { db } from "../utils/firestore";
import { logger } from "../utils/logger";
import { replyMessage } from "../services/line";
import { generateLinkCode, resolveLinkCode } from "../services/linkCode";
import type { LinkStartRequest } from "../types";

const router = Router();

// POST /line/link/start
router.post("/link/start", async (req: Request, res: Response) => {
  try {
    const { uid } = req.body as LinkStartRequest;
    if (!uid) {
      res.status(400).json({ error: "uid is required" });
      return;
    }

    const { code, expiresAt } = await generateLinkCode(uid);
    res.json({ code, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    logger.error("Failed to generate link code", { error: String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /line/webhook
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const events = req.body?.events;
    if (!Array.isArray(events)) {
      res.status(200).json({ ok: true });
      return;
    }

    for (const event of events) {
      // Follow event — welcome message
      if (event.type === "follow") {
        await replyMessage(
          event.replyToken,
          "友だち追加ありがとうございます！\nアプリに表示された6桁の連携コードをこちらに送信してください。"
        );
        continue;
      }

      // Message event — check for 6-digit link code
      if (event.type === "message" && event.message?.type === "text") {
        const text = (event.message.text as string).trim();
        const lineUserId = event.source?.userId as string;

        if (/^\d{6}$/.test(text)) {
          const uid = await resolveLinkCode(text);

          if (uid) {
            await db
              .collection("users")
              .doc(uid)
              .set(
                {
                  line: { userId: lineUserId, enabled: true },
                  updatedAt: Timestamp.now(),
                },
                { merge: true }
              );

            await replyMessage(
              event.replyToken,
              "連携が完了しました！サブスク通知をお届けします。"
            );
            logger.info("LINE linked", { uid, lineUserId: lineUserId.slice(0, 8) + "..." });
          } else {
            await replyMessage(
              event.replyToken,
              "コードが無効または期限切れです。アプリから再発行してください。"
            );
          }
        }
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error("Webhook processing failed", { error: String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
