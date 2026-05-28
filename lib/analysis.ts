
import { ChannelSale, ProductSale } from "./sheets";

export function getElapsedDays(channelRows: ChannelSale[]) {
  const totalsByDay = Array.from({ length: 31 }, (_, dayIndex) =>
    channelRows.reduce((sum, row) => sum + (row.dailySales[dayIndex] || 0), 0)
  );
  const lastDayWithSales = totalsByDay.reduce((last, value, index) => (value > 0 ? index + 1 : last), 0);
  return Math.max(lastDayWithSales, 1);
}

export function getMonthDays(channelRows: ChannelSale[]) {
  const maxDailyColumns = Math.max(...channelRows.map((row) => row.dailySales.length), 30);
  return maxDailyColumns || 30;
}

export function forecastLanding(totalSales: number, elapsedDays: number, monthDays: number) {
  if (!elapsedDays || !monthDays) return 0;
  return (totalSales / elapsedDays) * monthDays;
}

export function weekRangeLabels(elapsedDays: number) {
  // 월일자별 채널판매 시트가 월 1일~31일 컬럼 구조라서,
  // 가장 최근 입력일 기준 직전 7일을 "전주 월~일" 대체 구간으로 계산.
  // 실제 요일 정보가 들어오면 이 함수만 요일 기준으로 교체 가능.
  const lastWeekEnd = Math.max(elapsedDays - 7, 0);
  const lastWeekStart = Math.max(lastWeekEnd - 6, 1);
  const thisWeekEnd = elapsedDays;
  const thisWeekStart = Math.max(elapsedDays - 6, 1);
  return {
    thisWeekLabel: `${thisWeekStart}일~${thisWeekEnd}일`,
    lastWeekLabel: lastWeekEnd > 0 ? `${lastWeekStart}일~${lastWeekEnd}일` : "전주 데이터 부족",
    thisWeekStart,
    thisWeekEnd,
    lastWeekStart,
    lastWeekEnd,
  };
}

function sumDays(row: ChannelSale, startDay: number, endDay: number) {
  if (startDay <= 0 || endDay <= 0 || endDay < startDay) return 0;
  let sum = 0;
  for (let day = startDay; day <= endDay; day++) {
    sum += row.dailySales[day - 1] || 0;
  }
  return sum;
}

export function analyze(channelRows: ChannelSale[], productRows: ProductSale[]) {
  const filteredChannels = channelRows.filter((row) => row.storeName && row.target + row.total > 0);
  const totalTarget = filteredChannels.reduce((sum, row) => sum + row.target, 0);
  const totalSales = filteredChannels.reduce((sum, row) => sum + row.total, 0);
  const elapsedDays = getElapsedDays(filteredChannels);
  const monthDays = getMonthDays(filteredChannels);
  const landingSales = forecastLanding(totalSales, elapsedDays, monthDays);
  const landingRate = totalTarget > 0 ? (landingSales / totalTarget) * 100 : 0;
  const achievementRate = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;

  const dailyTrend = Array.from({ length: monthDays }, (_, i) => ({
    day: `${i + 1}일`,
    sales: filteredChannels.reduce((sum, row) => sum + (row.dailySales[i] || 0), 0),
  })).filter((item) => item.sales > 0);

  const topStores = [...filteredChannels]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((row) => ({
      name: row.storeName,
      sales: row.total,
      rate: row.achievementRate,
    }));

  const ranges = weekRangeLabels(elapsedDays);

  const managedStores = filteredChannels
    .map((row) => {
      const thisWeekSales = sumDays(row, ranges.thisWeekStart, ranges.thisWeekEnd);
      const lastWeekSales = sumDays(row, ranges.lastWeekStart, ranges.lastWeekEnd);
      const weeklyChangeRate = lastWeekSales > 0 ? ((thisWeekSales - lastWeekSales) / lastWeekSales) * 100 : null;
      const storeLanding = forecastLanding(row.total, elapsedDays, monthDays);
      const landingRateByStore = row.target > 0 ? (storeLanding / row.target) * 100 : 0;
      const shortage = Math.max(row.target - storeLanding, 0);
      const changeScore = weeklyChangeRate === null ? 0 : Math.abs(weeklyChangeRate);
      const landingRiskScore = Math.max(100 - landingRateByStore, 0);
      return {
        name: row.storeName,
        total: row.total,
        target: row.target,
        thisWeekSales,
        lastWeekSales,
        weeklyChangeRate,
        landingSales: storeLanding,
        landingRate: landingRateByStore,
        shortage,
        score: changeScore * 0.55 + landingRiskScore * 0.45 + (shortage / 10000000),
      };
    })
    .filter((row) => row.target > 0 && (row.weeklyChangeRate !== null || row.landingRate < 85))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const productTop10 = [...productRows]
    .filter((row) => row.productName && (row.thisWeekQty > 0 || row.sold > 0))
    .sort((a, b) => (b.thisWeekQty || b.sold) - (a.thisWeekQty || a.sold))
    .slice(0, 10);

  return {
    totalTarget,
    totalSales,
    achievementRate,
    elapsedDays,
    monthDays,
    landingSales,
    landingRate,
    dailyTrend,
    topStores,
    managedStores,
    productTop10,
    ranges,
  };
}
