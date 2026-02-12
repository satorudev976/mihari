import { Router, Request, Response } from "express";
import { Timestamp } from "@google-cloud/firestore";
import { db } from "../utils/firestore";
import { logger } from "../utils/logger";
import { getAccessToken, searchMessages } from "../services/gmail";
import { pushMessage } from "../services/line";
import type { UserDoc, FilterDoc, GmailMessageSummary } from "../types";

const router = Router();

function formatPushText(msg: GmailMessageSummary, filterTitle: string): string {
  return [
    `【${filterTitle}】`,
    `件名: ${msg.subject}`,
    `差出人: ${msg.from}`,
    `日時: ${msg.date}`,
    msg.snippet ? `概要: ${msg.snippet}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function processUser(uid: string, user: UserDoc): Promise<number> {
  let sentCount = 0;

  // Get access token
  let accessToken: string;
  try {
    accessToken = await getAccessToken(user.gmail.refreshTokenEnc);
  } catch (err) {
    logger.error("Failed to get access token", { uid, error: String(err) });
    return 0;
  }

  // Get enabled filters
  const filtersSnap = await db
    .collection("users")
    .doc(uid)
    .collection("filters")
    .where("enabled", "==", true)
    .get();

  if (filtersSnap.empty) return 0;

  for (const filterDoc of filtersSnap.docs) {
    const filter = filterDoc.data() as FilterDoc;
    const fullQuery = `${filter.query} newer_than:2d`;

    let messages: GmailMessageSummary[];
    try {
      messages = await searchMessages(accessToken, fullQuery, 20);
    } catch (err) {
      logger.error("Gmail search failed", {
        uid,
        filterId: filterDoc.id,
        error: String(err),
      });
      continue;
    }

    for (const msg of messages) {
      // Dedup check
      const sentRef = db
        .collection("users")
        .doc(uid)
        .collection("sent")
        .doc(msg.messageId);

      const sentSnap = await sentRef.get();
      if (sentSnap.exists) continue;

      // Push to LINE
      try {
        const text = formatPushText(msg, filter.title);
        await pushMessage(user.line.userId, text);

        // Record sent
        await sentRef.set({
          sentAt: Timestamp.now(),
          filterId: filterDoc.id,
        });

        sentCount++;
      } catch (err) {
        logger.error("LINE push failed", {
          uid,
          messageId: msg.messageId,
          error: String(err),
        });
      }
    }
  }

  // Update lastCheckedAt
  await db
    .collection("users")
    .doc(uid)
    .update({ "gmail.lastCheckedAt": Timestamp.now(), updatedAt: Timestamp.now() });

  return sentCount;
}

// POST /jobs/poll — called by Cloud Scheduler
router.post("/poll", async (req: Request, res: Response) => {
  try {
    // Fetch all users with LINE linked and enabled
    const usersSnap = await db
      .collection("users")
      .where("line.enabled", "==", true)
      .get();

    let totalProcessed = 0;

    for (const doc of usersSnap.docs) {
      const user = doc.data() as UserDoc;
      if (!user.gmail?.refreshTokenEnc || !user.line?.userId) continue;

      try {
        const count = await processUser(doc.id, user);
        totalProcessed += count;
        logger.info("User processed", { uid: doc.id, sentCount: count });
      } catch (err) {
        logger.error("User processing failed", {
          uid: doc.id,
          error: String(err),
        });
      }
    }

    res.json({ ok: true, processed: totalProcessed });
  } catch (err) {
    logger.error("Poll job failed", { error: String(err) });
    res.status(500).json({ error: "Poll job failed" });
  }
});

export default router;
