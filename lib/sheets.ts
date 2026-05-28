export type AnyRow = Record<string, string>;

export function csvUrl(sheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export async function fetchCsvRows(url: string): Promise<AnyRow[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV를 불러오지 못했습니다. status=${res.status}`);

  const text = await res.text();
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: AnyRow = {};
    headers.forEach((header, i) => {
      row[header] = (values[i] ?? "").replace(/^"|"$/g, "").trim();
    });
    return row;
  });
}

export function toNumber(value: unknown) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/원/g, "")
    .trim();
  return Number(cleaned) || 0;
}

export function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function parseChannelSales(rows: AnyRow[]) {
  return rows
    .filter((row) => row["채널명"] || row["채널"] || row["합계"])
    .map((row) => {
      const dailySales = Array.from({ length: 31 }, (_, i) => {
        const day = String(i + 1);
        return {
          day: `${day}일`,
          amount: toNumber(row[day] ?? row[`${day}일`]),
        };
      }).filter((item) => item.amount > 0);

      return {
        ...row,
        channelType: row["채널구분"] || "",
        channel: row["채널"] || "",
        storeName: row["채널명"] || row["채널"] || "미지정",
        target: toNumber(row["월목표"]),
        total: toNumber(row["합계"]),
        avg: toNumber(row["일평균"]),
        achievementRate: toNumber(row["달성률"]),
        dailySales,
      };
    });
}

export function parseProductSales(rows: AnyRow[]) {
  return rows
    .filter((row) => row["스타일명"] || row["상품명"] || row["판매금액"])
    .map((row) => ({
      ...row,
      channel: row["채널"] || "",
      storeName: row["채널명"] || row["채널"] || "미지정",
      styleCode: row["스타일코드"] || row["스타일 코드"] || "",
      productName: row["스타일명"] || row["상품명"] || "미지정 상품",
      stock: toNumber(row["재고"]),
      shipped: toNumber(row["출고"]),
      sold: toNumber(row["판매"]),
      salesRate: toNumber(row["판매율"]),
      salesAmount: toNumber(row["판매금액"]),
    }));
}
