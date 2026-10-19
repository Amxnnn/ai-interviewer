// Model IDs get retired regularly (gemini-2.5-flash shut down in Oct 2026).
// This lists the text models your key can use right now.
// Run: npm run models
import { GoogleGenAI } from "@google/genai";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key.");

  const client = new GoogleGenAI({ apiKey });
  for await (const model of await client.models.list()) {
    if (model.supportedActions?.includes("generateContent")) {
      console.log(model.name?.replace("models/", ""));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
