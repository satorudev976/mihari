import { Router, Request, Response } from "express";
import { Timestamp } from "@google-cloud/firestore";
import { db } from "../utils/firestore";
import { logger } from "../utils/logger";
import type { FilterCreateRequest, FilterUpdateRequest } from "../types";

const router = Router();

// GET /filters?uid=xxx
router.get("/", async (req: Request, res: Response) => {
  try {
    const uid = req.query.uid as string;
    if (!uid) {
      res.status(400).json({ error: "uid is required" });
      return;
    }

    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("filters")
      .orderBy("createdAt", "desc")
      .get();

    const filters = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ filters });
  } catch (err) {
    logger.error("Failed to list filters", { error: String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /filters
router.post("/", async (req: Request, res: Response) => {
  try {
    const { uid, title, query, enabled } = req.body as FilterCreateRequest;
    if (!uid || !title || !query) {
      res.status(400).json({ error: "uid, title, query are required" });
      return;
    }

    const now = Timestamp.now();
    const docRef = await db
      .collection("users")
      .doc(uid)
      .collection("filters")
      .add({
        title,
        query,
        enabled: enabled ?? true,
        createdAt: now,
        updatedAt: now,
      });

    res.status(201).json({ id: docRef.id, ok: true });
  } catch (err) {
    logger.error("Failed to create filter", { error: String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /filters/:filterId?uid=xxx
router.patch("/:filterId", async (req: Request, res: Response) => {
  try {
    const uid = req.query.uid as string;
    const { filterId } = req.params;
    if (!uid) {
      res.status(400).json({ error: "uid query param is required" });
      return;
    }

    const updates: FilterUpdateRequest = req.body;
    await db
      .collection("users")
      .doc(uid)
      .collection("filters")
      .doc(filterId)
      .update({
        ...updates,
        updatedAt: Timestamp.now(),
      });

    res.json({ ok: true });
  } catch (err) {
    logger.error("Failed to update filter", { error: String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /filters/:filterId?uid=xxx
router.delete("/:filterId", async (req: Request, res: Response) => {
  try {
    const uid = req.query.uid as string;
    const { filterId } = req.params;
    if (!uid) {
      res.status(400).json({ error: "uid query param is required" });
      return;
    }

    await db
      .collection("users")
      .doc(uid)
      .collection("filters")
      .doc(filterId)
      .delete();

    res.json({ ok: true });
  } catch (err) {
    logger.error("Failed to delete filter", { error: String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
