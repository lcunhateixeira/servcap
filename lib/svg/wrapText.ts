type WrapOptions = {
  maxCharsPerLine: number;
  lineHeight: number; // em px
  x: number;
  y: number;
  fontWeight?: string;
};

export function wrapSvgText(
  text: string,
  {
    maxCharsPerLine,
    lineHeight,
    x,
    y,
    fontWeight,
  }: WrapOptions
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (testLine.length > maxCharsPerLine) {
      lines.push(current);
      current = word;
    } else {
      current = testLine;
    }
  }

  if (current) lines.push(current);

  return lines
    .map(
      (line, i) => `
<tspan x="${x}" y="${y + i * lineHeight}" ${
        fontWeight ? `font-weight="${fontWeight}"` : ""
      }>${escapeXml(line)}</tspan>`
    )
    .join("");
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
