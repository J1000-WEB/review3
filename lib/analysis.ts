export function analyze(channelRows: any[], productRows: any[]) {
  const validChannels = channelRows.filter((row) => row.total > 0 || row.target > 0);
  const totalTarget = validChannels.reduce((sum, row) => sum + (row.target || 0), 0);
  const totalSales = validChannels.reduce((sum, row) => sum + (row.total || 0), 0);
  const avgSales = validChannels.reduce((sum, row) => sum + (row.avg || 0), 0);
  const achievementRate = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;

  const topStores = [...validChannels].sort((a, b) => b.total - a.total).slice(0, 10);
  const lowStores = [...validChannels]
    .filter((row) => row.target > 0)
    .sort((a, b) => a.achievementRate - b.achievementRate)
    .slice(0, 10);
  const highStores = [...validChannels]
    .filter((row) => row.target > 0)
    .sort((a, b) => b.achievementRate - a.achievementRate)
    .slice(0, 5);

  const dailyMap = new Map<string, number>();
  validChannels.forEach((row) => {
    (row.dailySales || []).forEach((item: any) => {
      dailyMap.set(item.day, (dailyMap.get(item.day) || 0) + item.amount);
    });
  });
  const dailyTrend = Array.from(dailyMap.entries()).map(([day, amount]) => ({ day, amount }));

  const topProducts = [...productRows]
    .filter((row) => row.salesAmount > 0)
    .sort((a, b) => b.salesAmount - a.salesAmount)
    .slice(0, 10);

  const slowProducts = [...productRows]
    .filter((row) => row.stock > 0 && row.salesRate >= 0)
    .sort((a, b) => a.salesRate - b.salesRate)
    .slice(0, 10);

  return {
    totalTarget,
    totalSales,
    avgSales,
    achievementRate,
    topStores,
    lowStores,
    highStores,
    dailyTrend,
    topProducts,
    slowProducts,
  };
}

export function createReview(summary: ReturnType<typeof analyze>) {
  const lowStoreText = summary.lowStores
    .slice(0, 3)
    .map((s: any) => `${s.storeName}(${s.achievementRate.toFixed(1)}%)`)
    .join(", ");

  const topStoreText = summary.highStores
    .slice(0, 3)
    .map((s: any) => `${s.storeName}(${s.achievementRate.toFixed(1)}%)`)
    .join(", ");

  const topProductText = summary.topProducts
    .slice(0, 3)
    .map((p: any) => p.productName)
    .join(", ");

  return [
    `현재 누적 매출은 ${Math.round(summary.totalSales).toLocaleString("ko-KR")}원이며, 목표 대비 달성률은 ${summary.achievementRate.toFixed(1)}%입니다.`,
    topStoreText ? `우수 매장은 ${topStoreText} 순으로 나타납니다.` : "",
    lowStoreText ? `관리 필요 매장은 ${lowStoreText}입니다. 해당 매장은 일별 매출 흐름과 상품 구성 점검이 필요합니다.` : "",
    topProductText ? `상품 매출은 ${topProductText} 중심으로 기여도가 높습니다.` : "",
    "대책으로는 부진 매장의 주력 상품 전면 노출, 판매율 낮은 상품의 세트 코디 제안, 목표 대비 부족분을 기준으로 한 일매출 관리가 필요합니다.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
