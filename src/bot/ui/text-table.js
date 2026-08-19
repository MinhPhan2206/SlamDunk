function singleLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value, width) {
  const text = singleLine(value);
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`;
}

function pad(value, width, align = "left") {
  const text = truncate(value, width);
  return align === "right" ? text.padStart(width) : text.padEnd(width);
}

export function createTextTable(columns, rows) {
  const border = `+${columns.map(({ width }) =>
    "-".repeat(width + 2)
  ).join("+")}+`;
  const renderRow = (values, header = false) =>
    `| ${columns.map((column, index) =>
      pad(values[index], column.width, header ? "left" : column.align)
    ).join(" | ")} |`;
  return [
    border,
    renderRow(columns.map(({ label }) => label), true),
    border,
    ...rows.map((row) => renderRow(row)),
    border,
  ].join("\n");
}

export function codeTable(columns, rows) {
  return `\`\`\`\n${createTextTable(columns, rows)}\n\`\`\``;
}

export function createCompactTextTable(columns, rows) {
  const renderRow = (values, header = false) => columns
    .map((column, index) =>
      pad(values[index], column.width, header ? "left" : column.align)
    )
    .join(" ");
  return [
    renderRow(columns.map(({ label }) => label), true),
    columns.map(({ width }) => "-".repeat(width)).join(" "),
    ...rows.map((row) => renderRow(row)),
  ].join("\n");
}

export function compactCodeTable(columns, rows) {
  return `\`\`\`\n${createCompactTextTable(columns, rows)}\n\`\`\``;
}
