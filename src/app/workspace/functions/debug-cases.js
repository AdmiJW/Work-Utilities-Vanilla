export function debugCases() {
  const example = (toolId, title, description, source, extra = {}) => ({
    toolId,
    title,
    description,
    source,
    fileBaseName: title,
    ...extra,
  });
  return [
    ...(globalThis.__WORK_UTILITIES_EXAMPLES__ ?? []),
    example(
      'sql-formatter',
      'Screenshots and shared filename',
      'Two synthetic SSMS images. Preview, reorder, resize the panel, and export the UT workbook.',
      "SELECT 'Synthetic UAT evidence' AS Environment;\nSELECT 2 AS Result;",
      { fileBaseName: 'PT-C-DER000001-01', screenshots: true, options: { unitTestOpen: true } },
    ),
    example(
      'sql-formatter',
      'Selection endpoints and one-line gaps',
      'Select forward/backward, wrap long lines, and compact into statements separated by blank lines.',
      "SELECT 'First line: select from here' AS FirstValue;\nSELECT 'A long middle value; punctuation stays literal and comments stay inside quotes' AS MiddleValue;\nSELECT 'Last line: select up to here' AS LastValue;",
    ),
    example(
      'output-analyzer',
      'Ordinary SELECT and wildcard fallback',
      'Named aliases, nested commas, generic headers, empty results, and rows with different widths.',
      "SQL Statement Run: --000001SELECT Id, COALESCE(Name, 'Unknown') AS DisplayName FROM dbo.Customers;\n0001|Ada\n0002|Lin\n\nSQL Statement Run: --000001SELECT * FROM dbo.Customers;\n0001|Ada\n0002|Lin|EXTRA\n0003\n\nSQL Statement Run: --000001SELECT * FROM (SELECT * FROM dbo.Customers) AS c;\n0 rows affected",
    ),
    example(
      'output-analyzer',
      'Literal search and duplicate sheet names',
      'Search for box | fragile inside JSON, rename repeated table tabs, and verify full Excel export.',
      'SQL Statement Run: --000001SELECT Id, Message, Payload FROM dbo.Events;\n001|Packed item|{"note":"box | fragile"}\n002|Other message|{"note":"ordinary"}\n\nSQL Statement Run: --000001SELECT Id FROM dbo.Events;\n003\n\nSQL Statement Run: --000001SELECT 1 AS Value;\n1',
    ),
    example(
      'output-analyzer',
      'JSON messages and short-screen inspection',
      'Inspect ordinary text, malformed JSON, nested JSON, and long values in both modes. Resize the viewport.',
      `SQL Statement Run: --000001SELECT Id, VeryLongColumnNameForTestingInspectorWrappingAndScrolling, Payload FROM dbo.Inspection;\n001|Ordinary text is not JSON|${JSON.stringify({ nested: JSON.stringify({ value: 'box | fragile', items: Array.from({ length: 60 }, (_, id) => ({ id, text: 'A long value for scrolling and inspection' })) }) })}\n002|Plain text|{invalid JSON}\n003|Valid scalar|true`,
    ),
  ];
}

export async function debugScreenshots() {
  const images = [];
  for (let index = 1; index <= 2; index++) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = index === 1 ? 320 : 240;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#17243a';
    context.font = '20px monospace';
    context.fillText(`Synthetic SSMS evidence ${index} · UAT`, 24, 42);
    context.font = '16px monospace';
    context.fillText(`SELECT ${index} AS Result;`, 24, 95);
    context.fillText('Result', 24, 155);
    context.fillText(String(index), 24, 190);
    context.fillText('Fictional data for testing only', 24, canvas.height - 25);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Synthetic screenshots could not be created.');
    images.push({
      name: `Synthetic UAT ${index}.png`,
      width: canvas.width,
      height: canvas.height,
      type: 'image/png',
      blob,
    });
  }
  return images;
}
