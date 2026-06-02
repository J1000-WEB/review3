import { ChannelRow, ProductRow } from "./sheets";

export function safeRate(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function getElapsedDays(rows: ChannelRow[]) {
  const maxDays = Math.max(1, ...rows.map((r) => r.dailySales.length || 1));
  const elapsed = Math.max(
    1,
    ...rows.map((r) => r.dailySales.filter((v) => v > 0).length)
  );
  return { elapsed, monthDays: maxDays };
}

export function getTotals(rows: ChannelRow[]) {
  const target = rows.reduce((s, r) => s + r.target, 0);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const { elapsed, monthDays } = getElapsedDays(rows);
  const forecast = elapsed > 0 ? (total / elapsed) * monthDays : 0;
  const achievementRate = target ? (total / target) * 100 : 0;
  const forecastRate = target ? (forecast / target) * 100 : 0;
  return { target, total, achievementRate, forecast, forecastRate, elapsed, monthDays };
}

export function getWeekRanges(rows: ChannelRow[]) {
  const { elapsed } = getElapsedDays(rows);
  const currentEnd = Math.max(0, elapsed - 1);
  const currentStart = Math.max(0, currentEnd - 6);
  const prevEnd = Math.max(0, currentStart - 1);
  const prevStart = Math.max(0, prevEnd - 6);
  return { currentStart, currentEnd, prevStart, prevEnd };
}

export function sumRange(values: number[], start: number, end: number) {
  if (end < start) return 0;
  return values.slice(start, end + 1).reduce((s, v) => s + v, 0);
}

export function weeklyTrend(rows: ChannelRow[]) {
  const maxDays = Math.max(0, ...rows.map((r) => r.dailySales.length));
  const weeks = [];
  for (let start = 0; start < maxDays; start += 7) {
    const end = Math.min(start + 6, maxDays - 1);
    const total = rows.reduce((s, r) => s + sumRange(r.dailySales, start, end), 0);
    weeks.push({ week: `${weeks.length + 1}주차`, 매출: total });
  }
  return weeks;
}

export function storeWeeklyComparison(rows: ChannelRow[]) {
  const { currentStart, currentEnd, prevStart, prevEnd } = getWeekRanges(rows);
  return rows
    .map((r) => {
      const thisWeek = sumRange(r.dailySales, currentStart, currentEnd);
      const prevWeek = sumRange(r.dailySales, prevStart, prevEnd);
      const changeRate = safeRate(thisWeek, prevWeek);
      const { elapsed, monthDays } = getElapsedDays([r]);
      const forecast = elapsed > 0 ? (r.total / elapsed) * monthDays : 0;
      const forecastRate = r.target ? (forecast / r.target) * 100 : 0;
      return {
        storeName: r.storeName,
        target: r.target,
        total: r.total,
        thisWeek,
        prevWeek,
        changeRate,
        forecast,
        forecastRate,
      };
    })
    .filter((r) => r.thisWeek > 0 || r.prevWeek > 0)
    .sort((a, b) => b.thisWeek - a.thisWeek);
}

export function needAttentionStores(rows: ChannelRow[]) {
  return storeWeeklyComparison(rows)
    .map((r) => ({
      ...r,
      score: Math.abs(r.changeRate) + Math.max(0, 80 - r.forecastRate),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function productTop10(products: ProductRow[]) {
  const map = new Map<string, any>();

  products.forEach((p) => {
    const key = p.styleCode || p.productName;
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        styleCode: p.styleCode,
        productName: p.productName,
        weekSold: 0,
        prevSold: 0,
        weekAmount: 0,
        prevAmount: 0,
        salesAmount: 0,
        stock: 0,
        shipped: 0,
        sold: 0,
      });
    }

    const item = map.get(key);
    item.weekSold += p.weekSold || p.weekNet || 0;
    item.prevSold += p.prevSold || p.prevNet || 0;
    item.weekAmount += p.weekAmount;
    item.prevAmount += p.prevAmount;
    item.salesAmount += p.salesAmount;
    item.stock += p.stock;
    item.shipped += p.shipped;
    item.sold += p.sold;
  });

  return Array.from(map.values())
    .map((p) => ({
      ...p,
      changeRate: safeRate(p.weekSold, p.prevSold),
      salesRate: p.shipped ? (p.sold / p.shipped) * 100 : 0,
    }))
    .filter((p) => p.productName && p.productName !== "합계")
    .sort((a, b) => b.weekSold - a.weekSold)
    .slice(0, 10);
}

export function weeklyReview(rows: ChannelRow[]) {
  const totals = getTotals(rows);
  const attention = needAttentionStores(rows);
  const worst = attention[0];

  const review = [
    `현재 누적 매출은 ${Math.round(totals.total).toLocaleString("ko-KR")}원이며, 목표 달성률은 ${totals.achievementRate.toFixed(1)}%입니다.`,
    `현재 속도 기준 착지예측은 ${Math.round(totals.forecast).toLocaleString("ko-KR")}원, 착지예측 달성률은 ${totals.forecastRate.toFixed(1)}%입니다.`,
    worst ? `${worst.storeName}은 전주 대비 변동폭과 착지예측 기준에서 우선 점검이 필요한 매장입니다.` : "관리 필요 매장 데이터가 충분하지 않습니다.",
  ];

  const suggestions = [
    "전주 대비 하락폭이 큰 매장은 베스트 상품 진열, 판매사 코멘트, 고객 유입 요인을 우선 점검하세요.",
    "착지예측 달성률이 낮은 매장은 남은 기간 필요 일매출을 기준으로 프로모션 또는 상품 이동을 검토하세요.",
    "상승 매장의 주력 상품과 코디 구성을 다른 매장에도 공유해 매출 회복 포인트로 활용하세요.",
  ];

  return { review, suggestions };
}
