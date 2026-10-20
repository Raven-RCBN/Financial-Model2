/* Export the rendered report, including its computed screen styles, as native XLSX. */
(() => {
  const libraryUrl = new URL("./vendor/exceljs-4.4.0.min.js", document.currentScript.src).href;
  let libraryPromise;

  function loadExcel() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (!libraryPromise) {
      libraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = libraryUrl;
        script.onload = () => window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error("Excel library did not load."));
        script.onerror = () => { script.remove(); reject(new Error("Unable to load Excel export. Please try again.")); };
        document.head.appendChild(script);
      }).catch(error => { libraryPromise = null; throw error; });
    }
    return libraryPromise;
  }

  function color(value) {
    const match = String(value).match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (!match || match[4] === "0") return null;
    return "FF" + match.slice(1, 4).map(n => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function background(element) {
    for (let current = element; current; current = current.parentElement) {
      const fill = color(getComputedStyle(current).backgroundColor);
      if (fill) return fill;
    }
    return "FFFFFFFF";
  }

  function styleOf(element) {
    const css = getComputedStyle(element);
    const fill = background(element);
    const border = {};
    for (const edge of ["top", "right", "bottom", "left"]) {
      const name = edge[0].toUpperCase() + edge.slice(1);
      if (parseFloat(css[`border${name}Width`]) > 0 && css[`border${name}Style`] !== "none") {
        border[edge] = { style: "thin", color: { argb: color(css[`border${name}Color`]) || fill } };
      }
    }
    return {
      font: {
        name: css.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
        size: Math.round(parseFloat(css.fontSize) * 0.75 * 10) / 10,
        bold: Number(css.fontWeight) >= 600, italic: css.fontStyle === "italic",
        color: { argb: color(css.color) || fill },
      },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: fill } },
      border,
      alignment: {
        horizontal: ["right", "center"].includes(css.textAlign) ? css.textAlign : "left",
        vertical: "middle", wrapText: css.whiteSpace !== "nowrap", indent: 1,
      },
    };
  }

  function numberFormat(value, display) {
    if (display === "-") return '"-"';
    const decimals = display.match(/\.(\d+)/)?.[1].length || 0;
    const base = (display.includes(",") ? "#,##0" : "0") + (decimals ? "." + "0".repeat(decimals) : "");
    return `${base};(${base});${display === "0" ? "0" : '"-"'}`;
  }

  // Snapshot synchronously: changing the selected report during XLSX generation
  // must never combine the previous report's data with the new report's styles.
  function capture(root, name, values) {
    const table = root?.querySelector("table");
    if (!table) throw new Error("The report is not ready. Please wait for it to load.");
    const columnCount = Math.max(...Array.from(table.rows, row => Array.from(row.cells).reduce((n, cell) => n + cell.colSpan, 0)));
    const widths = Array(columnCount).fill(10);
    const titles = Array.from(root.querySelectorAll(".workbook-report-title > *"), element => ({
      text: element.textContent.trim(), style: styleOf(element),
      height: element.getBoundingClientRect().height * 0.75 + 8,
    }));
    const rows = Array.from(table.rows, (row, index) => {
      let column = 0;
      const cells = Array.from(row.cells, (cell, cellIndex) => {
        const start = column;
        column += cell.colSpan;
        if (cell.colSpan === 1) widths[start] = Math.max(widths[start], (cell.getBoundingClientRect().width - 5) / 7);
        const text = cell.textContent.trim();
        const raw = values[index]?.[cellIndex];
        const value = typeof raw === "number" && Number.isFinite(raw) ? raw : (text || null);
        const style = styleOf(cell);
        if (typeof value === "number") style.numFmt = numberFormat(value, text);
        return { column: start + 1, span: cell.colSpan, value, style };
      });
      return { cells, height: row.getBoundingClientRect().height * 0.75 };
    });
    return { name, titles, widths, rows, headerCount: table.tHead?.rows.length || 0, financial: table.classList.contains("financial-grid") };
  }

  async function create(snapshot) {
    const ExcelJS = await loadExcel();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "FM2";
    workbook.title = snapshot.name;
    const name = snapshot.name.replace(/[\\/*?:[\]]/g, " ").replace(/^'+|'+$/g, "").slice(0, 31) || "Report";
    const sheet = workbook.addWorksheet(name, { pageSetup: { paperSize: 9, orientation: "landscape", scale: 85 } });
    snapshot.widths.forEach((width, index) => { sheet.getColumn(index + 1).width = Math.max(10, width); });
    snapshot.titles.forEach((title, index) => {
      const cell = sheet.getCell(index + 1, 1);
      cell.value = title.text;
      cell.style = title.style;
      cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      sheet.mergeCells(index + 1, 1, index + 1, snapshot.widths.length);
      sheet.getRow(index + 1).height = title.height;
    });
    snapshot.rows.forEach((row, index) => {
      const rowNumber = snapshot.titles.length + index + 1;
      sheet.getRow(rowNumber).height = Math.max(9, row.height);
      row.cells.forEach(({ column, span, value, style }) => {
        const cell = sheet.getCell(rowNumber, column);
        // Strings stay strings, including labels beginning with '='. Never
        // interpret user/report text as a spreadsheet formula or external link.
        cell.value = value;
        cell.style = style;
        if (span > 1) sheet.mergeCells(rowNumber, column, rowNumber, column + span - 1);
      });
    });
    const ySplit = snapshot.titles.length + snapshot.headerCount;
    const xSplit = snapshot.financial && snapshot.headerCount ? 3 : 1;
    sheet.views = [{ state: "frozen", xSplit, ySplit, showGridLines: false }];
    if (ySplit) sheet.pageSetup.printTitlesRow = `1:${ySplit}`;
    sheet.pageSetup.printTitlesColumn = xSplit === 3 ? "A:C" : "A:A";
    sheet.pageSetup.printArea = `A1:${sheet.getCell(sheet.rowCount, snapshot.widths.length).address}`;
    return new Blob([await workbook.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  window.FM2ReportExcel = { capture, create };
})();
