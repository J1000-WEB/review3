import Papa from "papaparse";

export type CsvRow = Record<string, string>;

export function csvUrl(sheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export async function fetchCsvRows(url: string): Promise<CsvRow[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`스프레드시트를 읽을 수 없습니다: ${res.status}`);
  const text = await res.text();

  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
  });

  const rows = parsed.data || [];
  if (rows.length === 0) return [];

  const headers = rows[0].map((h, i) => (h || `__col${i}`).trim());

  return rows.slice(1).map((values) => {
    const row: CsvRow = {};
    headers.forEach((header, i) => {
      // 중복 헤더 보존: 판매, 판매__20 같은 형태로도 접근 가능하게 함
      const key = row[header] === undefined ? header : `${header}__${i}`;
      row[key] = (values[i] || "").trim();
      row[`__col${i}`] = (values[i] || "").trim();
    });
    return row;
  });
}

export function num(value: unknown) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/[,%원\s]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  return Number(cleaned) || 0;
}

export function formatWon(value: number) {
  if (!Number.isFinite(value)) return "0원";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

export function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
