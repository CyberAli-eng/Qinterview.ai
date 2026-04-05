import express from "express";
import { protect } from "../middlewares/auth-middleware.js";
import { checkDB } from "../middlewares/db-middleware.js";
import {
  createSession,
  getMySessions,
  getSessionById,
} from "../controller/session-controller.js";

const router = express.Router();

router.post("/create", protect, checkDB, createSession);
router.get("/my-sessions", protect, checkDB, getMySessions);
router.get("/:id", protect, checkDB, getSessionById);

export default router;
