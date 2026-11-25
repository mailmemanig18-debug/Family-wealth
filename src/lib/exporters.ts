export function downloadCSV(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (cell: string | number) => {
    const str = String(cell ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function downloadExcel(filename: string, sheetTitle: string, headers: string[], rows: Array<Array<string | number>>) {
  const xmlEscape = (v: string | number) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const headerXml = `<Row>${headers
    .map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join('')}</Row>`;

  const bodyXml = rows
    .map(
      (r) =>
        `<Row>${r
          .map((cell) => {
            const isNum = typeof cell === 'number' && Number.isFinite(cell);
            return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${xmlEscape(cell)}</Data></Cell>`;
          })
          .join('')}</Row>`,
    )
    .join('');

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(sheetTitle.slice(0, 30))}">
  <Table>
   ${headerXml}
   ${bodyXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
