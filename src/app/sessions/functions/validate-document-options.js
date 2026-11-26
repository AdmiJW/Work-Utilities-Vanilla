import { resultRowColors } from '../../shared/result-row-colors.js';

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const positiveIndex = /^[1-9]\d*$/;

/** Validate newly introduced options before a backup can replace the live workspace. */
export function validateDocumentOptions(document, invalid) {
  const options = document.options;
  if (options.mode !== undefined && !['live', 'source', 'reading'].includes(options.mode))
    invalid();
  if (options.wide !== undefined && typeof options.wide !== 'boolean') invalid();
  for (const key of ['lineNumbers', 'toc', 'toolbarHidden'])
    if (options[key] !== undefined && typeof options[key] !== 'boolean') invalid();
  if (options.rightText !== undefined && typeof options.rightText !== 'string') invalid();
  if (
    options.indentWidth !== undefined &&
    (!Number.isInteger(options.indentWidth) || options.indentWidth < 1 || options.indentWidth > 8)
  )
    invalid();
  for (const key of ['sheetNames', 'tableSearches']) {
    if (options[key] === undefined) continue;
    if (
      !record(options[key]) ||
      Object.values(options[key]).some(
        (value) =>
          typeof value !== 'string' ||
          (key === 'sheetNames' && (!value.trim() || value.length > 200)),
      )
    )
      invalid();
  }
  if (
    options.rowHighlights !== undefined &&
    (!record(options.rowHighlights) ||
      Object.entries(options.rowHighlights).some(
        ([statement, rows]) =>
          !positiveIndex.test(statement) ||
          !record(rows) ||
          Object.entries(rows).some(
            ([line, color]) =>
              !positiveIndex.test(line) ||
              typeof color !== 'string' ||
              !Object.hasOwn(resultRowColors, color),
          ),
      ))
  )
    invalid();
  if (options.unitTestOpen !== undefined && typeof options.unitTestOpen !== 'boolean') invalid();
  if (
    options.unitTestWidth !== undefined &&
    (!Number.isFinite(options.unitTestWidth) ||
      options.unitTestWidth < 280 ||
      options.unitTestWidth > 720)
  )
    invalid();
}
