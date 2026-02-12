import crypto from "node:crypto";
import { Timestamp } from "@google-cloud/firestore";
import { db } from "../utils/firestore";
import type { LinkCodeDoc } from "../types";

const CODE_TTL_MIN = 10;

export async function generateLinkCode(uid: string): Promise<{ code: string; expiresAt: Date }> {
  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000);

  await db.collection("linkCodes").doc(code).set({
    uid,
    expiresAt: Timestamp.fromDate(expiresAt),
    used: false,
  } satisfies LinkCodeDoc);

  return { code, expiresAt };
}

export async function resolveLinkCode(code: string): Promise<string | null> {
  const ref = db.collection("linkCodes").doc(code);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data() as LinkCodeDoc;
  if (data.used) return null;
  if (data.expiresAt.toDate() < new Date()) return null;

  await ref.update({ used: true });
  return data.uid;
}
