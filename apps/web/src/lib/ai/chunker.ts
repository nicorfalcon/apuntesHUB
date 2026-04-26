export interface TextChunk {
  content: string;
  chunkIndex: number;
}

export function chunkText(
  text: string,
  chunkSize: number = 700,
  overlap: number = 120
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const content = text.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({ content, chunkIndex: index });
      index++;
    }

    start += chunkSize - overlap;
  }

  return chunks;
}