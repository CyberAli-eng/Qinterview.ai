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
