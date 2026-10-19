import { aiErrorResponse, errorResponse } from "@/lib/http";
import { extractPdfText, isPdf } from "@/lib/resume/extract-text";
import { parseResume } from "@/lib/resume/parse";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MIN_TEXT_CHARS = 200;

// A route handler is the HTTP boundary. Its job: validate everything coming in,
// call the domain logic, and translate failures into honest status codes
// without leaking internal details to the client.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("resume");

  if (!(file instanceof File)) return errorResponse(400, "Attach a PDF in the 'resume' field.");
  if (file.size > MAX_FILE_BYTES) return errorResponse(413, "That file is larger than 5 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return errorResponse(415, "Only PDF files are supported.");

  let text: string;
  try {
    ({ text } = await extractPdfText(bytes));
  } catch {
    return errorResponse(422, "Couldn't read that PDF. Is it corrupted or password-protected?");
  }
  if (text.length < MIN_TEXT_CHARS) {
    // Image-only PDFs have no text layer. Supporting them needs OCR or a
    // multimodal model reading the page images: a later upgrade.
    return errorResponse(422, "Couldn't find enough text. Scanned PDFs aren't supported yet.");
  }

  try {
    const result = await parseResume(text);
    if (!result.resume.isResume) return errorResponse(422, "That doesn't look like a resume.");
    return Response.json(result);
  } catch (err) {
    console.error("[resume] parsing failed:", err);
    return aiErrorResponse(err);
  }
}
