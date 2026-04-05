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
    origin: process.env.CLIENT_URL || "*", // Allow all for initial launch, or specific Vercel URL
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
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
