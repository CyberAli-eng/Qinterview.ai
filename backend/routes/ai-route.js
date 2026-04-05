import express from "express";
import { protect } from "../middlewares/auth-middleware.js";
import { checkDB } from "../middlewares/db-middleware.js";
import {
  generateInterviewQuestions,
  generateConceptExplanation,
} from "../controller/ai-controller.js";

const router = express.Router();

// AI Routes (with DB check)
router.post("/generate-questions", protect, checkDB, generateInterviewQuestions);
router.post("/generate-explanation", protect, checkDB, generateConceptExplanation);

export default router;
