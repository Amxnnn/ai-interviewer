// Runs the resume pipeline without the UI:
//   npm run parse -- samples/resume-basic.pdf          (full pipeline)
//   npm run parse -- samples/resume-basic.pdf --text   (PDF extraction only, no API call)
// Testing the AI layer on its own is much faster than clicking through a
// browser, and it's the seed of the eval suite we'll build in Phase 5.
import { readFile } from "node:fs/promises";
import { extractPdfText } from "@/lib/resume/extract-text";
import { parseResume } from "@/lib/resume/parse";

async function main() {
  const path = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!path) throw new Error("Usage: npm run parse -- <file.pdf> [--text]");

  const { text, pages } = await extractPdfText(new Uint8Array(await readFile(path)));
  console.log(`Extracted ${text.length} characters from ${pages} page(s).\n`);

  if (process.argv.includes("--text")) {
    console.log(text);
    return;
  }

  const { resume } = await parseResume(text);
  console.log(JSON.stringify(resume, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
