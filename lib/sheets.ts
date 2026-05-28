
export function csvUrl(sheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(current);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

export async function fetchCsvRows(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`스프레드시트 데이터를 불러오지 못했습니다. (${res.status})`);
  const text = await res.text();
  const parsed = parseCsv(text);
  if (parsed.length === 0) return [];
  const headers = parsed[0].map((h) => h.trim());
  return parsed.slice(1).map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (values[i] || "").replace(/^\uFEFF/, "").trim();
    });
    return row;
  });
}

export function toNumber(value: any) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/원/g, "")
    .trim();
  return Number(cleaned) || 0;
}

export function formatWon(value: number) {
  return `${Math.round(value || 0).toLocaleString("ko-KR")}원`;
}

export function formatCompactWon(value: number) {
  if (!value) return "0원";
  const 억 = value / 100000000;
  if (Math.abs(억) >= 1) return `${억.toFixed(1)}억`;
  const 만 = value / 10000;
  return `${Math.round(만).toLocaleString("ko-KR")}만`;
}

export type ChannelSale = {
  raw: Record<string, string>;
  channelType: string;
  channel: string;
  storeName: string;
  target: number;
  total: number;
  avg: number;
  achievementRate: number;
  dailySales: number[];
};

export function parseChannelSales(rows: Record<string, string>[]): ChannelSale[] {
  return rows
    .filter((row) => row["채널명"] || row["채널"] || row["합계"])
    .map((row) => {
      const dailySales = Array.from({ length: 31 }, (_, i) => {
        const day = String(i + 1);
        return toNumber(row[day] ?? row[`${day}일`] ?? "");
      });
      const target = toNumber(row["월목표"]);
      const total = toNumber(row["합계"]);
      const achievementRate = target > 0 ? (total / target) * 100 : toNumber(row["달성률"]);
      return {
        raw: row,
        channelType: row["채널구분"] || "",
        channel: row["채널"] || "",
        storeName: row["채널명"] || row["채널"] || "미지정",
        target,
        total,
        avg: toNumber(row["일평균"]),
        achievementRate,
        dailySales,
      };
    });
}

export type ProductSale = {
  raw: Record<string, string>;
  storeName: string;
  styleCode: string;
  productName: string;
  stock: number;
  shipped: number;
  sold: number;
  salesAmount: number;
  sellThrough: number;
  thisWeekQty: number;
  lastWeekQty: number;
  qtyChangeRate: number | null;
};

function sumRangeByIndex(row: Record<string, string>, startIndex: number, endIndex: number) {
  const values = Object.values(row);
  let sum = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    sum += toNumber(values[i]);
  }
  return sum;
}

export function parseProductSales(rows: Record<string, string>[]): ProductSale[] {
  return rows
    .filter((row) => row["스타일명"] || row["상품명"] || row["스타일코드"] || row["스타일 코드"])
    .map((row) => {
      // 요청 기준: 점별상품별 판매 시트의 T~W열이 금주, X~AA열이 전주.
      // 0-based index 기준 T=19, W=22, X=23, AA=26.
      const thisWeekQty = sumRangeByIndex(row, 19, 22);
      const lastWeekQty = sumRangeByIndex(row, 23, 26);
      const qtyChangeRate = lastWeekQty > 0 ? ((thisWeekQty - lastWeekQty) / lastWeekQty) * 100 : null;
      return {
        raw: row,
        storeName: row["채널명"] || row["채널"] || "",
        styleCode: row["스타일코드"] || row["스타일 코드"] || "",
        productName: row["스타일명"] || row["상품명"] || "미지정 상품",
        stock: toNumber(row["재고"]),
        shipped: toNumber(row["출고"]),
        sold: toNumber(row["판매"]),
        salesAmount: toNumber(row["판매금액"]),
        sellThrough: toNumber(row["판매율"]),
        thisWeekQty,
        lastWeekQty,
        qtyChangeRate,
      };
    });
}
