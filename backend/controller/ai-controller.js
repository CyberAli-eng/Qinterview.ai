import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";
import Question from "../models/question-model.js";
import Session from "../models/session-model.js";
import {
  conceptExplainPrompt,
  questionAnswerPrompt,
} from "../utils/prompts-util.js";

// Initialize the Official Google Generative AI SDK
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);

/**
 * Robust AI Caller with Retry and Fallback Logic
 * Handles 503 (High Demand) and 429 (Rate Limit) errors
 */
const callAiWithRetry = async (prompt, modelName = "gemini-flash-latest", retries = 3) => {
  const fallbacks = ["gemini-pro-latest", "gemini-2.0-flash", "gemini-1.5-flash"];
  
  for (let i = 0; i < retries; i++) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      const isTransient = error.message.includes("503") || error.message.includes("429") || error.message.includes("high demand");
      
      if (isTransient && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s backoff
        console.warn(`AI Busy (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // If primary model fails permanently or after retries, try fallbacks
      if (fallbacks.length > 0) {
        const nextModel = fallbacks.shift();
        console.warn(`Switching to fallback model: ${nextModel}`);
        return callAiWithRetry(prompt, nextModel, 2); 
      }
      
      throw error;
    }
  }
};

// @desc    Generate + SAVE interview questions for a session
export const generateInterviewQuestions = async (req, res) => {
  const { sessionId } = req.body;
  console.log("Generating questions for session: ", sessionId);
  
  try {
    if (!sessionId) return res.status(400).json({ success: false, message: "sessionId is required" });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    const { role, experience, topicsToFocus } = session;
    const prompt = questionAnswerPrompt(role, experience, topicsToFocus, 10);

    // Call AI with robust retry/fallback logic
    const rawText = await callAiWithRetry(prompt);

    console.log("AI Generation successful.");

    const cleanedText = rawText
      .replace(/^```json\s*/, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();

    let questions;
    try {
      questions = JSON.parse(cleanedText);
    } catch {
      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) questions = JSON.parse(jsonMatch[0]);
      else throw new Error("Could not extract valid JSON from AI response");
    }

    const saved = await Question.insertMany(
      questions.map((q) => ({
        session: sessionId,
        question: q.question,
        answer: q.answer || "",
        note: "",
        isPinned: false,
      })),
    );

    session.questions.push(...saved.map((q) => q._id));
    await session.save();

    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error("AI Error:", error.message);
    res.status(500).json({
      success: false,
      message: "AI is currently busy. Please try again in top-right retry button.",
      error: error.message,
    });
  }
};

// @desc    Generate explanation for an interview question
export const generateConceptExplanation = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ success: false, message: "Question is required" });

    const prompt = conceptExplainPrompt(question);
    const rawText = await callAiWithRetry(prompt);

    const cleanedText = rawText
      .replace(/^```json\s*/, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();

    let explanation;
    try {
      explanation = JSON.parse(cleanedText);
    } catch {
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) explanation = JSON.parse(jsonMatch[0]);
      else throw new Error("Could not extract JSON from explanation");
    }

    res.status(200).json({ success: true, data: explanation });
  } catch (error) {
    console.error("AI Error:", error.message);
    res.status(500).json({ success: false, message: "AI Explanation Failed", error: error.message });
  }
};

export const getSessionById = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).populate("questions");
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });
    res.status(200).json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
