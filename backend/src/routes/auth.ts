import { Router, Request, Response } from "express";
import { Timestamp } from "@google-cloud/firestore";
import { db } from "../utils/firestore";
import { logger } from "../utils/logger";
import { exchangeCodeForTokens } from "../services/gmail";
import { encrypt } from "../utils/crypto";
import type { GoogleAuthRequest } from "../types";

const router = Router();

// POST /auth/google
router.post("/google", async (req: Request, res: Response) => {
  try {
    const { uid, authCode, redirectUri, codeVerifier } = req.body as GoogleAuthRequest;
    if (!uid || !authCode || !redirectUri || !codeVerifier) {
      res.status(400).json({ error: "uid, authCode, redirectUri, codeVerifier are required" });
      return;
    }

    const { refreshToken } = await exchangeCodeForTokens(authCode, redirectUri, codeVerifier);
    const refreshTokenEnc = encrypt(refreshToken);
    const now = Timestamp.now();

    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          gmail: {
            refreshTokenEnc,
            lastCheckedAt: now,
          },
          plan: "free",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

    logger.info("Google auth completed", { uid });
    res.json({ ok: true });
  } catch (err) {
    logger.error("Google auth failed", { error: String(err) });
    res.status(500).json({ error: "Google auth failed" });
  }
});

export default router;
