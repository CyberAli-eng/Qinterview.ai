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
