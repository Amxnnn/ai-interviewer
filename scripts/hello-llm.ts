// Phase 0 smoke test: proves the key, the model and our adapter work end to end.
// Run: npm run hello
import { generateText } from "@/lib/llm";

async function main() {
  const result = await generateText({
    tag: "hello@v1",
    system: "You are a friendly technical interviewer. Reply in one sentence.",
    messages: [{ role: "user", content: "Hi! Please introduce yourself." }],
  });
  console.log(`\n${result.model} says: ${result.text}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
