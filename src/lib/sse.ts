/**
 * Minimal SSE parser over a fetch Response's body stream. Yields one parsed
 * event per `\n\n` boundary. Tolerant of malformed `data:` lines (drops them
 * silently rather than throwing through the whole stream).
 */
export async function* parseSseStream(
  response: Response,
): AsyncGenerator<{ type: string; data: Record<string, unknown> }, void, void> {
  if (!response.body) return;
  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let eventType = "message";
        const dataParts: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) eventType = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataParts.push(line.slice(6));
        }
        const data = dataParts.join("\n");
        if (data) {
          try {
            yield { type: eventType, data: JSON.parse(data) };
          } catch {
            /* malformed line — ignore */
          }
        }
        sep = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
