# Formatted Excel report downloads

The Reports download buttons (main view and preview) now create `.xlsx` workbooks.
They use the selected report's rendered table and computed styles, including
company/project headings, all periods, source colours, borders, widths and row
heights. Numeric report cells retain their underlying precision while their
Excel formats match the screen's decimal places, parentheses and dashes.
Headings and line-item columns are frozen.

This is a report snapshot, not an export of the financial calculation engine or
its formulas. Report text is never interpreted as an Excel formula.

ExcelJS 4.4.0 is bundled locally and loaded only on download. See
`vendor/README.md` for the verified release checksum and license. No CDN is
needed, and report data stays in the user's browser.

## FM2-only deployment

Back up and install these static files, keeping the root and `public/fm/`
copies identical:

- `app.js`, `index.html`, `report-excel.js`
- `vendor/exceljs-4.4.0.min.js`, `vendor/exceljs-LICENSE.txt`
- The same five paths under `public/fm/`

Install the exporter and vendor files first, app.js next, and index.html last.
The index contains new asset versions. No database migration or service restart
is required; the Node server reads static files per request.

## Validation

`tests/report-excel-browser.mjs` starts an isolated local FM2 server from the
seeded database, uses synthetic credentials and intercepts all browser traffic.
Set `PLAYWRIGHT_MODULE` to the available Playwright module and run with Node.

Coverage includes all 29 visible reports, main and preview downloads, XLSX ZIP
signature and parsing, every visible cell's text/numeric value/font colour, all
27 Balance Sheet periods, raw numeric precision, merged title fills, empty
headers, frozen panes, zeros, blanks, negative values, small fractions and
formula-like text remaining inert.

The generated Balance Sheet was also opened independently with openpyxl and
rendered for layout inspection. The static mirrored-app regression passed.
