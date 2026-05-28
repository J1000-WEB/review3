import { num } from "./sheets";

export type ChannelSale = {
  storeName: string;
  target: number;
  total: number;
  achievementRate: number;
  daily: number[];
  weeks: number[];
  lastWeek: number;
  thisWeek: number;
  wowRate: number;
  forecastSales: number;
  forecastRate: number;
};

export type ProductSale = {
  styleCode: string;
  productName: string;
  weekQty: number;
  prevWeekQty: number;
  qtyGrowthRate: number;
  weekAmount: number;
  prevWeekAmount: number;
  salesRate: number;
  totalAmount: number;
};

export function parseChannelRows(rows: Record<string, string>[]): ChannelSale[] {
  return rows
    .filter((row) => (row["채널명"] || row["채널"] || "").trim())
    .map((row) => {
      const storeName = row["채널명"] || row["채널"] || "";
      const target = num(row["월목표"]);
      const total = num(row["합계"]);
      const achievementRate = target > 0 ? (total / target) * 100 : num(row["달성률"]);

      // 1~31일 컬럼을 폭넓게 탐색
      const daily = Array.from({ length: 31 }, (_, i) => {
        const d = i + 1;
        return num(row[String(d)] || row[`${d}일`] || row[` ${d}`] || row[`__col${7 + i}`]);
      });

      const nonZeroDays = daily.filter((v) => v > 0).length;
      const elapsed = Math.max(1, nonZeroDays || new Date().getDate());
      const monthDays = daily.length >= 31 ? 31 : 30;
      const forecastSales = total > 0 ? (total / elapsed) * monthDays : 0;
      const forecastRate = target > 0 ? (forecastSales / target) * 100 : 0;

      const weeks = [
        sum(daily.slice(0, 7)),
        sum(daily.slice(7, 14)),
        sum(daily.slice(14, 21)),
        sum(daily.slice(21, 28)),
        sum(daily.slice(28, 31)),
      ];

      // 현재 입력된 데이터 기준 마지막 완성 주차와 직전 주차 비교
      const validWeeks = weeks.map((v, i) => ({ v, i })).filter((w) => w.v > 0);
      const thisIdx = validWeeks.length ? validWeeks[validWeeks.length - 1].i : 0;
      const prevIdx = Math.max(0, thisIdx - 1);
      const thisWeek = weeks[thisIdx] || 0;
      const lastWeek = weeks[prevIdx] || 0;
      const wowRate = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

      return {
        storeName,
        target,
        total,
        achievementRate,
        daily,
        weeks,
        lastWeek,
        thisWeek,
        wowRate,
        forecastSales,
        forecastRate,
      };
    });
}

export function parseProductRows(rows: Record<string, string>[]): ProductSale[] {
  const grouped = new Map<string, ProductSale>();

  rows.forEach((row) => {
    const styleCode = row["스타일코드"] || row["스타일 코드"] || row["STYLE"] || row["__col2"] || "";
    const productName = row["스타일명"] || row["상품명"] || row["__col3"] || "";
    if (!styleCode && !productName) return;

    // Google CSV는 병합 헤더 때문에 중복명이 생김. 사용자 확인 기준:
    // T=금주 판매, W=금주 판매금액, X=전주 판매, AA=전주 판매금액
    // 0-base index: T 19, W 22, X 23, AA 26
    const weekQty = num(row["__col19"]);
    const weekAmount = num(row["__col22"]);
    const prevWeekQty = num(row["__col23"]);
    const prevWeekAmount = num(row["__col26"]);
    const totalAmount = num(row["판매금액"] || row["__col16"] || weekAmount);
    const salesRate = num(row["판매율"] || row["__col14"]);

    const key = styleCode || productName;
    const old = grouped.get(key) || {
      styleCode,
      productName,
      weekQty: 0,
      prevWeekQty: 0,
      qtyGrowthRate: 0,
      weekAmount: 0,
      prevWeekAmount: 0,
      salesRate: 0,
      totalAmount: 0,
    };

    old.weekQty += weekQty;
    old.prevWeekQty += prevWeekQty;
    old.weekAmount += weekAmount;
    old.prevWeekAmount += prevWeekAmount;
    old.totalAmount += totalAmount;
    old.salesRate = Math.max(old.salesRate, salesRate);
    grouped.set(key, old);
  });

  return Array.from(grouped.values())
    .map((p) => ({
      ...p,
      qtyGrowthRate: p.prevWeekQty > 0 ? ((p.weekQty - p.prevWeekQty) / p.prevWeekQty) * 100 : p.weekQty > 0 ? 100 : 0,
    }))
    .sort((a, b) => b.weekQty - a.weekQty);
}

export function buildWeeklyTrend(channels: ChannelSale[]) {
  return [0, 1, 2, 3, 4].map((idx) => ({
    name: `${idx + 1}주차`,
    매출: sum(channels.map((c) => c.weeks[idx] || 0)),
  }));
}

export function managementStores(channels: ChannelSale[]) {
  return channels
    .map((c) => ({
      ...c,
      riskScore: Math.abs(c.wowRate) + Math.max(0, 85 - c.forecastRate),
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);
}

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}
