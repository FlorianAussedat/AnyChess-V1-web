import { Router, type IRouter } from "express";
import {
  translatePgnComments,
  translationBackend,
} from "../lib/pgnCommentTranslate";

const router: IRouter = Router();

router.post("/pgn-comments/translate", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items_required" });
    return;
  }
  const results = await translatePgnComments(items);
  res.json({
    backend: translationBackend(),
    items: results,
  });
});

export default router;
