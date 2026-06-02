export type CsvRow = string[];

export function csvUrl(sheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export async function fetchCsvMatrix(url: string): Promise<CsvRow[]> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  return text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

export function toNumber(value: any) {
  if (value === undefined || value === null) return 0;
  const normalized = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  return Number(normalized) || 0;
}

export function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function pct(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function findHeaderRow(matrix: CsvRow[], required: string[]) {
  return matrix.findIndex((row) => required.every((name) => row.includes(name)));
}

export type ChannelRow = {
  channelType: string;
  channel: string;
  storeName: string;
  target: number;
  total: number;
  avg: number;
  achievementRate: number;
  dailySales: number[];
};

export function parseChannelSales(matrix: CsvRow[]): ChannelRow[] {
  const headerIndex = findHeaderRow(matrix, ["채널명", "월목표", "합계"]);
  if (headerIndex < 0) return [];
  const headers = matrix[headerIndex];
  const rows = matrix.slice(headerIndex + 1);

  const idx = (name: string) => headers.indexOf(name);
  const dailyIndexes = headers
    .map((h, i) => (/^\d{1,2}일$/.test(h) ? i : -1))
    .filter((i) => i >= 0);

  return rows
    .map((row) => {
      const storeName = row[idx("채널명")] || row[idx("채널")] || "";
      return {
        channelType: row[idx("채널구분")] || "",
        channel: row[idx("채널")] || "",
        storeName,
        target: toNumber(row[idx("월목표")]),
        total: toNumber(row[idx("합계")]),
        avg: toNumber(row[idx("일평균")]),
        achievementRate: toNumber(row[idx("달성률")]),
        dailySales: dailyIndexes.map((i) => toNumber(row[i])),
      };
    })
    .filter((r) => r.storeName && r.storeName !== "합계" && r.channel !== "합계");
}

export type ProductRow = {
  storeName: string;
  styleCode: string;
  productName: string;
  stock: number;
  shipped: number;
  sold: number;
  salesRate: number;
  salesAmount: number;
  weekSold: number;
  weekReturn: number;
  weekNet: number;
  weekAmount: number;
  prevSold: number;
  prevReturn: number;
  prevNet: number;
  prevAmount: number;
};

function findGroupStart(headerRow: CsvRow, groupName: string) {
  return headerRow.findIndex((v) => String(v).trim() === groupName);
}

export function parseProductSales(matrix: CsvRow[]): ProductRow[] {
  // 시트 구조가 바뀌어도 대응: '금주', '전주' 그룹 헤더와 바로 아래 세부 헤더를 탐색
  const groupHeaderIndex = matrix.findIndex((row) => row.includes("금주") && row.includes("전주"));
  const subHeaderIndex = groupHeaderIndex >= 0 ? groupHeaderIndex + 1 : -1;

  // 기본 상품 헤더는 '스타일코드/스타일명'이 있는 행을 사용
  const baseHeaderIndex = matrix.findIndex((row) => row.includes("스타일코드") || row.includes("스타일 코드"));
  const headerIndex = baseHeaderIndex >= 0 ? baseHeaderIndex : subHeaderIndex;
  if (headerIndex < 0) return [];

  const baseHeaders = matrix[headerIndex];
  const groupHeaders = groupHeaderIndex >= 0 ? matrix[groupHeaderIndex] : [];
  const subHeaders = subHeaderIndex >= 0 ? matrix[subHeaderIndex] : baseHeaders;

  const idxByNames = (names: string[]) => {
    for (const name of names) {
      const found = baseHeaders.findIndex((h) => String(h).trim() === name);
      if (found >= 0) return found;
    }
    return -1;
  };

  const channelNameIdx = idxByNames(["채널명", "매장명", "점포명"]);
  const styleCodeIdx = idxByNames(["스타일코드", "스타일 코드"]);
  const productNameIdx = idxByNames(["스타일명", "상품명"]);
  const stockIdx = idxByNames(["재고"]);
  const shippedIdx = idxByNames(["출고"]);
  const soldIdx = idxByNames(["판매"]);
  const salesRateIdx = idxByNames(["판매율"]);
  const salesAmountIdx = idxByNames(["판매금액"]);

  const findSubCol = (group: string, sub: string) => {
    const start = findGroupStart(groupHeaders, group);
    if (start < 0) return -1;
    for (let i = start; i < Math.min(start + 8, subHeaders.length); i++) {
      if (String(subHeaders[i]).trim() === sub) return i;
    }
    return -1;
  };

  const weekSoldIdx = findSubCol("금주", "판매");
  const weekReturnIdx = findSubCol("금주", "반품");
  const weekNetIdx = findSubCol("금주", "합계");
  const weekAmountIdx = findSubCol("금주", "판매금액");
  const prevSoldIdx = findSubCol("전주", "판매");
  const prevReturnIdx = findSubCol("전주", "반품");
  const prevNetIdx = findSubCol("전주", "합계");
  const prevAmountIdx = findSubCol("전주", "판매금액");

  const dataStart = Math.max(headerIndex, subHeaderIndex) + 1;

  return matrix
    .slice(dataStart)
    .map((row) => {
      const styleCode = row[styleCodeIdx] || "";
      const productName = row[productNameIdx] || "";
      return {
        storeName: row[channelNameIdx] || "",
        styleCode,
        productName,
        stock: toNumber(row[stockIdx]),
        shipped: toNumber(row[shippedIdx]),
        sold: toNumber(row[soldIdx]),
        salesRate: toNumber(row[salesRateIdx]),
        salesAmount: toNumber(row[salesAmountIdx]),
        weekSold: toNumber(row[weekSoldIdx]),
        weekReturn: toNumber(row[weekReturnIdx]),
        weekNet: toNumber(row[weekNetIdx]),
        weekAmount: toNumber(row[weekAmountIdx]),
        prevSold: toNumber(row[prevSoldIdx]),
        prevReturn: toNumber(row[prevReturnIdx]),
        prevNet: toNumber(row[prevNetIdx]),
        prevAmount: toNumber(row[prevAmountIdx]),
      };
    })
    .filter((r) => {
      const name = `${r.storeName} ${r.styleCode} ${r.productName}`.trim();
      return r.productName && r.productName !== "합계" && r.styleCode !== "합계" && !name.includes("합계");
    });
}
