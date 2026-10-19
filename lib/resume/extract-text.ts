import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

/** Every real PDF starts with these bytes. Unlike a filename or MIME type, they can't be faked by renaming. */
export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}

/**
 * PDF -> plain text. We extract the text ourselves instead of sending the PDF
 * to Gemini so the pipeline stays provider-agnostic and we can store, inspect
 * and cap the exact text the model sees.
 * Trade-off: scanned (image-only) PDFs have no text layer and come back empty.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text: normalizeWhitespace(text), pages: totalPages };
}

// Cleaner input means fewer tokens (lower cost) and less noise for the model.
function normalizeWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
