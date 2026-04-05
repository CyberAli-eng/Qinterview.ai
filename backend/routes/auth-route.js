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
