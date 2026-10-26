# SQL execution output TXT — inferred format specification

## Scope

This document describes the **observed text-output format**, not an official SQL Server specification. It is derived from the example screenshots. The fictional sample files use unrelated schemas and data.

## 1. Overall structure

One TXT file can contain multiple SQL statement blocks, in execution/output order:

```text
SQL Statement Run: --<run-marker>SELECT CONCAT(...) FROM <table> ...
<result row 1, if returned>
<result row 2, if returned>
...

SQL Statement Run: --<run-marker>SELECT CONCAT(...) FROM <table> ...
0 rows affected

SQL Statement Run: --<run-marker>SELECT CONCAT(...) FROM <table> ...
<result row 1, if returned>
```

- `SQL Statement Run: ` is the **literal statement-block prefix**.
- `--<run-marker>` is a numeric-looking marker directly attached to `SELECT` in the observed output: e.g., `SQL Statement Run: --820174SELECT ...` (the number is illustrative).
- Treat `--<run-marker>` as **log metadata**, not part of an executable SQL statement. If copied into a SQL editor, `--` has SQL comment semantics.
- A file can contain several blocks, with the **same or different run markers**. A blank line between blocks is a useful, optional visual separator; the next `SQL Statement Run:` prefix is the reliable boundary.
- The query is printed as text after the prefix. Long on-screen lines may **visually wrap**; this does not imply actual newline characters in the TXT file.

## 2. SQL statement layout

The captured queries predominantly have this pattern:

```sql
SELECT CONCAT(
    TableA.Column1, '|',
    TableA.Column2, '|',
    TableA.Column3
)
FROM TableA WITH (NOLOCK)
WHERE ...
```

In the output TXT the SQL is typically flattened onto one physical line following `SQL Statement Run: --<run-marker>`. Table names, column names, `WHERE` filters, and `WITH (NOLOCK)` are **query-specific**, not universal requirements. The pipe delimiters are SQL string literals (`'|'`), not separators added by the TXT exporter afterward.

## 3. Result representation

| Case | Observed / illustrated representation |
| --- | --- |
| **0 rows** | The line `0 rows affected` immediately follows the SQL line. There are no data rows. |
| **1 row** | One data line immediately follows the SQL line. No additional `1 rows affected` line is needed. |
| **2+ rows** | Each returned database row is emitted as its own text line, in the order returned by the query. No table header. |
| **Several SQLs** | Repeat `SQL Statement Run: ...` and the associated result lines in order. |

**Result row:** `value1|value2|value3|...`

- The order of values follows the order of expressions inside `CONCAT(...)`, **not the physical table schema order**.
- There are no column labels in result rows; recover them by reading the SELECT/CONCAT list.
- SQL Server `CONCAT` treats NULL arguments as empty strings. Therefore, missing values produce adjacent delimiters, e.g. `CUS-1002|river@example.test||ACTIVE`. Empty text and NULL are **not distinguishable** from this raw line alone.
- Preserve leading/trailing delimiters and adjacent `||` verbatim. The number of fields is determined by the `CONCAT(...)` expression.
- Numeric and datetime values are string representations from the database/query. Some captured timestamps used `YYYY-MM-DD HH:mm:ss.fffffff +08:00`; an offset may be absent depending on source type/conversion.
- `0 rows affected` is **literal log text visible in the samples**; do not infer a general SQL Server response contract from its wording.

## 4. JSON as a column value

A JSON-bearing column is inserted **inline as plain text in one pipe-delimited result row**, not expanded into subrows or pretty-printed. For example:

```text
MSG-9001|shipment.created|{"TraceId":"trace-7d91"}|{"ShipmentId":"SHP-2001","Fragile":false}|0
```

Rules to preserve:

1. The JSON object's `{}`, brackets `[]`, double quotes, commas, colons, `null`, booleans, etc., are printed as characters in the column value.
2. JSON-in-JSON: if an outer JSON object contains a **string holding serialized JSON**, the inner double quotes are escaped (`\"` in the actual TXT), e.g. `{"UserContext":"{\"Origin\":\"demo-portal\"}"}`. This is normal JSON string escaping; it is **not** SQL quoting.
3. Other escape sequences, such as `\\` for a literal backslash or `\n` inside JSON strings, should be preserved as they appear in the source value.
4. The event's metadata JSON and payload JSON may occupy **different pipe-delimited fields**, e.g., `...|<headers-JSON>|<payload-JSON>|...`.
5. The pipe `|` inside JSON text is **not automatically escaped by `CONCAT`**. A naive `.split('|')` can therefore break when a field value contains `|`; use knowledge of field types or a real serialization protocol for robust parsing.
6. Each entire output row remains a **single physical line** in the example TXT, even if the editor wraps it on screen.

## 5. Recommended parsing approach

1. Locate a line starting with the exact prefix `SQL Statement Run: `; treat it as a new statement block.
2. Keep the complete SQL text, marker, and expressions used in `CONCAT(...)`.
3. Collect subsequent lines until the next `SQL Statement Run:` prefix (ignoring optional blank separator lines).
4. If the first result line is exactly `0 rows affected`, the block is empty. Otherwise, each nonblank line is a returned row.
5. Interpret fields using the SQL column order. **Do not blindly split** if arbitrary text/JSON may contain `|`.
6. Parse JSON only after its full field boundary has been identified, preserving nested string escaping.

## 6. Files provided

- `examples/der-dpr-output analyzer/example_01_basic_results.txt`: four statements demonstrating **multiple rows, missing fields, zero rows, and one row**.
- `examples/der-dpr-output analyzer/example_02_json_events.txt`: three statements demonstrating **two JSON-bearing rows (with stringified nested JSON), one row, and zero rows**.
- `examples/der-dpr-output analyzer/example_03_patch_request_results.txt`: repeated before/patch/after sequences for customer, order, refund, and note data.
- `examples/der-dpr-output analyzer/example_04_wide_result.txt`: a single row with 20 columns.
- `examples/der-dpr-output analyzer/example_05_many_rows_500.txt`: one SELECT with 500 synthetic rows.
- `examples/der-dpr-output analyzer/example_06_join_results.txt`: joined customer, order, and payment data, including a zero-row result.
- `examples/der-dpr-output analyzer/example_07_cte_results.txt`: a two-CTE query joined to customer data.
- `examples/der-dpr-output analyzer/example_08_subquery_results.txt`: scalar subqueries in the output and an `IN` subquery filter.
- `examples/der-dpr-output analyzer/example_09_concat_ws_results.txt`: `CONCAT_WS` projection with a `CASE` expression and a NULL-skipped field.

All marker IDs, names, email addresses, identifiers, and data values in these examples are synthetic. `example.test` is used for illustrative addresses.
