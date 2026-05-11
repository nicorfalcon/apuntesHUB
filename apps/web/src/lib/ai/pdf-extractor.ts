import { extractText } from "unpdf";

export async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(pdfBuffer), {
    mergePages: true,
  });
  return text;
}