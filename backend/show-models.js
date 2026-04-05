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
