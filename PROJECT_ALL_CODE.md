# QInterview.ai Project Snapshot


## File: backend\diagnostic-key.js

`$lang

import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

async function test() {
  console.log("Testing API Key: ", "Starting...");
  try {
    const list = await ai.models.list();
    console.log("Models list retrieved successfully. Total count: ", list.length);
    
    // Try to generate a simple word to confirm active status
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", 
      contents: [{ role: "user", parts: [{ text: "say hello" }] }],
    });
    console.log("Response Success: ", JSON.stringify(response, null, 2));
  } catch (err) {
    console.error("API Key Test Failed!");
    console.error("Error Code: ", err.status || err.code);
    console.error("Error Message: ", err.message);
    if (err.response) {
       console.error("Raw Response: ", JSON.stringify(err.response, null, 2));
    }
  }
}

test();

` 


## File: backend\index.js

`$lang

import express from "express"; 
import cors from "cors"; 
import dotenv from "dotenv";
import { connectDB } from "./config/database-config.js";
import authRoutes from "./routes/auth-route.js";
import sessionRoutes from "./routes/session-route.js";
import aiRoutes from "./routes/ai-route.js";

// Load environment variables
dotenv.config();

// Initialize app
const app = express();

// Middleware
app.use(cors({
    origin: "http://localhost:5173",
}));
app.use(express.urlencoded({extended: true})); 
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes); 
app.use("/api/sessions", sessionRoutes);
app.use("/api/ai", aiRoutes);

// Root Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "QInterview.ai API is active",
  });
});

// Port
const PORT = process.env.PORT || 5000;

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect to DB (Non-blocking)
connectDB().catch(err => {
  console.error("Database connection failed:", err.message);
});

` 


## File: backend\list-models.js

`$lang

import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

async function list() {
  try {
    const models = await ai.models.list();
    console.log(JSON.stringify(models, null, 2));
  } catch (err) {
    console.error(err);
  }
}

list();

` 


## File: backend\show-models.js

`$lang

import dotenv from "dotenv";
dotenv.config();

async function show() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_GENAI_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const names = data.models.map(m => m.name.replace('models/', ''));
    console.log("--- STABLE MODEL LIST ---");
    console.log(names.join("\n"));
  } catch (err) {
    console.error(err);
  }
}

show();

` 


## File: backend\test-variants.js

`$lang

import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);

async function list() {
  try {
    // Note: The official SDK might not have a direct .models.list() 
    // We might need to use a fetch or check documentation for the latest method.
    // However, we can try to "peek" or just test a few variants.
    
    const variants = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-pro",
      "gemini-1.0-pro"
    ];

    console.log("--- Testing Model Variants ---");
    for (const v of variants) {
      try {
        const model = genAI.getGenerativeModel({ model: v });
        await model.generateContent("hi");
        console.log(`[SUCCESS] Model: ${v} is ACTIVE`);
      } catch (err) {
        console.log(`[FAILED ] Model: ${v} -> ${err.message.split('\n')[0]}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

list();

` 


## File: backend\config\database-config.js

`$lang

import mongoose from "mongoose";

export const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
};

` 


## File: backend\controller\ai-controller.js

`$lang

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

` 


## File: backend\controller\auth-controller.js

`$lang

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user-model.js";

// Generate JWT Token
const generateToken = (userId) => {
  let token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
  return token;
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Signup Error:", error.message);
    
    // Catch specific Mongoose/Atlas errors
    if (error.name === "MongooseServerSelectionError") {
      return res.status(503).json({ 
        message: "Database connection timed out. This is often due to an IP whitelist issue in MongoDB Atlas." 
      });
    }

    res.status(500).json({ message: "An unexpected server error occurred." });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Login Error:", error.message);

    if (error.name === "MongooseServerSelectionError") {
      return res.status(503).json({ 
        message: "Database connection unavailable. Verify your Atlas IP whitelist." 
      });
    }

    res.status(500).json({ message: "Login failed due to a server error." });
  }
};

` 


## File: backend\controller\session-controller.js

`$lang

import Question from "../models/question-model.js";
import Session from "../models/session-model.js";

// @desc    Create a new session and linked questions
// @route   POST /api/sessions/create
// @access  Private
export const createSession = async (req, res) => {
  try {
    const { role, experience, topicsToFocus, description, questions } =
      req.body;
    const userId = req.user._id; // Assuming you have a middleware setting req.user

    // Create the session
    const session = await Session.create({
      user: userId,
      role,
      experience,
      topicsToFocus,
      description,
    });

    // Create questions and collect their IDs
    const questionDocs = await Promise.all(
      questions.map(async (q) => {
        const question = await Question.create({
          session: session._id,
          question: q.question,
          answer: q.answer || "",
          note: q.note || "",
          isPinned: q.isPinned || false,
        });
        return question._id;
      }),
    );

    // Update session with question IDs
    session.questions = questionDocs;
    await session.save();

    // Return the populated session
    // const populatedSession = await Session.findById(session._id).populate(
    //   "questions",
    // );

    // res.status(201).json({
    //   success: true,
    //   data: populatedSession,
    // });
    res.status(201).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Get all sessions for the logged-in user
// @route   GET /api/sessions/my-sessions
// @access  Private
export const getMySessions = async (req, res) => {
  try {
    const userId = req.user._id;

    const sessions = await Session.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("questions");

    res.status(200).json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Get a session by ID with populated questions
// @route   GET /api/sessions/:id
// @access  Private
export const getSessionById = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate("questions")
      .populate("user", "name email");

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    // Check if the session belongs to the logged-in user
    if (session.user._id.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


` 


## File: backend\middlewares\auth-middleware.js

`$lang

import jwt from "jsonwebtoken";
import User from "../models/user-model.js";

// Middleware to protect routes
export const protect = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (token && token.startsWith("Bearer ")) {
      token = token.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      next();
    } else {
      res.status(401).json({ message: "Not authorized, no token" });
    }
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

` 


## File: backend\middlewares\db-middleware.js

`$lang

import mongoose from "mongoose";

// Middleware to check if database is connected
export const checkDB = (req, res, next) => {
  const state = mongoose.connection.readyState;

  // 1 = connected
  if (state === 1) {
    return next();
  }

  // 0 = disconnected, 2 = connecting, 3 = disconnecting
  const messages = {
    0: "Database disconnected. Please ensure your IP is whitelisted in MongoDB Atlas.",
    2: "Database connecting. Please wait a moment and try again.",
    3: "Database disconnecting. Please try again later.",
  };

  const message = messages[state] || "Database connection unavailable. Check your Atlas IP whitelist.";

  res.status(503).json({
    success: false,
    message,
    diagnostic: "ERR_DB_NOT_CONNECTED",
    atlas_help: "https://www.mongodb.com/docs/atlas/security-whitelist/"
  });
};

` 


## File: backend\models\question-model.js

`$lang

import mongoose from "mongoose";

const questionsSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    question: String,
    answer: String,
  },
  { timestamps: true },
);

const Question = mongoose.model("Question", questionsSchema);

export default Question;

// let question = {
//   session: "Session_ID",
//   questions: "What is node",
//   ans: "thi is ans",
// };

` 


## File: backend\models\session-model.js

`$lang

// session role -> mern full stack, java full stack ,frontend
// exp => 2, 1, 10
// userId => this will store ref

import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, required: true },
    experience: { type: String, required: true },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
  },
  { timestamps: true },
);

const Session = mongoose.model("Session", sessionSchema);

export default Session;

` 


## File: backend\models\user-model.js

`$lang

import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true },
);

const User = mongoose.model("User", UserSchema);

export default User;

` 


## File: backend\routes\ai-route.js

`$lang

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

` 


## File: backend\routes\auth-route.js

`$lang

import express from "express";
import { checkDB } from "../middlewares/db-middleware.js";
import {
  loginUser,
  registerUser,
} from "../controller/auth-controller.js";

const router = express.Router();

// Auth Routes (with DB check)
router.post("/signup", checkDB, registerUser); // Register User
router.post("/login", checkDB, loginUser); // Login User

export default router;

` 


## File: backend\routes\session-route.js

`$lang

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

` 


## File: backend\utils\prompts-util.js

`$lang

export const questionAnswerPrompt = (
  role,
  experience,
  topicsToFocus,
  numberOfQuestions,
) => {
  return `You are a senior engineer conducting a technical interview.

Generate exactly ${numberOfQuestions} interview questions for the following profile:
- Role: ${role}
- Experience: ${experience} years
- Topics to focus on: ${topicsToFocus || "general topics for this role"}

Rules for each question:
1. The "answer" field must be well-structured using markdown:
   - Use **bold** for key terms
   - Use bullet points or numbered lists where appropriate
   - Add a short \`\`\`js ... \`\`\` code block when relevant (keep it under 10 lines)
   - Break the answer into short paragraphs â€” never one wall of text
2. Answers should be beginner-friendly but technically accurate.
3. Difficulty should match ${experience} years of experience.

Return ONLY a valid JSON array. No extra text, no markdown wrapper around the JSON.

[
  {
    "question": "...",
    "answer": "**Definition:** ...\\n\\n**Key points:**\\n- Point 1\\n- Point 2\\n\\n\`\`\`js\\n// example\\n\`\`\`"
  }
]`;
};

export const conceptExplainPrompt = (question) => {
  return `You are a senior developer explaining a concept to a junior developer.

Explain the following interview question in depth:
"${question}"

Structure your explanation like this:
1. Start with a **one-line definition** in bold.
2. Explain the concept in 2â€“3 short paragraphs.
3. Use bullet points for any list of features, pros/cons, or steps.
4. If relevant, include a small code example (under 10 lines) in a \`\`\`js block.
5. End with a **"Key Takeaway"** line summarizing the concept in one sentence.

Return ONLY a valid JSON object in this exact shape. No extra text outside the JSON:

{
  "title": "Short, clear concept title (5 words max)",
  "explanation": "**Definition:** ...\\n\\n Paragraph...\\n\\n**Key Takeaway:** ..."
}`;
};

` 


## File: frontend\eslint.config.js

`$lang

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])

` 


## File: frontend\index.html

`$lang

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

` 


## File: frontend\vite.config.js

`$lang

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
});

` 


## File: frontend\src\App.jsx

`$lang

import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import InterviewPrep from './pages/InterviewPrep'

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/interview/:id" element={<InterviewPrep />} />
    </Routes>
  )
}

export default App

` 


## File: frontend\src\index.css

`$lang

@import "tailwindcss";

@theme {
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-secondary: #0f172a;
  --color-accent: #f59e0b;
  --color-glass: rgba(255, 255, 255, 0.7);
  --color-glass-dark: rgba(15, 23, 42, 0.8);
}

:root {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background-color: #f8fafc;
  background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
  background-size: 30px 30px;
  color: #1e293b;
}

body {
  margin: 0;
  min-height: 100vh;
}

/* Glassmorphism utility */
.glass {
  background: var(--color-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.glass-dark {
  background: var(--color-glass-dark);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}

` 


## File: frontend\src\main.jsx

`$lang

import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom"
createRoot(document.getElementById("root")).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>
);

` 


## File: frontend\src\components\EmptyState.jsx

`$lang

import { FiPlus, FiCpu, FiMessageSquare } from "react-icons/fi";
import { motion } from "framer-motion";

const EmptyState = ({ onGenerate, generating }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center shadow-inner"
    >
      <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
        <FiCpu className="w-12 h-12 text-indigo-500" />
        <div className="absolute top-0 right-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-4 border-white">
          AI
        </div>
      </div>
      
      <h3 className="text-2xl font-bold text-slate-800 mb-3">No Questions Generated Yet</h3>
      <p className="text-slate-500 text-lg max-w-sm mx-auto mb-10 leading-relaxed font-medium">
        Ready to sharpen your skills? Let our advanced AI curate a list of personalized interview questions for you.
      </p>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-3 px-10 py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xl shadow-2xl shadow-indigo-200 transition-all active:scale-95"
        >
          {generating ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><FiPlus /> Generate Questions</>}
        </button>
        
        <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
          <FiMessageSquare className="w-4 h-4" />
          <span>Usually takes about 10-15 seconds</span>
        </div>
      </div>
    </motion.div>
  );
};

export default EmptyState;

` 


## File: frontend\src\components\ErrorBanner.jsx

`$lang

import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import { motion } from "framer-motion";

const ErrorBanner = ({ message, onRetry }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border border-red-100 rounded-3xl p-8 flex flex-col items-center text-center shadow-lg shadow-red-100/20"
    >
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <FiAlertCircle className="w-8 h-8 text-red-600" />
      </div>

      <h3 className="text-xl font-bold text-red-900 mb-2">Something went wrong</h3>
      <p className="text-red-700 font-medium max-w-sm mb-8 leading-relaxed">
        {message || "We encountered an error while fetching your questions. Please try again."}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-red-200 transition-all active:scale-95"
        >
          <FiRefreshCw className="w-5 h-5" /> Retry Request
        </button>
      )}
    </motion.div>
  );
};

export default ErrorBanner;

` 


## File: frontend\src\components\GenerateButton.jsx

`$lang

import { FiZap, FiLoader } from "react-icons/fi";
import { motion } from "framer-motion";

const GenerateButton = ({ onClick, generating, loading }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    disabled={generating || loading}
    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold transition-all shadow-xl shadow-indigo-100 hover:shadow-indigo-200"
  >
    {generating ? (
      <>
        <FiLoader className="animate-spin w-5 h-5" /> Generating Insights...
      </>
    ) : (
      <>
        <FiZap className="w-5 h-5 fill-current" /> Generate New Questions
      </>
    )}
  </motion.button>
);

export default GenerateButton;

` 


## File: frontend\src\components\Navbar.jsx

`$lang

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiMenu, 
  FiX, 
  FiArrowRight, 
  FiLogOut, 
  FiUser, 
  FiChevronRight,
  FiHome,
  FiZap
} from "react-icons/fi";

const Navbar = ({ variant = "marketing", onMenuToggle, leftAction, rightAction, userName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Scroll detection for glassmorphism intensify
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const navLinks = {
    marketing: [
      { name: "Features", href: "#features" },
      { name: "How it Works", href: "#how-it-works" },
      { name: "Pricing", href: "#pricing" },
    ],
    app: [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Analytics", href: "/analytics" },
    ],
    auth: [
      { name: "Back to Home", href: "/", icon: <FiHome className="w-4 h-4" /> },
    ]
  };

  const currentLinks = navLinks[variant] || [];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "py-3 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg" 
          : "py-5 bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Left Side: Logo or custom leftAction */}
        <div className="flex items-center gap-4">
          {leftAction ? (
            leftAction
          ) : (
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform">
                Q
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent hidden sm:inline">
              Interview.ai              
              </span>
            </Link>
          )}
        </div>

        {/* Desktop Links - Marketing */}
        {variant === "marketing" && (
          <div className="hidden md:flex items-center gap-8">
            {currentLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-slate-600 font-semibold hover:text-indigo-600 transition-colors"
              >
                {link.name}
              </a>
            ))}
            <div className="h-6 w-px bg-slate-200 mx-2" />
            <Link 
              to="/login"
              className="text-slate-900 font-bold hover:text-indigo-600 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2 group"
            >
              Get Started <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}

        {/* Desktop Links - Auth */}
        {variant === "auth" && (
          <div className="hidden md:flex items-center gap-6">
            {location.pathname === "/login" ? (
              <div className="flex items-center gap-4">
                <span className="text-slate-500 font-medium">New to QInterview.ai?</span>
                <Link 
                  to="/signup"
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Create Account
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-slate-500 font-medium">Already have an account?</span>
                <Link 
                  to="/login"
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Log In
                </Link>
              </div>
            )}
            <Link 
              to="/"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-all"
            >
              <FiHome /> Home
            </Link>
          </div>
        )}

        {/* Desktop Links - App */}
        {variant === "app" && (
          <div className="hidden md:flex items-center gap-6">
            {rightAction ? (
              rightAction
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-black">
                    P
                  </div>
                  <div>
                    <p className="text-xs font-black text-indigo-700 uppercase leading-none">Pro Plan</p>
                    <p className="text-[10px] text-indigo-500 font-bold">Session Active</p>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 line-clamp-1 max-w-[120px]">{userName || "User"}</p>
                    <button 
                      onClick={handleLogout}
                      className="text-[10px] font-black text-red-500 uppercase tracking-wider hover:underline"
                    >
                      Sign Out
                    </button>
                  </div>
                  <div className="w-10 h-10 bg-indigo-100 border-2 border-white rounded-full flex items-center justify-center text-indigo-600 shadow-inner overflow-hidden font-bold">
                    {userName ? userName[0].toUpperCase() : <FiUser className="w-6 h-6 text-slate-400" />}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Mobile Toggle */}
        <div className="flex items-center gap-4 md:hidden">
          {variant === "app" && (
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
              <FiZap className="w-4 h-4" />
            </div>
          )}
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              if (onMenuToggle) onMenuToggle(!isOpen);
            }}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            {isOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-b border-white/20 overflow-hidden"
          >
            <div className="px-6 py-8 space-y-6">
              {currentLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="flex items-center justify-between text-xl font-bold text-slate-900"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                  <FiChevronRight className="text-slate-400" />
                </a>
              ))}

              {variant === "marketing" && (
                <div className="pt-6 space-y-4">
                  <Link
                    to="/login"
                    className="block w-full py-4 text-center text-xl font-bold text-slate-900 bg-slate-100 rounded-2xl"
                    onClick={() => setIsOpen(false)}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="block w-full py-4 text-center text-xl font-bold text-white bg-slate-900 rounded-2xl shadow-xl shadow-slate-200"
                    onClick={() => setIsOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              )}

              {variant === "app" && (
                <div className="pt-6 space-y-4 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
                      {userName ? userName[0].toUpperCase() : <FiUser className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{userName || "User"}</p>
                      <p className="text-sm text-slate-500 uppercase font-black text-[10px] tracking-widest text-indigo-500">Premium Member</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full py-4 text-center text-xl font-bold text-red-600 bg-red-50 rounded-2xl"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;

` 


## File: frontend\src\components\QAItems.jsx

`$lang

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiStar, FiBookmark, FiInfo, FiZap } from "react-icons/fi";

const QAItem = ({ item, onPin }) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative group transition-all duration-500 rounded-[2rem] ${
        open 
          ? "bg-white shadow-[0_20px_50px_rgba(79,70,229,0.1)] border-indigo-100" 
          : "bg-white/60 backdrop-blur-md border-white/40 hover:bg-white shadow-sm hover:shadow-xl hover:shadow-indigo-50"
      } border overflow-hidden mb-6`}
    >
      {/* Active Indicator Line */}
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: "100%" }}
            exit={{ height: 0 }}
            className="absolute left-0 top-0 w-1.5 bg-gradient-to-b from-indigo-600 to-purple-600 z-10"
          />
        )}
      </AnimatePresence>

      <div 
        className="p-7 cursor-pointer flex items-start gap-5 relative z-10"
        onClick={() => setOpen(!open)}
      >
        <div className={`mt-0.5 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-500 ${
          open ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 rotate-6" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"
        }`}>
          Q
        </div>
        
        <div className="flex-1">
          <h3 className={`font-bold text-xl leading-snug transition-colors duration-300 ${
            open ? "text-slate-900" : "text-slate-700 group-hover:text-indigo-600"
          }`}>
            {item.question}
          </h3>
          {!open && (
            <div className="flex items-center gap-4 mt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <FiZap className="text-amber-400" /> AI Generated
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Click to reveal answer
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onPin?.(item._id); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              item.isPinned 
                ? "bg-amber-100 text-amber-600 shadow-inner" 
                : "text-slate-300 hover:bg-slate-50 hover:text-amber-500"
            }`}
          >
            <FiStar className={`w-5 h-5 ${item.isPinned ? "fill-amber-500" : ""}`} />
          </button>
          
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
            open ? "bg-slate-900 text-white rotate-180" : "bg-slate-50 text-slate-400 group-hover:bg-slate-200"
          }`}>
            <FiChevronDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
            className="border-t border-slate-50 overflow-hidden"
          >
            <div className="p-8 pt-4 bg-slate-50/30">
              <div className="max-w-none prose prose-indigo">
                <div className="flex items-center gap-2 mb-6">
                   <div className="h-[1px] flex-1 bg-slate-200"></div>
                   <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2 shadow-sm">
                     <FiBookmark /> expert analysis
                   </div>
                   <div className="h-[1px] flex-1 bg-slate-200"></div>
                </div>

                <div className="text-slate-700 leading-relaxed text-lg font-medium markdown-wrapper">
                  <ReactMarkdown>
                    {item.answer}
                  </ReactMarkdown>
                </div>
                
                {item.note && (
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 flex gap-4 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 shadow-sm"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      <FiInfo className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">pro-tip insight</p>
                      <p className="text-amber-900 text-sm font-semibold leading-relaxed">{item.note}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default QAItem;

` 


## File: frontend\src\components\SkeletonCard.jsx

`$lang

import { motion } from "framer-motion";

/**
 * SkeletonCard component with multiple variants
 * @param {string} variant - "qa", "session", "stat", "full"
 * @param {boolean} animated - Enable entrance animation
 */
const SkeletonCard = ({ variant = "qa", animated = true }) => {
  const baseClasses =
    "bg-white/60 backdrop-blur-sm border border-white/30 rounded-3xl overflow-hidden relative";

  const shimmerEffect = (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: "200%" }}
      transition={{
        duration: 1.8,
        repeat: Infinity,
        ease: "cubic-bezier(0.4, 0, 0.2, 1)",
        repeatDelay: 0.5,
      }}
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none will-change-transform"
    />
  );

  const entranceAnimation = animated
    ? {
      initial: { opacity: 0, scale: 0.96 },
      animate: { opacity: 1, scale: 1 },
      transition: { type: "spring", damping: 20, stiffness: 300 },
    }
    : {};

  // QA Card Skeleton (used in InterviewPrep)
  if (variant === "qa") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-6 md:p-8 shadow-sm`}
        role="status"
        aria-label="Loading question card"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-5 w-32 bg-slate-200 rounded-full animate-pulse" />
          </div>
          <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
        </div>

        <div className="space-y-3 mb-6">
          <div className="h-5 w-3/4 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded-full animate-pulse" />
          <div className="h-4 w-5/6 bg-slate-100 rounded-full animate-pulse" />
          <div className="h-4 w-2/3 bg-slate-100 rounded-full animate-pulse" />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          <div className="h-9 w-20 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-9 w-9 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-9 w-9 bg-slate-200 rounded-xl animate-pulse ml-auto" />
        </div>
        {shimmerEffect}
      </motion.div>
    );
  }

  // Session Card Skeleton (used in Dashboard)
  if (variant === "session") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-6 cursor-pointer shadow-sm`}
        role="status"
        aria-label="Loading session card"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse" />
          <div className="w-16 h-6 bg-slate-200 rounded-full animate-pulse" />
        </div>
        <div className="h-6 w-3/4 bg-slate-200 rounded-full animate-pulse mb-2" />
        <div className="h-4 w-1/2 bg-slate-200 rounded-full animate-pulse mb-4" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-slate-200 rounded-full animate-pulse" />
            <div className="h-3 w-12 bg-slate-200 rounded-full animate-pulse" />
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-gradient-to-r from-indigo-200 to-purple-200 rounded-full animate-pulse" />
          </div>
        </div>
        {shimmerEffect}
      </motion.div>
    );
  }

  // Stat Card Skeleton (used in Dashboard stats)
  if (variant === "stat") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-6 shadow-sm`}
        role="status"
        aria-label="Loading statistic card"
      >
        <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse mb-4" />
        <div className="h-8 w-20 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-24 bg-slate-200 rounded-full animate-pulse" />
        {shimmerEffect}
      </motion.div>
    );
  }

  // Full Page / Hero Skeleton (for loading entire sections)
  if (variant === "full") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-8 shadow-sm min-h-[400px] flex flex-col items-center justify-center`}
        role="status"
        aria-label="Loading content"
      >
        <div className="w-20 h-20 bg-slate-200 rounded-full animate-pulse mb-6" />
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-64 bg-slate-200 rounded-full animate-pulse mb-2" />
        <div className="h-4 w-56 bg-slate-200 rounded-full animate-pulse" />
        <div className="mt-8 flex gap-3">
          <div className="h-12 w-32 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-12 w-32 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        {shimmerEffect}
      </motion.div>
    );
  }

  // Default fallback (same as QA)
  return (
    <motion.div
      {...entranceAnimation}
      className={`${baseClasses} p-6`}
      role="status"
      aria-label="Loading"
    >
      <div className="h-6 w-3/4 bg-slate-200 rounded-full animate-pulse mb-4" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-100 rounded-full animate-pulse" />
        <div className="h-4 w-5/6 bg-slate-100 rounded-full animate-pulse" />
      </div>
      {shimmerEffect}
    </motion.div>
  );
};

export default SkeletonCard;

` 


## File: frontend\src\pages\Dashboard.jsx

`$lang

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";
import {
  FiPlus,
  FiArrowRight,
  FiLogOut,
  FiLayout,
  FiBookOpen,
  FiBarChart2,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiMenu,
  FiX,
  FiStar,
  FiTrendingUp,
} from "react-icons/fi";
import SkeletonCard from "../components/SkeletonCard";
import Navbar from "../components/Navbar";

const orbVariants = {
  animate: (i) => ({
    x: [0, 40, -30, 0],
    y: [0, -50, 30, 0],
    scale: [1, 1.3, 0.8, 1],
    transition: {
      duration: 18,
      repeat: Infinity,
      repeatType: "mirror",
      delay: i * 2.5,
    },
  }),
};

// Stagger variants for session cards
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 15 } },
};

const Dashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
    setUserName(localStorage.getItem("userName") || "");
  }, []);

  const fetchSessions = async () => {
    setFetching(true);
    try {
      const res = await axios.get(API_PATHS.SESSION.GET_ALL);
      setSessions(res.data.sessions);
    } catch (error) {
      console.log(error.response);
      if (error.response?.status === 401) navigate("/login");
      else showToast("Failed to load sessions", "error");
    } finally {
      setFetching(false);
    }
  };

  const createSession = async () => {
    if (!role.trim()) {
      showToast("Please enter a target role", "error");
      return;
    }
    if (!experience.trim()) {
      showToast("Please enter experience level", "error");
      return;
    }
    setLoading(true);
    try {
      await axios.post(API_PATHS.SESSION.CREATE, {
        role: role.trim(),
        experience: experience.trim(),
        questions: [],
      });
      setRole("");
      setExperience("");
      await fetchSessions();
      showToast("Session created successfully!", "success");
    } catch (error) {
      console.log(error.response);
      showToast(error.response?.data?.message || "Failed to create session", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // Calculate dashboard stats
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.questions?.length > 0).length;
  const completionRate = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0;
  // Mock average score - in real app you'd have scores in session data
  const avgScore = sessions.reduce((acc, s) => acc + (s.avgScore || 0), 0) / totalSessions || 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
      <Navbar 
        variant="app" 
        onMenuToggle={setMobileMenuOpen} 
        userName={userName}
      />
      {/* Background Orbs & Grid */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-20 -left-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-20 -right-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
      </div>
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border ${toast.type === "success"
                ? "bg-green-50/90 border-green-200 text-green-800"
                : "bg-red-50/90 border-red-200 text-red-800"
              }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex relative z-10">
        {/* Sidebar - Desktop & Mobile */}
        <motion.aside
          initial={{ x: -300 }}
          animate={{ x: mobileMenuOpen ? 0 : -300 }}
          transition={{ type: "spring", damping: 20 }}
          className={`fixed top-0 left-0 h-full w-72 bg-white/80 backdrop-blur-xl border-r border-white/30 shadow-2xl z-50 flex flex-col p-6 transition-all md:relative md:translate-x-0 md:w-64`}
        >
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                Q
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              QInterview.ai              
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-500 hover:text-slate-800"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            <motion.button
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-xl font-semibold transition-all"
            >
              <FiLayout className="w-5 h-5" /> Dashboard
            </motion.button>
            <motion.button
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-semibold transition-all"
            >
              <FiBookOpen className="w-5 h-5" /> My Prep
            </motion.button>
            <motion.button
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-semibold transition-all"
            >
              <FiBarChart2 className="w-5 h-5" /> Analytics
            </motion.button>
          </nav>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-all mt-auto"
          >
            <FiLogOut className="w-5 h-5" /> Logout
          </motion.button>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen p-4 md:p-8 pt-24 md:pt-24">

          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Pro</span>
            </h1>
            <p className="text-slate-500 mt-1">Track your interview preparation progress</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10"
          >
            {fetching ? (
              <>
                <SkeletonCard variant="stat" />
                <SkeletonCard variant="stat" />
                <SkeletonCard variant="stat" />
              </>
            ) : (
              <>
                <StatCard
                  icon={<FiBookOpen className="w-6 h-6" />}
                  title="Total Sessions"
                  value={totalSessions}
                  color="indigo"
                  delay={0}
                />
                <StatCard
                  icon={<FiCheckCircle className="w-6 h-6" />}
                  title="Completion Rate"
                  value={`${completionRate}%`}
                  color="purple"
                  delay={0.1}
                />
                <StatCard
                  icon={<FiStar className="w-6 h-6" />}
                  title="Avg. Score"
                  value={`${Math.round(avgScore)}%`}
                  color="pink"
                  delay={0.2}
                />
              </>
            )}
          </motion.div>

          {/* Create Session Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/60 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/30 shadow-xl mb-10"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full"></span>
              Start New Preparation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                  Target Role
                </label>
                <input
                  placeholder="e.g. Senior Frontend Developer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                  Experience
                </label>
                <input
                  placeholder="e.g. 5+ years"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all font-medium"
                />
              </div>
              <div className="flex items-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={createSession}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white h-[58px] rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <FiPlus /> Create Session
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Sessions List */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-6 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></span>
              Your Recent Sessions
            </h2>
            {sessions.length > 0 && (
              <motion.button
                whileHover={{ x: 3 }}
                className="text-indigo-600 font-semibold text-sm flex items-center gap-1"
              >
                View All <FiChevronRight />
              </motion.button>
            )}
          </div>

          {fetching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} variant="session" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/60 backdrop-blur-sm rounded-3xl p-12 text-center border border-dashed border-slate-300"
            >
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiBookOpen className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-xl font-bold text-slate-800">No sessions yet</p>
              <p className="text-slate-500 mt-2">Create your first session above to begin your training</p>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {sessions.map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                  onClick={() => navigate(`/interview/${session._id}`)}
                />
              ))}
            </motion.div>
          )}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLogoutModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiLogOut className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Logout?</h3>
              <p className="text-slate-500 text-center mb-6">
                Are you sure you want to logout? You'll need to login again to access your sessions.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, title, value, color, delay }) => {
  const colorClasses = {
    indigo: "from-indigo-500 to-indigo-600",
    purple: "from-purple-500 to-purple-600",
    pink: "from-pink-500 to-pink-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all"
    >
      <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-xl flex items-center justify-center text-white mb-4`}>
        {icon}
      </div>
      <p className="text-3xl font-black text-slate-900">{value}</p>
      <p className="text-slate-500 text-sm mt-1">{title}</p>
    </motion.div>
  );
};

// Session Card Component
const SessionCard = ({ session, onClick }) => {
  const questionCount = session.questions?.length || 0;
  const totalQuestions = 10; // Mock total, replace with actual from session config
  const progress = (questionCount / totalQuestions) * 100;

  // Determine experience level tag
  const getLevelTag = (exp) => {
    const years = parseInt(exp);
    if (isNaN(years)) return "Mid-Level";
    if (years < 2) return "Junior";
    if (years <= 5) return "Mid-Level";
    if (years <= 8) return "Senior";
    return "Lead";
  };
  const level = getLevelTag(session.experience);
  const levelColors = {
    Junior: "bg-green-100 text-green-700",
    "Mid-Level": "bg-blue-100 text-blue-700",
    Senior: "bg-purple-100 text-purple-700",
    Lead: "bg-orange-100 text-orange-700",
  };

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      onClick={onClick}
      className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg cursor-pointer group relative overflow-hidden transition-all hover:shadow-2xl"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-bl-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:from-indigo-600 group-hover:to-purple-600 group-hover:text-white transition-all">
            <FiBookOpen className="w-6 h-6" />
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${levelColors[level]}`}>
            {level}
          </span>
        </div>

        <h3 className="font-bold text-xl text-slate-900 mb-1 line-clamp-1">{session.role}</h3>
        <p className="text-slate-500 text-sm mb-4">{session.experience} experience</p>

        {/* Progress Section */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>{questionCount}/{totalQuestions} questions</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm group-hover:gap-3 transition-all">
          Continue Practice <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;

` 


## File: frontend\src\pages\InterviewPrep.jsx

`$lang

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCpu,
  FiMessageCircle,
  FiClock,
  FiLayers,
  FiCheckCircle,
  FiCopy,
  FiThumbsUp,
  FiShare2,
  FiChevronDown,
  FiChevronUp,
  FiZap,
  FiStar,
} from "react-icons/fi";

import QAItem from "../components/QAItems";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import GenerateButton from "../components/GenerateButton";
import SkeletonCard from "../components/SkeletonCard";
import Navbar from "../components/Navbar";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";

const parseError = (err) => {
  console.log(err);
  if (err.response)
    return (
      err.response.data?.message ||
      err.response.data?.error ||
      `Server error: ${err.response.status}`
    );
  if (err.request) return "Cannot reach server. Check your connection.";
  return err.message || "Something went wrong.";
};

const InterviewPrep = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [expandedQA, setExpandedQA] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [helpfulIds, setHelpfulIds] = useState(new Set());
  const [userName, setUserName] = useState("");
  const headerRef = useRef(null);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.95]);
  const headerBlur = useTransform(scrollY, [0, 100], [0, 8]);
  const headerBlurStr = useTransform(headerBlur, (val) => `blur(${val}px)`);

  // Floating orbs animation (consistent with other pages)
  const orbVariants = {
    animate: (i) => ({
      x: [0, 40, -30, 0],
      y: [0, -50, 30, 0],
      scale: [1, 1.3, 0.8, 1],
      transition: {
        duration: 18,
        repeat: Infinity,
        repeatType: "mirror",
        delay: i * 2.5,
      },
    }),
  };

  const fetchSessionData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await axios.get(`${API_PATHS.SESSION.GET_ONE}/${id}`);
      setSession(res.data.session);
      const qs = res.data.session.questions || [];
      setQuestions(qs);
      // Auto-expand first question if any
      if (qs.length > 0 && expandedQA === null) setExpandedQA(qs[0]._id);
    } catch (err) {
      console.log(err.response);
      setFetchError(parseError(err));
      if (err.response?.status === 401) navigate("/login");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, expandedQA]);

  const generateQuestions = async () => {
    setGenerating(true);
    const loadingToast = toast.loading(
      <div className="flex items-center gap-2">
        <FiZap className="animate-pulse" />
        <span>AI is crafting expert questions...</span>
      </div>,
      {
        className: "!bg-slate-900 !text-white !font-bold !rounded-2xl",
        duration: Infinity,
      }
    );
    try {
      await axios.post(API_PATHS.AI.GENERATE_QUESTIONS, { sessionId: id });
      await fetchSessionData();
      toast.success(
        <div className="flex items-center gap-2">
          <FiCheckCircle className="text-green-400" />
          <span>{questions.length} expert questions generated!</span>
        </div>,
        { id: loadingToast }
      );
    } catch (err) {
      toast.error(parseError(err), { id: loadingToast });
    } finally {
      setGenerating(false);
    }
  };

  const copyAnswer = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Answer copied to clipboard!", {
      icon: "ðŸ“‹",
      duration: 1500,
      className: "!rounded-xl",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const markHelpful = (id) => {
    setHelpfulIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
    toast.success(
      helpfulIds.has(id) ? "Removed helpful mark" : "Thanks for your feedback!",
      { icon: helpfulIds.has(id) ? "ðŸ‘" : "â¤ï¸", duration: 1000 }
    );
  };

  useEffect(() => {
    fetchSessionData();
    setUserName(localStorage.getItem("userName") || "");
  }, [fetchSessionData]);

  // Staggered QA card variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.2 },
    },
  };

  const cardVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 15 } },
    exit: { y: -20, opacity: 0, transition: { duration: 0.2 } },
  };

  const leftNavbarAction = (
    <motion.button
      whileHover={{ x: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate("/dashboard")}
      className="flex items-center gap-2 text-slate-600 font-semibold hover:text-indigo-600 transition-colors group"
    >
      <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" />
      <span className="hidden sm:inline">Back to Dashboard</span>
    </motion.button>
  );

  const rightNavbarAction = (
    <div className="flex items-center gap-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-wider shadow-sm"
      >
        <FiCpu className="w-3.5 h-3.5 animate-pulse" /> AI Enhanced
      </motion.div>
      <GenerateButton
        onClick={generateQuestions}
        generating={generating}
        loading={loading}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
      <Navbar 
        variant="app" 
        leftAction={leftNavbarAction} 
        rightAction={rightNavbarAction} 
        userName={userName}
      />
      {/* Background Orbs & Grid */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-20 -left-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-20 -right-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
      </div>
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      <Toaster
        position="top-right"
        toastOptions={{
          className: "!rounded-2xl !px-6 !py-4 !shadow-xl !font-bold !backdrop-blur-md",
          duration: 4000,
          style: { background: "rgba(15, 23, 42, 0.9)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
        }}
      />


      <div className="max-w-5xl mx-auto px-6 py-10 md:py-14 pt-24 md:pt-32">
        {/* Session Header with Animated Stats */}
        <div className="mb-12">
          {session ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, type: "spring" }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-3xl blur-2xl -z-10" />
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/30 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                      <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.2em]">
                        Active Session
                      </p>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                      {session.role}
                    </h1>
                    <div className="flex flex-wrap items-center gap-6">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-2 text-slate-600 font-semibold text-sm bg-slate-100 px-3 py-1.5 rounded-full"
                      >
                        <FiLayers className="w-4 h-4 text-indigo-500" />
                        {session.experience} years exp.
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-2 text-slate-600 font-semibold text-sm bg-slate-100 px-3 py-1.5 rounded-full"
                      >
                        <FiClock className="w-4 h-4 text-indigo-500" />
                        {new Date(session.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-2 text-slate-600 font-semibold text-sm bg-slate-100 px-3 py-1.5 rounded-full"
                      >
                        <FiMessageCircle className="w-4 h-4 text-indigo-500" />
                        {questions.length} question{questions.length !== 1 ? "s" : ""}
                      </motion.div>
                    </div>
                  </div>
                  {questions.length > 0 && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full"
                    >
                      <FiCheckCircle className="w-4 h-4" />
                      Ready for practice
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <SkeletonCard variant="full" />
          )}
        </div>

        {/* Q&A List with Enhanced Animations */}
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={i} variant="qa" />
              ))}
            </div>
          ) : fetchError ? (
            <ErrorBanner message={fetchError} onRetry={fetchSessionData} />
          ) : questions.length === 0 ? (
            <EmptyState onGenerate={generateQuestions} generating={generating} />
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 gap-6 pb-24"
            >
              <AnimatePresence mode="popLayout">
                {questions.map((q, idx) => (
                  <motion.div
                    key={q._id}
                    variants={cardVariants}
                    exit="exit"
                    layout
                    className="group"
                  >
                    <QAItem
                      item={q}
                      isExpanded={expandedQA === q._id}
                      onToggle={() =>
                        setExpandedQA(expandedQA === q._id ? null : q._id)
                      }
                      onCopy={() => copyAnswer(q.answer || "No answer provided.", q._id)}
                      onHelpful={() => markHelpful(q._id)}
                      isHelpful={helpfulIds.has(q._id)}
                      isCopied={copiedId === q._id}
                      index={idx + 1}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Floating Action Button (Mobile) */}
      {!loading && questions.length > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={generateQuestions}
          disabled={generating}
          className="fixed bottom-6 right-6 md:hidden z-40 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center disabled:opacity-50"
        >
          {generating ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <FiZap className="w-6 h-6" />
          )}
        </motion.button>
      )}
    </div>
  );
};

export default InterviewPrep;

` 


## File: frontend\src\pages\LandingPage.jsx

`$lang

import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";

// ========== Custom Hook: useInView ==========
const useInView = (options = { threshold: 0.3 }) => {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsInView(true);
    }, options);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isInView };
};

// ========== CountUp Component ==========
const CountUp = ({ end, duration = 2, suffix = "" }) => {
  const { ref, isInView } = useInView({ threshold: 0.5 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = end / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);

  return (
    <span ref={ref} className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
      {count}{suffix}
    </span>
  );
};

// ========== Feature Card with 3D Tilt ==========
const FeatureCard = ({ icon, title, description, delay }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [15, -15]);
  const rotateY = useTransform(x, [-100, 100], [-15, 15]);
  const springConfig = { damping: 25, stiffness: 300 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = (mouseX / width - 0.5) * 2;
    const yPct = (mouseY / height - 0.5) * 2;
    x.set(xPct * 20);
    y.set(yPct * 20);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX: springRotateX, rotateY: springRotateY, transformStyle: "preserve-3d" }}
      className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
};

// ========== Main Landing Page ==========
const LandingPage = () => {
  const navigate = useNavigate();

  // Floating orbs animation variants
  const orbVariants = {
    animate: (i) => ({
      x: [0, 30, -20, 0],
      y: [0, -40, 20, 0],
      scale: [1, 1.2, 0.9, 1],
      rotate: [0, 10, -10, 0],
      transition: {
        duration: 15,
        repeat: Infinity,
        repeatType: "mirror",
        delay: i * 2,
      },
    }),
  };

  const features = [
    { icon: "ðŸŽ¯", title: "Personalized Questions", description: "AI generates role-specific questions based on your industry and experience level." },
    { icon: "âš¡", title: "Real-time Feedback", description: "Get instant analysis of your answers with actionable improvement tips." },
    { icon: "ðŸ“Š", title: "Progress Tracking", description: "Monitor your performance over time with detailed analytics and insights." },
    { icon: "ðŸŽ™ï¸", title: "Voice Simulation", description: "Practice with realistic voice interviews and speech recognition." },
    { icon: "ðŸ“", title: "Expert Answers", description: "Compare your responses with model answers from industry professionals." },
    { icon: "ðŸ”’", title: "Secure & Private", description: "Your data is encrypted and never shared with third parties." },
  ];

  const testimonials = [
    { name: "Sarah Johnson", role: "Software Engineer", text: "This platform helped me land my dream job at Google. The AI feedback was incredibly accurate!", avatar: "SJ" },
    { name: "Michael Chen", role: "Product Manager", text: "I've recommended this to all my colleagues. The mock interviews are better than real ones.", avatar: "MC" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
      <Navbar variant="marketing" />
      {/* Custom Animations CSS */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 15s infinite;
        }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>

      {/* Background Animated Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-20 -left-20 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute top-40 -right-20 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-20 left-1/3 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-32">
        <div className="max-w-6xl mx-auto text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold tracking-wide text-indigo-600 uppercase bg-indigo-50/80 backdrop-blur-sm rounded-full shadow-sm"
          >
            Revolutionize Your Interviews
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-slate-900 mb-6 leading-[1.2] tracking-tight"
          >
            Ace Your Next Interview with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 animate-gradient">
              AI-Powered Mastery
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            The ultimate platform for personalized interview preparation. Generate real-world questions,
            get expert insights, and build confidence with our state-of-the-art AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-5 justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/signup")}
              className="px-8 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-200 hover:shadow-2xl transition-all"
            >
              Start Your Journey â†’
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: "#f8fafc" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/login")}
              className="px-8 py-4 bg-white/80 backdrop-blur-sm text-slate-900 border border-slate-200 rounded-2xl font-bold text-lg hover:border-indigo-300 transition-all"
            >
              Login to Dashboard
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 1, duration: 1 }}
            className="mt-20 flex items-center justify-center gap-8 grayscale"
          >
            <span className="font-bold text-xl tracking-tighter text-slate-500">TECHSTAR</span>
            <span className="font-bold text-xl tracking-tighter text-slate-500">MODERN</span>
            <span className="font-bold text-xl tracking-tighter text-slate-500">FUTURE</span>
          </motion.div>
        </div>
      </section>

      {/* ========== FEATURES SECTION ========== */}
      <section className="relative py-24 px-4 bg-white/40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
              Powerful Features to <span className="text-indigo-600">Excel</span>
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Everything you need to transform your interview skills and land your dream job.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} {...feature} delay={idx * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ========== STATS SECTION ========== */}
      <section className="relative py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <CountUp end={10000} suffix="+" />
              <p className="text-slate-600 mt-2 font-medium">Interviews Simulated</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <CountUp end={95} suffix="%" />
              <p className="text-slate-600 mt-2 font-medium">Success Rate</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <CountUp end={50} suffix="+" />
              <p className="text-slate-600 mt-2 font-medium">Industries Covered</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== TESTIMONIALS SECTION ========== */}
      <section className="relative py-24 px-4 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
              Loved by <span className="text-purple-600">Professionals</span>
            </h2>
            <p className="text-slate-600">Join thousands who aced their interviews with our platform.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: idx === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.2 }}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{testimonial.name}</h4>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-slate-600 italic">"{testimonial.text}"</p>
                <div className="mt-4 flex text-yellow-400">â˜…â˜…â˜…â˜…â˜…</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA SECTION ========== */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-12 shadow-2xl border border-white/50"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
              Ready to <span className="text-indigo-600">Transform</span> Your Career?
            </h2>
            <p className="text-slate-600 mb-8 text-lg">
              Join thousands of successful candidates who prepared with us.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/signup")}
              className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Get Started Free â†’
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="relative border-t border-slate-200 py-12 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center text-slate-500 text-sm">
          <p>Â© 2025 InterviewMaster. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <a href="#" className="hover:text-indigo-600 transition">Privacy</a>
            <a href="#" className="hover:text-indigo-600 transition">Terms</a>
            <a href="#" className="hover:text-indigo-600 transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

` 


## File: frontend\src\pages\Login.jsx

`$lang

import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";
import Navbar from "../components/Navbar";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const emailInputRef = useRef(null);

  // Auto-focus email input on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  // Real-time email validation
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email is required";
    if (!re.test(email)) return "Invalid email format";
    return "";
  };

  // Password strength indicator
  const getPasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const handleForm = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Real-time validation
    if (name === "email") {
      setErrors({ ...errors, email: validateEmail(value) });
    } else if (name === "password") {
      setErrors({ ...errors, password: value ? "" : "Password is required" });
    }
  };

  const handleLogin = async () => {
    // Final validation
    const emailError = validateEmail(form.email);
    const passwordError = form.password ? "" : "Password is required";
    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(API_PATHS.AUTH.LOGIN, form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userName", res.data.name);
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", form.email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      // Animated error alert (custom toast-like)
      const errorMsg = error.response?.data?.message || "Invalid email or password";
      setErrors({ ...errors, form: errorMsg });
      setTimeout(() => setErrors({ ...errors, form: "" }), 4000);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) handleLogin();
  };

  // Background floating orbs animation
  const orbVariants = {
    animate: (i) => ({
      x: [0, 40, -30, 0],
      y: [0, -50, 30, 0],
      scale: [1, 1.3, 0.8, 1],
      transition: {
        duration: 18,
        repeat: Infinity,
        repeatType: "mirror",
        delay: i * 2.5,
      },
    }),
  };

  // Form field stagger variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 12 } },
  };

  const passwordStrength = getPasswordStrength(form.password);
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const strengthText = ["", "Weak", "Medium", "Strong", "Very Strong"];

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50 px-4 pt-24 pb-12 relative overflow-hidden font-sans"
      onKeyPress={handleKeyPress}
    >
      <Navbar variant="auth" />
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-1/4 -left-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-3/4 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/30 hover:shadow-indigo-100/50 transition-shadow duration-500">

          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-center text-slate-900 mb-2"
          >
            Welcome Back
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-slate-500 text-center mb-8"
          >
            Access your AI-powered interview prep
          </motion.p>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Email Field */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  ref={emailInputRef}
                  name="email"
                  type="email"
                  value={form.email}
                  placeholder="name@example.com"
                  onChange={handleForm}
                  className={`w-full bg-slate-50 border ${errors.email ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-indigo-200"
                    } rounded-2xl p-4 pr-10 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
                />
                {form.email && !errors.email && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                  >
                    âœ“
                  </motion.div>
                )}
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Password Field */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  onChange={handleForm}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-transparent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition"
                >
                  {showPassword ? "ðŸ‘ï¸" : "ðŸ‘ï¸â€ðŸ—¨ï¸"}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {form.password && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  className="mt-2"
                >
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 transition-all duration-300 ${i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-slate-200"
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {strengthText[passwordStrength]} password
                  </p>
                </motion.div>
              )}
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Remember Me & Forgot Password */}
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-between"
            >
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-all hover:underline"
              >
                Forgot password?
              </Link>
            </motion.div>
          </motion.div>

          {/* Global Form Error */}
          <AnimatePresence>
            {errors.form && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
              >
                {errors.form}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Button */}
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={handleLogin}
            disabled={loading || !!errors.email || !form.email || !form.password}
            className={`w-full py-4 rounded-2xl font-bold text-lg mt-6 transition-all duration-200 flex items-center justify-center gap-2 ${loading || errors.email || !form.email || !form.password
              ? "bg-slate-300 cursor-not-allowed text-slate-500"
              : "bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-200 hover:shadow-xl"
              }`}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Authenticating...
              </>
            ) : (
              "Login â†’"
            )}
          </motion.button>

          {/* Divider with animated line */}
          <div className="flex items-center my-8">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
            <p className="px-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
              secure login
            </p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-slate-600">
            New here?{" "}
            <Link
              to="/signup"
              className="text-indigo-600 font-bold hover:text-indigo-700 transition-all hover:underline"
            >
              Create Account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

` 


## File: frontend\src\pages\SignUp.jsx

`$lang

import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";
import Navbar from "../components/Navbar";

const SignUp = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: "",
    general: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const nameInputRef = useRef(null);

  // Auto-focus name field on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Real-time validators
  const validateName = (name) => {
    if (!name) return "Full name is required";
    if (name.trim().length < 2) return "Name must be at least 2 characters";
    if (!/^[a-zA-Z\s]+$/.test(name)) return "Name can only contain letters and spaces";
    return "";
  };

  const validateEmail = (email) => {
    if (!email) return "Email is required";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return "Invalid email format";
    return "";
  };

  const getPasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const validateConfirmPassword = (confirm, password) => {
    if (!confirm) return "Please confirm your password";
    if (confirm !== password) return "Passwords do not match";
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Real-time field validation
    let error = "";
    if (name === "name") error = validateName(value);
    if (name === "email") error = validateEmail(value);
    if (name === "password") {
      error = validatePassword(value);
      // Also revalidate confirm password if it exists
      if (form.confirmPassword) {
        const confirmError = validateConfirmPassword(form.confirmPassword, value);
        setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
      }
    }
    if (name === "confirmPassword") error = validateConfirmPassword(value, form.password);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSignup = async () => {
    // Final validation
    const nameError = validateName(form.name);
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);
    const confirmError = validateConfirmPassword(form.confirmPassword, form.password);
    const termsError = acceptTerms ? "" : "You must accept the Terms & Conditions";

    if (nameError || emailError || passwordError || confirmError || termsError) {
      setErrors({
        name: nameError,
        email: emailError,
        password: passwordError,
        confirmPassword: confirmError,
        terms: termsError,
        general: "",
      });
      return;
    }

    setLoading(true);
    try {
      await axios.post(API_PATHS.AUTH.SIGNUP, {
        name: form.name.trim(),
        email: form.email,
        password: form.password,
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userName", res.data.name);
      // Show success message
      alert("Account created successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || "Signup failed. Please try again.";
      setErrors((prev) => ({ ...prev, general: msg }));
      // Auto-clear general error after 4 seconds
      setTimeout(() => setErrors((prev) => ({ ...prev, general: "" })), 4000);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) handleSignup();
  };

  // Password strength
  const passwordStrength = getPasswordStrength(form.password);
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"];
  const strengthText = ["", "Weak", "Medium", "Strong", "Very Strong"];

  // Background floating orbs animation (matching login/landing)
  const orbVariants = {
    animate: (i) => ({
      x: [0, 40, -30, 0],
      y: [0, -50, 30, 0],
      scale: [1, 1.3, 0.8, 1],
      transition: {
        duration: 18,
        repeat: Infinity,
        repeatType: "mirror",
        delay: i * 2.5,
      },
    }),
  };

  // Stagger variants for form fields
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 12 } },
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50 px-4 pt-24 pb-12 relative overflow-hidden font-sans"
      onKeyPress={handleKeyPress}
    >
      <Navbar variant="auth" />
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-1/4 -left-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-3/4 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/30 hover:shadow-purple-100/50 transition-shadow duration-500">

          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-center text-slate-900 mb-2"
          >
            Create Account
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-slate-500 text-center mb-8"
          >
            Join the future of interview preparation
          </motion.p>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Full Name */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Full Name
              </label>
              <input
                ref={nameInputRef}
                name="name"
                type="text"
                value={form.name}
                placeholder="John Doe"
                onChange={handleChange}
                className={`w-full bg-slate-50 border ${errors.name ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-purple-200"
                  } rounded-2xl p-4 pr-10 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
              />
              <AnimatePresence>
                {errors.name && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.name}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Email */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  placeholder="name@example.com"
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border ${errors.email ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-purple-200"
                    } rounded-2xl p-4 pr-10 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
                />
                {form.email && !errors.email && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                  >
                    âœ“
                  </motion.div>
                )}
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  placeholder="Create a strong password"
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-transparent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition"
                >
                  {showPassword ? "ðŸ‘ï¸" : "ðŸ‘ï¸â€ðŸ—¨ï¸"}
                </button>
              </div>
              {/* Password Strength Indicator */}
              {form.password && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  className="mt-2"
                >
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 transition-all duration-300 ${i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-slate-200"
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {strengthText[passwordStrength]} password
                  </p>
                </motion.div>
              )}
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Confirm Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  placeholder="Confirm your password"
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border ${errors.confirmPassword ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-purple-200"
                    } rounded-2xl p-4 pr-12 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition"
                >
                  {showConfirmPassword ? "ðŸ‘ï¸" : "ðŸ‘ï¸â€ðŸ—¨ï¸"}
                </button>
              </div>
              <AnimatePresence>
                {errors.confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.confirmPassword}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Terms & Conditions */}
            <motion.div variants={itemVariants} className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (e.target.checked) setErrors((prev) => ({ ...prev, terms: "" }));
                  else setErrors((prev) => ({ ...prev, terms: "You must accept the Terms & Conditions" }));
                }}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="terms" className="text-sm text-slate-600">
                I accept the{" "}
                <a href="/terms" className="text-purple-600 hover:underline font-medium">
                  Terms & Conditions
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-purple-600 hover:underline font-medium">
                  Privacy Policy
                </a>
              </label>
            </motion.div>
            <AnimatePresence>
              {errors.terms && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-500 text-xs -mt-2 ml-6"
                >
                  {errors.terms}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* General Error Alert */}
          <AnimatePresence>
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
              >
                {errors.general}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Signup Button */}
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={handleSignup}
            disabled={
              loading ||
              !!errors.name ||
              !!errors.email ||
              !!errors.password ||
              !!errors.confirmPassword ||
              !form.name ||
              !form.email ||
              !form.password ||
              !form.confirmPassword ||
              !acceptTerms
            }
            className={`w-full py-4 rounded-2xl font-bold text-lg mt-6 transition-all duration-200 flex items-center justify-center gap-2 ${loading ||
              errors.name ||
              errors.email ||
              errors.password ||
              errors.confirmPassword ||
              !form.name ||
              !form.email ||
              !form.password ||
              !form.confirmPassword ||
              !acceptTerms
              ? "bg-slate-300 cursor-not-allowed text-slate-500"
              : "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-200 hover:shadow-xl"
              }`}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating Account...
              </>
            ) : (
              "Join Now â†’"
            )}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center my-8">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
            <p className="px-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
              quick setup
            </p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
          </div>

          {/* Login Link */}
          <p className="text-center text-slate-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-purple-600 font-bold hover:text-purple-700 transition-all hover:underline"
            >
              Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignUp;

` 


## File: frontend\src\utils\apiPaths.js

`$lang

const VITE_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const BASE_URL = `${VITE_BASE}/api`;

export const API_PATHS = {
  AUTH: {
    LOGIN: `${BASE_URL}/auth/login`,
    SIGNUP: `${BASE_URL}/auth/signup`,
  },
  SESSION: {
    CREATE: `${BASE_URL}/sessions/create`,
    GET_ALL: `${BASE_URL}/sessions/my-sessions`,
    GET_ONE: `${BASE_URL}/sessions`, // usage: GET_ONE/:id
  },
  AI: {
    GENERATE_QUESTIONS: `${BASE_URL}/ai/generate-questions`,
    EXPLAIN: `${BASE_URL}/ai/generate-explanation`,
  },
};

` 


## File: frontend\src\utils\axiosInstance.js

`$lang

// utils/axiosInstance.js
import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
});

// âœ… This interceptor runs before every request and attaches the token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // or wherever you store it
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export default axiosInstance;

` 


## [Backend Models]

### File: backend/models/question-model.js

`javascript

import mongoose from "mongoose";

const questionsSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    question: String,
    answer: String,
  },
  { timestamps: true },
);

const Question = mongoose.model("Question", questionsSchema);

export default Question;

// let question = {
//   session: "Session_ID",
//   questions: "What is node",
//   ans: "thi is ans",
// };

` 


### File: backend/models/session-model.js

`javascript

// session role -> mern full stack, java full stack ,frontend
// exp => 2, 1, 10
// userId => this will store ref

import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, required: true },
    experience: { type: String, required: true },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
  },
  { timestamps: true },
);

const Session = mongoose.model("Session", sessionSchema);

export default Session;

` 


### File: backend/models/user-model.js

`javascript

import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true },
);

const User = mongoose.model("User", UserSchema);

export default User;

` 


## [Backend Controllers]

### File: backend/controller/ai-controller.js

`javascript

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

` 


### File: backend/controller/auth-controller.js

`javascript

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user-model.js";

// Generate JWT Token
const generateToken = (userId) => {
  let token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
  return token;
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Signup Error:", error.message);
    
    // Catch specific Mongoose/Atlas errors
    if (error.name === "MongooseServerSelectionError") {
      return res.status(503).json({ 
        message: "Database connection timed out. This is often due to an IP whitelist issue in MongoDB Atlas." 
      });
    }

    res.status(500).json({ message: "An unexpected server error occurred." });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Login Error:", error.message);

    if (error.name === "MongooseServerSelectionError") {
      return res.status(503).json({ 
        message: "Database connection unavailable. Verify your Atlas IP whitelist." 
      });
    }

    res.status(500).json({ message: "Login failed due to a server error." });
  }
};

` 


### File: backend/controller/session-controller.js

`javascript

import Question from "../models/question-model.js";
import Session from "../models/session-model.js";

// @desc    Create a new session and linked questions
// @route   POST /api/sessions/create
// @access  Private
export const createSession = async (req, res) => {
  try {
    const { role, experience, topicsToFocus, description, questions } =
      req.body;
    const userId = req.user._id; // Assuming you have a middleware setting req.user

    // Create the session
    const session = await Session.create({
      user: userId,
      role,
      experience,
      topicsToFocus,
      description,
    });

    // Create questions and collect their IDs
    const questionDocs = await Promise.all(
      questions.map(async (q) => {
        const question = await Question.create({
          session: session._id,
          question: q.question,
          answer: q.answer || "",
          note: q.note || "",
          isPinned: q.isPinned || false,
        });
        return question._id;
      }),
    );

    // Update session with question IDs
    session.questions = questionDocs;
    await session.save();

    // Return the populated session
    // const populatedSession = await Session.findById(session._id).populate(
    //   "questions",
    // );

    // res.status(201).json({
    //   success: true,
    //   data: populatedSession,
    // });
    res.status(201).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Get all sessions for the logged-in user
// @route   GET /api/sessions/my-sessions
// @access  Private
export const getMySessions = async (req, res) => {
  try {
    const userId = req.user._id;

    const sessions = await Session.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("questions");

    res.status(200).json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Get a session by ID with populated questions
// @route   GET /api/sessions/:id
// @access  Private
export const getSessionById = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate("questions")
      .populate("user", "name email");

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    // Check if the session belongs to the logged-in user
    if (session.user._id.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


` 


## [backend/routes/*.js]

### File: backend/routes/*.js/ai-route.js

`javascript

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

` 


### File: backend/routes/*.js/auth-route.js

`javascript

import express from "express";
import { checkDB } from "../middlewares/db-middleware.js";
import {
  loginUser,
  registerUser,
} from "../controller/auth-controller.js";

const router = express.Router();

// Auth Routes (with DB check)
router.post("/signup", checkDB, registerUser); // Register User
router.post("/login", checkDB, loginUser); // Login User

export default router;

` 


### File: backend/routes/*.js/session-route.js

`javascript

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

` 


## [backend/middlewares/*.js]

### File: backend/middlewares/*.js/auth-middleware.js

`javascript

import jwt from "jsonwebtoken";
import User from "../models/user-model.js";

// Middleware to protect routes
export const protect = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (token && token.startsWith("Bearer ")) {
      token = token.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      next();
    } else {
      res.status(401).json({ message: "Not authorized, no token" });
    }
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

` 


### File: backend/middlewares/*.js/db-middleware.js

`javascript

import mongoose from "mongoose";

// Middleware to check if database is connected
export const checkDB = (req, res, next) => {
  const state = mongoose.connection.readyState;

  // 1 = connected
  if (state === 1) {
    return next();
  }

  // 0 = disconnected, 2 = connecting, 3 = disconnecting
  const messages = {
    0: "Database disconnected. Please ensure your IP is whitelisted in MongoDB Atlas.",
    2: "Database connecting. Please wait a moment and try again.",
    3: "Database disconnecting. Please try again later.",
  };

  const message = messages[state] || "Database connection unavailable. Check your Atlas IP whitelist.";

  res.status(503).json({
    success: false,
    message,
    diagnostic: "ERR_DB_NOT_CONNECTED",
    atlas_help: "https://www.mongodb.com/docs/atlas/security-whitelist/"
  });
};

` 


## [frontend/src/pages/*.jsx]

### File: frontend/src/pages/*.jsx/Dashboard.jsx

`javascript

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";
import {
  FiPlus,
  FiArrowRight,
  FiLogOut,
  FiLayout,
  FiBookOpen,
  FiBarChart2,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiMenu,
  FiX,
  FiStar,
  FiTrendingUp,
} from "react-icons/fi";
import SkeletonCard from "../components/SkeletonCard";
import Navbar from "../components/Navbar";

const orbVariants = {
  animate: (i) => ({
    x: [0, 40, -30, 0],
    y: [0, -50, 30, 0],
    scale: [1, 1.3, 0.8, 1],
    transition: {
      duration: 18,
      repeat: Infinity,
      repeatType: "mirror",
      delay: i * 2.5,
    },
  }),
};

// Stagger variants for session cards
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 15 } },
};

const Dashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
    setUserName(localStorage.getItem("userName") || "");
  }, []);

  const fetchSessions = async () => {
    setFetching(true);
    try {
      const res = await axios.get(API_PATHS.SESSION.GET_ALL);
      setSessions(res.data.sessions);
    } catch (error) {
      console.log(error.response);
      if (error.response?.status === 401) navigate("/login");
      else showToast("Failed to load sessions", "error");
    } finally {
      setFetching(false);
    }
  };

  const createSession = async () => {
    if (!role.trim()) {
      showToast("Please enter a target role", "error");
      return;
    }
    if (!experience.trim()) {
      showToast("Please enter experience level", "error");
      return;
    }
    setLoading(true);
    try {
      await axios.post(API_PATHS.SESSION.CREATE, {
        role: role.trim(),
        experience: experience.trim(),
        questions: [],
      });
      setRole("");
      setExperience("");
      await fetchSessions();
      showToast("Session created successfully!", "success");
    } catch (error) {
      console.log(error.response);
      showToast(error.response?.data?.message || "Failed to create session", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // Calculate dashboard stats
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.questions?.length > 0).length;
  const completionRate = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0;
  // Mock average score - in real app you'd have scores in session data
  const avgScore = sessions.reduce((acc, s) => acc + (s.avgScore || 0), 0) / totalSessions || 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
      <Navbar
        variant="app"
        onMenuToggle={setMobileMenuOpen}
        userName={userName}
      />
      {/* Background Orbs & Grid */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-20 -left-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-20 -right-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
      </div>
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border ${toast.type === "success"
              ? "bg-green-50/90 border-green-200 text-green-800"
              : "bg-red-50/90 border-red-200 text-red-800"
              }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex relative z-10">
        {/* Sidebar - Desktop & Mobile */}
        <motion.aside
          initial={{ x: -300 }}
          animate={{ x: mobileMenuOpen ? 0 : -300 }}
          transition={{ type: "spring", damping: 20 }}
          className={`fixed top-0 left-0 h-full w-72 bg-white/80 backdrop-blur-xl border-r border-white/30 shadow-2xl z-50 flex flex-col p-6 transition-all md:relative md:translate-x-0 md:w-64`}
        >
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                Q
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Interview.ai
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-500 hover:text-slate-800"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            <motion.button
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-xl font-semibold transition-all"
            >
              <FiLayout className="w-5 h-5" /> Dashboard
            </motion.button>
            <motion.button
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-semibold transition-all"
            >
              <FiBookOpen className="w-5 h-5" /> My Prep
            </motion.button>
            <motion.button
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-semibold transition-all"
            >
              <FiBarChart2 className="w-5 h-5" /> Analytics
            </motion.button>
          </nav>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-all mt-auto"
          >
            <FiLogOut className="w-5 h-5" /> Logout
          </motion.button>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen p-4 md:p-8 pt-24 md:pt-24">

          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Pro</span>
            </h1>
            <p className="text-slate-500 mt-1">Track your interview preparation progress</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10"
          >
            {fetching ? (
              <>
                <SkeletonCard variant="stat" />
                <SkeletonCard variant="stat" />
                <SkeletonCard variant="stat" />
              </>
            ) : (
              <>
                <StatCard
                  icon={<FiBookOpen className="w-6 h-6" />}
                  title="Total Sessions"
                  value={totalSessions}
                  color="indigo"
                  delay={0}
                />
                <StatCard
                  icon={<FiCheckCircle className="w-6 h-6" />}
                  title="Completion Rate"
                  value={`${completionRate}%`}
                  color="purple"
                  delay={0.1}
                />
                <StatCard
                  icon={<FiStar className="w-6 h-6" />}
                  title="Avg. Score"
                  value={`${Math.round(avgScore)}%`}
                  color="pink"
                  delay={0.2}
                />
              </>
            )}
          </motion.div>

          {/* Create Session Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/60 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/30 shadow-xl mb-10"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full"></span>
              Start New Preparation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                  Target Role
                </label>
                <input
                  placeholder="e.g. Senior Frontend Developer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                  Experience
                </label>
                <input
                  placeholder="e.g. 5+ years"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all font-medium"
                />
              </div>
              <div className="flex items-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={createSession}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white h-[58px] rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <FiPlus /> Create Session
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Sessions List */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-6 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></span>
              Your Recent Sessions
            </h2>
            {sessions.length > 0 && (
              <motion.button
                whileHover={{ x: 3 }}
                className="text-indigo-600 font-semibold text-sm flex items-center gap-1"
              >
                View All <FiChevronRight />
              </motion.button>
            )}
          </div>

          {fetching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} variant="session" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/60 backdrop-blur-sm rounded-3xl p-12 text-center border border-dashed border-slate-300"
            >
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiBookOpen className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-xl font-bold text-slate-800">No sessions yet</p>
              <p className="text-slate-500 mt-2">Create your first session above to begin your training</p>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {sessions.map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                  onClick={() => navigate(`/interview/${session._id}`)}
                />
              ))}
            </motion.div>
          )}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLogoutModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiLogOut className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Logout?</h3>
              <p className="text-slate-500 text-center mb-6">
                Are you sure you want to logout? You'll need to login again to access your sessions.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, title, value, color, delay }) => {
  const colorClasses = {
    indigo: "from-indigo-500 to-indigo-600",
    purple: "from-purple-500 to-purple-600",
    pink: "from-pink-500 to-pink-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all"
    >
      <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-xl flex items-center justify-center text-white mb-4`}>
        {icon}
      </div>
      <p className="text-3xl font-black text-slate-900">{value}</p>
      <p className="text-slate-500 text-sm mt-1">{title}</p>
    </motion.div>
  );
};

// Session Card Component
const SessionCard = ({ session, onClick }) => {
  const questionCount = session.questions?.length || 0;
  const totalQuestions = 10; // Mock total, replace with actual from session config
  const progress = (questionCount / totalQuestions) * 100;

  // Determine experience level tag
  const getLevelTag = (exp) => {
    const years = parseInt(exp);
    if (isNaN(years)) return "Mid-Level";
    if (years < 2) return "Junior";
    if (years <= 5) return "Mid-Level";
    if (years <= 8) return "Senior";
    return "Lead";
  };
  const level = getLevelTag(session.experience);
  const levelColors = {
    Junior: "bg-green-100 text-green-700",
    "Mid-Level": "bg-blue-100 text-blue-700",
    Senior: "bg-purple-100 text-purple-700",
    Lead: "bg-orange-100 text-orange-700",
  };

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      onClick={onClick}
      className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg cursor-pointer group relative overflow-hidden transition-all hover:shadow-2xl"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-bl-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:from-indigo-600 group-hover:to-purple-600 group-hover:text-white transition-all">
            <FiBookOpen className="w-6 h-6" />
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${levelColors[level]}`}>
            {level}
          </span>
        </div>

        <h3 className="font-bold text-xl text-slate-900 mb-1 line-clamp-1">{session.role}</h3>
        <p className="text-slate-500 text-sm mb-4">{session.experience} experience</p>

        {/* Progress Section */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>{questionCount}/{totalQuestions} questions</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm group-hover:gap-3 transition-all">
          Continue Practice <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;

` 


### File: frontend/src/pages/*.jsx/InterviewPrep.jsx

`javascript

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCpu,
  FiMessageCircle,
  FiClock,
  FiLayers,
  FiCheckCircle,
  FiCopy,
  FiThumbsUp,
  FiShare2,
  FiChevronDown,
  FiChevronUp,
  FiZap,
  FiStar,
} from "react-icons/fi";

import QAItem from "../components/QAItems";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import GenerateButton from "../components/GenerateButton";
import SkeletonCard from "../components/SkeletonCard";
import Navbar from "../components/Navbar";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";

const parseError = (err) => {
  console.log(err);
  if (err.response)
    return (
      err.response.data?.message ||
      err.response.data?.error ||
      `Server error: ${err.response.status}`
    );
  if (err.request) return "Cannot reach server. Check your connection.";
  return err.message || "Something went wrong.";
};

const InterviewPrep = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [expandedQA, setExpandedQA] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [helpfulIds, setHelpfulIds] = useState(new Set());
  const [userName, setUserName] = useState("");
  const headerRef = useRef(null);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.95]);
  const headerBlur = useTransform(scrollY, [0, 100], [0, 8]);
  const headerBlurStr = useTransform(headerBlur, (val) => `blur(${val}px)`);

  // Floating orbs animation (consistent with other pages)
  const orbVariants = {
    animate: (i) => ({
      x: [0, 40, -30, 0],
      y: [0, -50, 30, 0],
      scale: [1, 1.3, 0.8, 1],
      transition: {
        duration: 18,
        repeat: Infinity,
        repeatType: "mirror",
        delay: i * 2.5,
      },
    }),
  };

  const fetchSessionData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await axios.get(`${API_PATHS.SESSION.GET_ONE}/${id}`);
      setSession(res.data.session);
      const qs = res.data.session.questions || [];
      setQuestions(qs);
      // Auto-expand first question if any
      if (qs.length > 0 && expandedQA === null) setExpandedQA(qs[0]._id);
    } catch (err) {
      console.log(err.response);
      setFetchError(parseError(err));
      if (err.response?.status === 401) navigate("/login");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, expandedQA]);

  const generateQuestions = async () => {
    setGenerating(true);
    const loadingToast = toast.loading(
      <div className="flex items-center gap-2">
        <FiZap className="animate-pulse" />
        <span>AI is crafting expert questions...</span>
      </div>,
      {
        className: "!bg-slate-900 !text-white !font-bold !rounded-2xl",
        duration: Infinity,
      }
    );
    try {
      await axios.post(API_PATHS.AI.GENERATE_QUESTIONS, { sessionId: id });
      await fetchSessionData();
      toast.success(
        <div className="flex items-center gap-2">
          <FiCheckCircle className="text-green-400" />
          <span>{questions.length} expert questions generated!</span>
        </div>,
        { id: loadingToast }
      );
    } catch (err) {
      toast.error(parseError(err), { id: loadingToast });
    } finally {
      setGenerating(false);
    }
  };

  const copyAnswer = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Answer copied to clipboard!", {
      icon: "ðŸ“‹",
      duration: 1500,
      className: "!rounded-xl",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const markHelpful = (id) => {
    setHelpfulIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
    toast.success(
      helpfulIds.has(id) ? "Removed helpful mark" : "Thanks for your feedback!",
      { icon: helpfulIds.has(id) ? "ðŸ‘" : "â¤ï¸", duration: 1000 }
    );
  };

  useEffect(() => {
    fetchSessionData();
    setUserName(localStorage.getItem("userName") || "");
  }, [fetchSessionData]);

  // Staggered QA card variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.2 },
    },
  };

  const cardVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 15 } },
    exit: { y: -20, opacity: 0, transition: { duration: 0.2 } },
  };

  const leftNavbarAction = (
    <motion.button
      whileHover={{ x: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate("/dashboard")}
      className="flex items-center gap-2 text-slate-600 font-semibold hover:text-indigo-600 transition-colors group"
    >
      <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" />
      <span className="hidden sm:inline">Back to Dashboard</span>
    </motion.button>
  );

  const rightNavbarAction = (
    <div className="flex items-center gap-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-wider shadow-sm"
      >
        <FiCpu className="w-3.5 h-3.5 animate-pulse" /> AI Enhanced
      </motion.div>
      <GenerateButton
        onClick={generateQuestions}
        generating={generating}
        loading={loading}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
      <Navbar 
        variant="app" 
        leftAction={leftNavbarAction} 
        rightAction={rightNavbarAction} 
        userName={userName}
      />
      {/* Background Orbs & Grid */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-20 -left-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-20 -right-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
      </div>
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      <Toaster
        position="top-right"
        toastOptions={{
          className: "!rounded-2xl !px-6 !py-4 !shadow-xl !font-bold !backdrop-blur-md",
          duration: 4000,
          style: { background: "rgba(15, 23, 42, 0.9)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
        }}
      />


      <div className="max-w-5xl mx-auto px-6 py-10 md:py-14 pt-24 md:pt-32">
        {/* Session Header with Animated Stats */}
        <div className="mb-12">
          {session ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, type: "spring" }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-3xl blur-2xl -z-10" />
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/30 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                      <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.2em]">
                        Active Session
                      </p>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                      {session.role}
                    </h1>
                    <div className="flex flex-wrap items-center gap-6">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-2 text-slate-600 font-semibold text-sm bg-slate-100 px-3 py-1.5 rounded-full"
                      >
                        <FiLayers className="w-4 h-4 text-indigo-500" />
                        {session.experience} years exp.
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-2 text-slate-600 font-semibold text-sm bg-slate-100 px-3 py-1.5 rounded-full"
                      >
                        <FiClock className="w-4 h-4 text-indigo-500" />
                        {new Date(session.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-2 text-slate-600 font-semibold text-sm bg-slate-100 px-3 py-1.5 rounded-full"
                      >
                        <FiMessageCircle className="w-4 h-4 text-indigo-500" />
                        {questions.length} question{questions.length !== 1 ? "s" : ""}
                      </motion.div>
                    </div>
                  </div>
                  {questions.length > 0 && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full"
                    >
                      <FiCheckCircle className="w-4 h-4" />
                      Ready for practice
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <SkeletonCard variant="full" />
          )}
        </div>

        {/* Q&A List with Enhanced Animations */}
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={i} variant="qa" />
              ))}
            </div>
          ) : fetchError ? (
            <ErrorBanner message={fetchError} onRetry={fetchSessionData} />
          ) : questions.length === 0 ? (
            <EmptyState onGenerate={generateQuestions} generating={generating} />
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 gap-6 pb-24"
            >
              <AnimatePresence mode="popLayout">
                {questions.map((q, idx) => (
                  <motion.div
                    key={q._id}
                    variants={cardVariants}
                    exit="exit"
                    layout
                    className="group"
                  >
                    <QAItem
                      item={q}
                      isExpanded={expandedQA === q._id}
                      onToggle={() =>
                        setExpandedQA(expandedQA === q._id ? null : q._id)
                      }
                      onCopy={() => copyAnswer(q.answer || "No answer provided.", q._id)}
                      onHelpful={() => markHelpful(q._id)}
                      isHelpful={helpfulIds.has(q._id)}
                      isCopied={copiedId === q._id}
                      index={idx + 1}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Floating Action Button (Mobile) */}
      {!loading && questions.length > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={generateQuestions}
          disabled={generating}
          className="fixed bottom-6 right-6 md:hidden z-40 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center disabled:opacity-50"
        >
          {generating ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <FiZap className="w-6 h-6" />
          )}
        </motion.button>
      )}
    </div>
  );
};

export default InterviewPrep;

` 


### File: frontend/src/pages/*.jsx/LandingPage.jsx

`javascript

import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";

// ========== Custom Hook: useInView ==========
const useInView = (options = { threshold: 0.3 }) => {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsInView(true);
    }, options);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isInView };
};

// ========== CountUp Component ==========
const CountUp = ({ end, duration = 2, suffix = "" }) => {
  const { ref, isInView } = useInView({ threshold: 0.5 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = end / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);

  return (
    <span ref={ref} className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
      {count}{suffix}
    </span>
  );
};

// ========== Feature Card with 3D Tilt ==========
const FeatureCard = ({ icon, title, description, delay }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [15, -15]);
  const rotateY = useTransform(x, [-100, 100], [-15, 15]);
  const springConfig = { damping: 25, stiffness: 300 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = (mouseX / width - 0.5) * 2;
    const yPct = (mouseY / height - 0.5) * 2;
    x.set(xPct * 20);
    y.set(yPct * 20);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX: springRotateX, rotateY: springRotateY, transformStyle: "preserve-3d" }}
      className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
};

// ========== Main Landing Page ==========
const LandingPage = () => {
  const navigate = useNavigate();

  // Floating orbs animation variants
  const orbVariants = {
    animate: (i) => ({
      x: [0, 30, -20, 0],
      y: [0, -40, 20, 0],
      scale: [1, 1.2, 0.9, 1],
      rotate: [0, 10, -10, 0],
      transition: {
        duration: 15,
        repeat: Infinity,
        repeatType: "mirror",
        delay: i * 2,
      },
    }),
  };

  const features = [
    { icon: "ðŸŽ¯", title: "Personalized Questions", description: "AI generates role-specific questions based on your industry and experience level." },
    { icon: "âš¡", title: "Real-time Feedback", description: "Get instant analysis of your answers with actionable improvement tips." },
    { icon: "ðŸ“Š", title: "Progress Tracking", description: "Monitor your performance over time with detailed analytics and insights." },
    { icon: "ðŸŽ™ï¸", title: "Voice Simulation", description: "Practice with realistic voice interviews and speech recognition." },
    { icon: "ðŸ“", title: "Expert Answers", description: "Compare your responses with model answers from industry professionals." },
    { icon: "ðŸ”’", title: "Secure & Private", description: "Your data is encrypted and never shared with third parties." },
  ];

  const testimonials = [
    { name: "Sarah Johnson", role: "Software Engineer", text: "This platform helped me land my dream job at Google. The AI feedback was incredibly accurate!", avatar: "SJ" },
    { name: "Michael Chen", role: "Product Manager", text: "I've recommended this to all my colleagues. The mock interviews are better than real ones.", avatar: "MC" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
      <Navbar variant="marketing" />
      {/* Custom Animations CSS */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 15s infinite;
        }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>

      {/* Background Animated Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-20 -left-20 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute top-40 -right-20 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-20 left-1/3 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-32">
        <div className="max-w-6xl mx-auto text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold tracking-wide text-indigo-600 uppercase bg-indigo-50/80 backdrop-blur-sm rounded-full shadow-sm"
          >
            Revolutionize Your Interviews
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-slate-900 mb-6 leading-[1.2] tracking-tight"
          >
            Ace Your Next Interview with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 animate-gradient">
              AI-Powered Mastery
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            The ultimate platform for personalized interview preparation. Generate real-world questions,
            get expert insights, and build confidence with our state-of-the-art AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-5 justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/signup")}
              className="px-8 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-200 hover:shadow-2xl transition-all"
            >
              Start Your Journey â†’
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: "#f8fafc" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/login")}
              className="px-8 py-4 bg-white/80 backdrop-blur-sm text-slate-900 border border-slate-200 rounded-2xl font-bold text-lg hover:border-indigo-300 transition-all"
            >
              Login to Dashboard
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 1, duration: 1 }}
            className="mt-20 flex items-center justify-center gap-8 grayscale"
          >
            <span className="font-bold text-xl tracking-tighter text-slate-500">TECHSTAR</span>
            <span className="font-bold text-xl tracking-tighter text-slate-500">MODERN</span>
            <span className="font-bold text-xl tracking-tighter text-slate-500">FUTURE</span>
          </motion.div>
        </div>
      </section>

      {/* ========== FEATURES SECTION ========== */}
      <section className="relative py-24 px-4 bg-white/40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
              Powerful Features to <span className="text-indigo-600">Excel</span>
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Everything you need to transform your interview skills and land your dream job.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} {...feature} delay={idx * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ========== STATS SECTION ========== */}
      <section className="relative py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <CountUp end={10000} suffix="+" />
              <p className="text-slate-600 mt-2 font-medium">Interviews Simulated</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <CountUp end={95} suffix="%" />
              <p className="text-slate-600 mt-2 font-medium">Success Rate</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <CountUp end={50} suffix="+" />
              <p className="text-slate-600 mt-2 font-medium">Industries Covered</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== TESTIMONIALS SECTION ========== */}
      <section className="relative py-24 px-4 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
              Loved by <span className="text-purple-600">Professionals</span>
            </h2>
            <p className="text-slate-600">Join thousands who aced their interviews with our platform.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: idx === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.2 }}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{testimonial.name}</h4>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-slate-600 italic">"{testimonial.text}"</p>
                <div className="mt-4 flex text-yellow-400">â˜…â˜…â˜…â˜…â˜…</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA SECTION ========== */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-12 shadow-2xl border border-white/50"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
              Ready to <span className="text-indigo-600">Transform</span> Your Career?
            </h2>
            <p className="text-slate-600 mb-8 text-lg">
              Join thousands of successful candidates who prepared with us.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/signup")}
              className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Get Started Free â†’
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="relative border-t border-slate-200 py-12 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center text-slate-500 text-sm">
          <p>Â© 2025 InterviewMaster. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <a href="#" className="hover:text-indigo-600 transition">Privacy</a>
            <a href="#" className="hover:text-indigo-600 transition">Terms</a>
            <a href="#" className="hover:text-indigo-600 transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

` 


### File: frontend/src/pages/*.jsx/Login.jsx

`javascript

import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";
import Navbar from "../components/Navbar";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const emailInputRef = useRef(null);

  // Auto-focus email input on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  // Real-time email validation
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email is required";
    if (!re.test(email)) return "Invalid email format";
    return "";
  };

  // Password strength indicator
  const getPasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const handleForm = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Real-time validation
    if (name === "email") {
      setErrors({ ...errors, email: validateEmail(value) });
    } else if (name === "password") {
      setErrors({ ...errors, password: value ? "" : "Password is required" });
    }
  };

  const handleLogin = async () => {
    // Final validation
    const emailError = validateEmail(form.email);
    const passwordError = form.password ? "" : "Password is required";
    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(API_PATHS.AUTH.LOGIN, form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userName", res.data.name);
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", form.email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      // Animated error alert (custom toast-like)
      const errorMsg = error.response?.data?.message || "Invalid email or password";
      setErrors({ ...errors, form: errorMsg });
      setTimeout(() => setErrors({ ...errors, form: "" }), 4000);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) handleLogin();
  };

  // Background floating orbs animation
  const orbVariants = {
    animate: (i) => ({
      x: [0, 40, -30, 0],
      y: [0, -50, 30, 0],
      scale: [1, 1.3, 0.8, 1],
      transition: {
        duration: 18,
        repeat: Infinity,
        repeatType: "mirror",
        delay: i * 2.5,
      },
    }),
  };

  // Form field stagger variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 12 } },
  };

  const passwordStrength = getPasswordStrength(form.password);
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const strengthText = ["", "Weak", "Medium", "Strong", "Very Strong"];

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50 px-4 pt-24 pb-12 relative overflow-hidden font-sans"
      onKeyPress={handleKeyPress}
    >
      <Navbar variant="auth" />
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-1/4 -left-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-3/4 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/30 hover:shadow-indigo-100/50 transition-shadow duration-500">

          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-center text-slate-900 mb-2"
          >
            Welcome Back
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-slate-500 text-center mb-8"
          >
            Access your AI-powered interview prep
          </motion.p>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Email Field */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  ref={emailInputRef}
                  name="email"
                  type="email"
                  value={form.email}
                  placeholder="name@example.com"
                  onChange={handleForm}
                  className={`w-full bg-slate-50 border ${errors.email ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-indigo-200"
                    } rounded-2xl p-4 pr-10 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
                />
                {form.email && !errors.email && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                  >
                    âœ“
                  </motion.div>
                )}
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Password Field */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  onChange={handleForm}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-transparent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition"
                >
                  {showPassword ? "ðŸ‘ï¸" : "ðŸ‘ï¸â€ðŸ—¨ï¸"}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {form.password && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  className="mt-2"
                >
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 transition-all duration-300 ${i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-slate-200"
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {strengthText[passwordStrength]} password
                  </p>
                </motion.div>
              )}
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Remember Me & Forgot Password */}
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-between"
            >
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-all hover:underline"
              >
                Forgot password?
              </Link>
            </motion.div>
          </motion.div>

          {/* Global Form Error */}
          <AnimatePresence>
            {errors.form && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
              >
                {errors.form}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Button */}
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={handleLogin}
            disabled={loading || !!errors.email || !form.email || !form.password}
            className={`w-full py-4 rounded-2xl font-bold text-lg mt-6 transition-all duration-200 flex items-center justify-center gap-2 ${loading || errors.email || !form.email || !form.password
              ? "bg-slate-300 cursor-not-allowed text-slate-500"
              : "bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-200 hover:shadow-xl"
              }`}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Authenticating...
              </>
            ) : (
              "Login â†’"
            )}
          </motion.button>

          {/* Divider with animated line */}
          <div className="flex items-center my-8">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
            <p className="px-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
              secure login
            </p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-slate-600">
            New here?{" "}
            <Link
              to="/signup"
              className="text-indigo-600 font-bold hover:text-indigo-700 transition-all hover:underline"
            >
              Create Account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

` 


### File: frontend/src/pages/*.jsx/SignUp.jsx

`javascript

import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";
import Navbar from "../components/Navbar";

const SignUp = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: "",
    general: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const nameInputRef = useRef(null);

  // Auto-focus name field on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Real-time validators
  const validateName = (name) => {
    if (!name) return "Full name is required";
    if (name.trim().length < 2) return "Name must be at least 2 characters";
    if (!/^[a-zA-Z\s]+$/.test(name)) return "Name can only contain letters and spaces";
    return "";
  };

  const validateEmail = (email) => {
    if (!email) return "Email is required";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return "Invalid email format";
    return "";
  };

  const getPasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const validateConfirmPassword = (confirm, password) => {
    if (!confirm) return "Please confirm your password";
    if (confirm !== password) return "Passwords do not match";
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Real-time field validation
    let error = "";
    if (name === "name") error = validateName(value);
    if (name === "email") error = validateEmail(value);
    if (name === "password") {
      error = validatePassword(value);
      // Also revalidate confirm password if it exists
      if (form.confirmPassword) {
        const confirmError = validateConfirmPassword(form.confirmPassword, value);
        setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
      }
    }
    if (name === "confirmPassword") error = validateConfirmPassword(value, form.password);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSignup = async () => {
    // Final validation
    const nameError = validateName(form.name);
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);
    const confirmError = validateConfirmPassword(form.confirmPassword, form.password);
    const termsError = acceptTerms ? "" : "You must accept the Terms & Conditions";

    if (nameError || emailError || passwordError || confirmError || termsError) {
      setErrors({
        name: nameError,
        email: emailError,
        password: passwordError,
        confirmPassword: confirmError,
        terms: termsError,
        general: "",
      });
      return;
    }

    setLoading(true);
    try {
      await axios.post(API_PATHS.AUTH.SIGNUP, {
        name: form.name.trim(),
        email: form.email,
        password: form.password,
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userName", res.data.name);
      // Show success message
      alert("Account created successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || "Signup failed. Please try again.";
      setErrors((prev) => ({ ...prev, general: msg }));
      // Auto-clear general error after 4 seconds
      setTimeout(() => setErrors((prev) => ({ ...prev, general: "" })), 4000);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) handleSignup();
  };

  // Password strength
  const passwordStrength = getPasswordStrength(form.password);
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"];
  const strengthText = ["", "Weak", "Medium", "Strong", "Very Strong"];

  // Background floating orbs animation (matching login/landing)
  const orbVariants = {
    animate: (i) => ({
      x: [0, 40, -30, 0],
      y: [0, -50, 30, 0],
      scale: [1, 1.3, 0.8, 1],
      transition: {
        duration: 18,
        repeat: Infinity,
        repeatType: "mirror",
        delay: i * 2.5,
      },
    }),
  };

  // Stagger variants for form fields
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 12 } },
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50 px-4 pt-24 pb-12 relative overflow-hidden font-sans"
      onKeyPress={handleKeyPress}
    >
      <Navbar variant="auth" />
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-1/4 -left-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-3/4 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/30 hover:shadow-purple-100/50 transition-shadow duration-500">

          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-center text-slate-900 mb-2"
          >
            Create Account
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-slate-500 text-center mb-8"
          >
            Join the future of interview preparation
          </motion.p>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Full Name */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Full Name
              </label>
              <input
                ref={nameInputRef}
                name="name"
                type="text"
                value={form.name}
                placeholder="John Doe"
                onChange={handleChange}
                className={`w-full bg-slate-50 border ${errors.name ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-purple-200"
                  } rounded-2xl p-4 pr-10 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
              />
              <AnimatePresence>
                {errors.name && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.name}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Email */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  placeholder="name@example.com"
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border ${errors.email ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-purple-200"
                    } rounded-2xl p-4 pr-10 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
                />
                {form.email && !errors.email && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                  >
                    âœ“
                  </motion.div>
                )}
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  placeholder="Create a strong password"
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-transparent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition"
                >
                  {showPassword ? "ðŸ‘ï¸" : "ðŸ‘ï¸â€ðŸ—¨ï¸"}
                </button>
              </div>
              {/* Password Strength Indicator */}
              {form.password && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  className="mt-2"
                >
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 transition-all duration-300 ${i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-slate-200"
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {strengthText[passwordStrength]} password
                  </p>
                </motion.div>
              )}
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Confirm Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  placeholder="Confirm your password"
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border ${errors.confirmPassword ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-purple-200"
                    } rounded-2xl p-4 pr-12 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition"
                >
                  {showConfirmPassword ? "ðŸ‘ï¸" : "ðŸ‘ï¸â€ðŸ—¨ï¸"}
                </button>
              </div>
              <AnimatePresence>
                {errors.confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.confirmPassword}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Terms & Conditions */}
            <motion.div variants={itemVariants} className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (e.target.checked) setErrors((prev) => ({ ...prev, terms: "" }));
                  else setErrors((prev) => ({ ...prev, terms: "You must accept the Terms & Conditions" }));
                }}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="terms" className="text-sm text-slate-600">
                I accept the{" "}
                <a href="/terms" className="text-purple-600 hover:underline font-medium">
                  Terms & Conditions
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-purple-600 hover:underline font-medium">
                  Privacy Policy
                </a>
              </label>
            </motion.div>
            <AnimatePresence>
              {errors.terms && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-500 text-xs -mt-2 ml-6"
                >
                  {errors.terms}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* General Error Alert */}
          <AnimatePresence>
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
              >
                {errors.general}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Signup Button */}
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={handleSignup}
            disabled={
              loading ||
              !!errors.name ||
              !!errors.email ||
              !!errors.password ||
              !!errors.confirmPassword ||
              !form.name ||
              !form.email ||
              !form.password ||
              !form.confirmPassword ||
              !acceptTerms
            }
            className={`w-full py-4 rounded-2xl font-bold text-lg mt-6 transition-all duration-200 flex items-center justify-center gap-2 ${loading ||
              errors.name ||
              errors.email ||
              errors.password ||
              errors.confirmPassword ||
              !form.name ||
              !form.email ||
              !form.password ||
              !form.confirmPassword ||
              !acceptTerms
              ? "bg-slate-300 cursor-not-allowed text-slate-500"
              : "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-200 hover:shadow-xl"
              }`}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating Account...
              </>
            ) : (
              "Join Now â†’"
            )}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center my-8">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
            <p className="px-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
              quick setup
            </p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
          </div>

          {/* Login Link */}
          <p className="text-center text-slate-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-purple-600 font-bold hover:text-purple-700 transition-all hover:underline"
            >
              Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignUp;

` 


## [frontend/src/components/*.jsx]

### File: frontend/src/components/*.jsx/EmptyState.jsx

`javascript

import { FiPlus, FiCpu, FiMessageSquare } from "react-icons/fi";
import { motion } from "framer-motion";

const EmptyState = ({ onGenerate, generating }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center shadow-inner"
    >
      <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
        <FiCpu className="w-12 h-12 text-indigo-500" />
        <div className="absolute top-0 right-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-4 border-white">
          AI
        </div>
      </div>
      
      <h3 className="text-2xl font-bold text-slate-800 mb-3">No Questions Generated Yet</h3>
      <p className="text-slate-500 text-lg max-w-sm mx-auto mb-10 leading-relaxed font-medium">
        Ready to sharpen your skills? Let our advanced AI curate a list of personalized interview questions for you.
      </p>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-3 px-10 py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xl shadow-2xl shadow-indigo-200 transition-all active:scale-95"
        >
          {generating ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><FiPlus /> Generate Questions</>}
        </button>
        
        <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
          <FiMessageSquare className="w-4 h-4" />
          <span>Usually takes about 10-15 seconds</span>
        </div>
      </div>
    </motion.div>
  );
};

export default EmptyState;

` 


### File: frontend/src/components/*.jsx/ErrorBanner.jsx

`javascript

import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import { motion } from "framer-motion";

const ErrorBanner = ({ message, onRetry }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border border-red-100 rounded-3xl p-8 flex flex-col items-center text-center shadow-lg shadow-red-100/20"
    >
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <FiAlertCircle className="w-8 h-8 text-red-600" />
      </div>

      <h3 className="text-xl font-bold text-red-900 mb-2">Something went wrong</h3>
      <p className="text-red-700 font-medium max-w-sm mb-8 leading-relaxed">
        {message || "We encountered an error while fetching your questions. Please try again."}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-red-200 transition-all active:scale-95"
        >
          <FiRefreshCw className="w-5 h-5" /> Retry Request
        </button>
      )}
    </motion.div>
  );
};

export default ErrorBanner;

` 


### File: frontend/src/components/*.jsx/GenerateButton.jsx

`javascript

import { FiZap, FiLoader } from "react-icons/fi";
import { motion } from "framer-motion";

const GenerateButton = ({ onClick, generating, loading }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    disabled={generating || loading}
    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold transition-all shadow-xl shadow-indigo-100 hover:shadow-indigo-200"
  >
    {generating ? (
      <>
        <FiLoader className="animate-spin w-5 h-5" /> Generating Insights...
      </>
    ) : (
      <>
        <FiZap className="w-5 h-5 fill-current" /> Generate New Questions
      </>
    )}
  </motion.button>
);

export default GenerateButton;

` 


### File: frontend/src/components/*.jsx/Navbar.jsx

`javascript

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMenu,
  FiX,
  FiArrowRight,
  FiLogOut,
  FiUser,
  FiChevronRight,
  FiHome,
  FiZap
} from "react-icons/fi";

const Navbar = ({ variant = "marketing", onMenuToggle, leftAction, rightAction, userName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Scroll detection for glassmorphism intensify
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const navLinks = {
    marketing: [
      { name: "Features", href: "#features" },
      { name: "How it Works", href: "#how-it-works" },
      { name: "Pricing", href: "#pricing" },
    ],
    app: [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Analytics", href: "/analytics" },
    ],
    auth: [
      { name: "Back to Home", href: "/", icon: <FiHome className="w-4 h-4" /> },
    ]
  };

  const currentLinks = navLinks[variant] || [];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
        ? "py-3 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg"
        : "py-5 bg-transparent"
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Left Side: Logo or custom leftAction */}
        <div className="flex items-center gap-4">
          {leftAction ? (
            leftAction
          ) : (
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform">
                Q
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent hidden sm:inline">
                Interview.ai
              </span>
            </Link>
          )}
        </div>

        {/* Desktop Links - Marketing */}
        {variant === "marketing" && (
          <div className="hidden md:flex items-center gap-8">
            {currentLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-slate-600 font-semibold hover:text-indigo-600 transition-colors"
              >
                {link.name}
              </a>
            ))}
            <div className="h-6 w-px bg-slate-200 mx-2" />
            <Link
              to="/login"
              className="text-slate-900 font-bold hover:text-indigo-600 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2 group"
            >
              Get Started <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}

        {/* Desktop Links - Auth */}
        {variant === "auth" && (
          <div className="hidden md:flex items-center gap-6">
            {location.pathname === "/login" ? (
              <div className="flex items-center gap-4">
                <span className="text-slate-500 font-medium">New to QInterview.ai?</span>
                <Link
                  to="/signup"
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Create Account
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-slate-500 font-medium">Already have an account?</span>
                <Link
                  to="/login"
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Log In
                </Link>
              </div>
            )}
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-all"
            >
              <FiHome /> Home
            </Link>
          </div>
        )}

        {/* Desktop Links - App */}
        {variant === "app" && (
          <div className="hidden md:flex items-center gap-6">
            {rightAction ? (
              rightAction
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-black">
                    P
                  </div>
                  <div>
                    <p className="text-xs font-black text-indigo-700 uppercase leading-none">Pro Plan</p>
                    <p className="text-[10px] text-indigo-500 font-bold">Session Active</p>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 line-clamp-1 max-w-[120px]">{userName || "User"}</p>
                    <button
                      onClick={handleLogout}
                      className="text-[10px] font-black text-red-500 uppercase tracking-wider hover:underline"
                    >
                      Sign Out
                    </button>
                  </div>
                  <div className="w-10 h-10 bg-indigo-100 border-2 border-white rounded-full flex items-center justify-center text-indigo-600 shadow-inner overflow-hidden font-bold">
                    {userName ? userName[0].toUpperCase() : <FiUser className="w-6 h-6 text-slate-400" />}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Mobile Toggle */}
        <div className="flex items-center gap-4 md:hidden">
          {variant === "app" && (
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
              <FiZap className="w-4 h-4" />
            </div>
          )}
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              if (onMenuToggle) onMenuToggle(!isOpen);
            }}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            {isOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-b border-white/20 overflow-hidden"
          >
            <div className="px-6 py-8 space-y-6">
              {currentLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="flex items-center justify-between text-xl font-bold text-slate-900"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                  <FiChevronRight className="text-slate-400" />
                </a>
              ))}

              {variant === "marketing" && (
                <div className="pt-6 space-y-4">
                  <Link
                    to="/login"
                    className="block w-full py-4 text-center text-xl font-bold text-slate-900 bg-slate-100 rounded-2xl"
                    onClick={() => setIsOpen(false)}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="block w-full py-4 text-center text-xl font-bold text-white bg-slate-900 rounded-2xl shadow-xl shadow-slate-200"
                    onClick={() => setIsOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              )}

              {variant === "app" && (
                <div className="pt-6 space-y-4 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
                      {userName ? userName[0].toUpperCase() : <FiUser className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{userName || "User"}</p>
                      <p className="text-sm text-slate-500 uppercase font-black text-[10px] tracking-widest text-indigo-500">Premium Member</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full py-4 text-center text-xl font-bold text-red-600 bg-red-50 rounded-2xl"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;

` 


### File: frontend/src/components/*.jsx/QAItems.jsx

`javascript

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiStar, FiBookmark, FiInfo, FiZap } from "react-icons/fi";

const QAItem = ({ item, onPin }) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative group transition-all duration-500 rounded-[2rem] ${
        open 
          ? "bg-white shadow-[0_20px_50px_rgba(79,70,229,0.1)] border-indigo-100" 
          : "bg-white/60 backdrop-blur-md border-white/40 hover:bg-white shadow-sm hover:shadow-xl hover:shadow-indigo-50"
      } border overflow-hidden mb-6`}
    >
      {/* Active Indicator Line */}
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: "100%" }}
            exit={{ height: 0 }}
            className="absolute left-0 top-0 w-1.5 bg-gradient-to-b from-indigo-600 to-purple-600 z-10"
          />
        )}
      </AnimatePresence>

      <div 
        className="p-7 cursor-pointer flex items-start gap-5 relative z-10"
        onClick={() => setOpen(!open)}
      >
        <div className={`mt-0.5 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-500 ${
          open ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 rotate-6" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"
        }`}>
          Q
        </div>
        
        <div className="flex-1">
          <h3 className={`font-bold text-xl leading-snug transition-colors duration-300 ${
            open ? "text-slate-900" : "text-slate-700 group-hover:text-indigo-600"
          }`}>
            {item.question}
          </h3>
          {!open && (
            <div className="flex items-center gap-4 mt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <FiZap className="text-amber-400" /> AI Generated
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Click to reveal answer
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onPin?.(item._id); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              item.isPinned 
                ? "bg-amber-100 text-amber-600 shadow-inner" 
                : "text-slate-300 hover:bg-slate-50 hover:text-amber-500"
            }`}
          >
            <FiStar className={`w-5 h-5 ${item.isPinned ? "fill-amber-500" : ""}`} />
          </button>
          
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
            open ? "bg-slate-900 text-white rotate-180" : "bg-slate-50 text-slate-400 group-hover:bg-slate-200"
          }`}>
            <FiChevronDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
            className="border-t border-slate-50 overflow-hidden"
          >
            <div className="p-8 pt-4 bg-slate-50/30">
              <div className="max-w-none prose prose-indigo">
                <div className="flex items-center gap-2 mb-6">
                   <div className="h-[1px] flex-1 bg-slate-200"></div>
                   <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2 shadow-sm">
                     <FiBookmark /> expert analysis
                   </div>
                   <div className="h-[1px] flex-1 bg-slate-200"></div>
                </div>

                <div className="text-slate-700 leading-relaxed text-lg font-medium markdown-wrapper">
                  <ReactMarkdown>
                    {item.answer}
                  </ReactMarkdown>
                </div>
                
                {item.note && (
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 flex gap-4 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 shadow-sm"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      <FiInfo className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">pro-tip insight</p>
                      <p className="text-amber-900 text-sm font-semibold leading-relaxed">{item.note}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default QAItem;

` 


### File: frontend/src/components/*.jsx/SkeletonCard.jsx

`javascript

import { motion } from "framer-motion";

/**
 * SkeletonCard component with multiple variants
 * @param {string} variant - "qa", "session", "stat", "full"
 * @param {boolean} animated - Enable entrance animation
 */
const SkeletonCard = ({ variant = "qa", animated = true }) => {
  const baseClasses =
    "bg-white/60 backdrop-blur-sm border border-white/30 rounded-3xl overflow-hidden relative";

  const shimmerEffect = (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: "200%" }}
      transition={{
        duration: 1.8,
        repeat: Infinity,
        ease: "cubic-bezier(0.4, 0, 0.2, 1)",
        repeatDelay: 0.5,
      }}
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none will-change-transform"
    />
  );

  const entranceAnimation = animated
    ? {
      initial: { opacity: 0, scale: 0.96 },
      animate: { opacity: 1, scale: 1 },
      transition: { type: "spring", damping: 20, stiffness: 300 },
    }
    : {};

  // QA Card Skeleton (used in InterviewPrep)
  if (variant === "qa") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-6 md:p-8 shadow-sm`}
        role="status"
        aria-label="Loading question card"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-5 w-32 bg-slate-200 rounded-full animate-pulse" />
          </div>
          <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
        </div>

        <div className="space-y-3 mb-6">
          <div className="h-5 w-3/4 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded-full animate-pulse" />
          <div className="h-4 w-5/6 bg-slate-100 rounded-full animate-pulse" />
          <div className="h-4 w-2/3 bg-slate-100 rounded-full animate-pulse" />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          <div className="h-9 w-20 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-9 w-9 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-9 w-9 bg-slate-200 rounded-xl animate-pulse ml-auto" />
        </div>
        {shimmerEffect}
      </motion.div>
    );
  }

  // Session Card Skeleton (used in Dashboard)
  if (variant === "session") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-6 cursor-pointer shadow-sm`}
        role="status"
        aria-label="Loading session card"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse" />
          <div className="w-16 h-6 bg-slate-200 rounded-full animate-pulse" />
        </div>
        <div className="h-6 w-3/4 bg-slate-200 rounded-full animate-pulse mb-2" />
        <div className="h-4 w-1/2 bg-slate-200 rounded-full animate-pulse mb-4" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-slate-200 rounded-full animate-pulse" />
            <div className="h-3 w-12 bg-slate-200 rounded-full animate-pulse" />
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-gradient-to-r from-indigo-200 to-purple-200 rounded-full animate-pulse" />
          </div>
        </div>
        {shimmerEffect}
      </motion.div>
    );
  }

  // Stat Card Skeleton (used in Dashboard stats)
  if (variant === "stat") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-6 shadow-sm`}
        role="status"
        aria-label="Loading statistic card"
      >
        <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse mb-4" />
        <div className="h-8 w-20 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-24 bg-slate-200 rounded-full animate-pulse" />
        {shimmerEffect}
      </motion.div>
    );
  }

  // Full Page / Hero Skeleton (for loading entire sections)
  if (variant === "full") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-8 shadow-sm min-h-[400px] flex flex-col items-center justify-center`}
        role="status"
        aria-label="Loading content"
      >
        <div className="w-20 h-20 bg-slate-200 rounded-full animate-pulse mb-6" />
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-64 bg-slate-200 rounded-full animate-pulse mb-2" />
        <div className="h-4 w-56 bg-slate-200 rounded-full animate-pulse" />
        <div className="mt-8 flex gap-3">
          <div className="h-12 w-32 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-12 w-32 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        {shimmerEffect}
      </motion.div>
    );
  }

  // Default fallback (same as QA)
  return (
    <motion.div
      {...entranceAnimation}
      className={`${baseClasses} p-6`}
      role="status"
      aria-label="Loading"
    >
      <div className="h-6 w-3/4 bg-slate-200 rounded-full animate-pulse mb-4" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-100 rounded-full animate-pulse" />
        <div className="h-4 w-5/6 bg-slate-100 rounded-full animate-pulse" />
      </div>
      {shimmerEffect}
    </motion.div>
  );
};

export default SkeletonCard;

` 


## [Core Files]

### File: backend/index.js

`javascript

import express from "express"; 
import cors from "cors"; 
import dotenv from "dotenv";
import { connectDB } from "./config/database-config.js";
import authRoutes from "./routes/auth-route.js";
import sessionRoutes from "./routes/session-route.js";
import aiRoutes from "./routes/ai-route.js";

// Load environment variables
dotenv.config();

// Initialize app
const app = express();

// Middleware
app.use(cors({
    origin: "http://localhost:5173",
}));
app.use(express.urlencoded({extended: true})); 
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes); 
app.use("/api/sessions", sessionRoutes);
app.use("/api/ai", aiRoutes);

// Root Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "QSpider API is active",
  });
});

// Port
const PORT = process.env.PORT || 5000;

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect to DB (Non-blocking)
connectDB().catch(err => {
  console.error("Database connection failed:", err.message);
});

` 


## [Core Files]

### File: frontend/src/utils/apiPaths.js

`javascript

const VITE_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const BASE_URL = `${VITE_BASE}/api`;

export const API_PATHS = {
  AUTH: {
    LOGIN: `${BASE_URL}/auth/login`,
    SIGNUP: `${BASE_URL}/auth/signup`,
  },
  SESSION: {
    CREATE: `${BASE_URL}/sessions/create`,
    GET_ALL: `${BASE_URL}/sessions/my-sessions`,
    GET_ONE: `${BASE_URL}/sessions`, // usage: GET_ONE/:id
  },
  AI: {
    GENERATE_QUESTIONS: `${BASE_URL}/ai/generate-questions`,
    EXPLAIN: `${BASE_URL}/ai/generate-explanation`,
  },
};

` 


## [Core Files]

### File: frontend/src/utils/axiosInstance.js

`javascript

// utils/axiosInstance.js
import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
});

// âœ… This interceptor runs before every request and attaches the token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // or wherever you store it
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export default axiosInstance;

` 


