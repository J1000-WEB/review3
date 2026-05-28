"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { csvUrl, fetchCsvRows, formatPct, formatWon } from "@/lib/sheets";
import {
  buildWeeklyTrend,
  managementStores,
  parseChannelRows,
  parseProductRows,
  ChannelSale,
  ProductSale,
} from "@/lib/analysis";

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || "1lQHjJ920HXMazzdD0csxKaVbz1U6VFZg";
const CHANNEL_GID = process.env.NEXT_PUBLIC_CHANNEL_SALES_GID || "565810951";
const PRODUCT_GID = process.env.NEXT_PUBLIC_PRODUCT_SALES_GID || "1439021839";

export default function Page() {
  const [channels, setChannels] = useState<ChannelSale[]>([]);
  const [products, setProducts] = useState<ProductSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [channelRows, productRows] = await Promise.all([
        fetchCsvRows(csvUrl(SHEET_ID, CHANNEL_GID)),
        fetchCsvRows(csvUrl(SHEET_ID, PRODUCT_GID)),
      ]);
      setChannels(parseChannelRows(channelRows));
      setProducts(parseProductRows(productRows));
    } catch (e: any) {
      setError(e?.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalTarget = useMemo(() => channels.reduce((s, c) => s + c.target, 0), [channels]);
  const totalSales = useMemo(() => channels.reduce((s, c) => s + c.total, 0), [channels]);
  const achievement = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
  const totalForecast = useMemo(() => channels.reduce((s, c) => s + c.forecastSales, 0), [channels]);
  const forecastRate = totalTarget > 0 ? (totalForecast / totalTarget) * 100 : 0;
  const weeklyTrend = useMemo(() => buildWeeklyTrend(channels), [channels]);
  const storeCompare = useMemo(
    () =>
      [...channels]
        .sort((a, b) => b.thisWeek - a.thisWeek)
        .slice(0, 10)
        .map((c) => ({
          name: c.storeName.replace("플래그십", "FS"),
          전주: c.lastWeek,
          금주: c.thisWeek,
          증감률: c.wowRate,
        })),
    [channels]
  );
  const risks = useMemo(() => managementStores(channels), [channels]);
  const topProducts = products.slice(0, 10);

  const review = makeReview(risks, topProducts, forecastRate);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Google Sheets 자동연동</p>
            <h1 className="text-3xl font-bold tracking-tight">오프라인 매출 리뷰 대시보드(소재천)</h1>
          </div>
          <button
            onClick={load}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            데이터 새로고침
          </button>
        </header>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        {loading && <div className="rounded-2xl bg-white p-6 shadow">데이터를 불러오는 중입니다...</div>}

        <section className="grid gap-4 md:grid-cols-4">
          <Kpi title="월 목표" value={formatWon(totalTarget)} />
          <Kpi title="누적 매출" value={formatWon(totalSales)} />
          <Kpi title="목표 달성률" value={formatPct(achievement)} />
          <Kpi title="착지예측 매출(달성률)" value={formatWon(totalForecast)} sub={formatPct(forecastRate)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card title="주차별 매출 추이">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 100000000)}억`} />
                <Tooltip formatter={(v: any) => formatWon(Number(v))} />
                <Line type="monotone" dataKey="매출" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="매장별 주간 매출 비교 TOP10">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={storeCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} interval={0} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000000)}백만`} />
                <Tooltip formatter={(v: any) => formatWon(Number(v))} />
                <Legend />
                <Bar dataKey="전주" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                <Bar dataKey="금주" fill="#111827" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card title="매출관리 필요매장(주간)">
            <div className="space-y-3">
              {risks.map((store, idx) => (
                <div key={store.storeName} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{idx + 1}. {store.storeName}</p>
                      <p className="text-sm text-gray-500">전주 {formatWon(store.lastWeek)} / 금주 {formatWon(store.thisWeek)}</p>
                    </div>
                    <div className="text-right">
                      <p className={store.wowRate < 0 ? "font-bold text-red-600" : "font-bold text-blue-600"}>
                        {store.wowRate >= 0 ? "+" : ""}{formatPct(store.wowRate)}
                      </p>
                      <p className="text-xs text-gray-500">착지 {formatPct(store.forecastRate)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="상품 TOP10 - 금주 판매량 기준">
            <div className="space-y-3">
              {topProducts.length === 0 && <p className="text-gray-500">상품 데이터를 확인할 수 없습니다.</p>}
              {topProducts.map((p, idx) => (
                <div key={p.styleCode || p.productName} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{idx + 1}. {p.productName || "상품명 없음"}</p>
                      <p className="text-xs text-gray-500">{p.styleCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{p.weekQty.toLocaleString("ko-KR")}개</p>
                      <p className={p.qtyGrowthRate < 0 ? "text-sm font-semibold text-red-600" : "text-sm font-semibold text-blue-600"}>
                        전주 {p.prevWeekQty.toLocaleString("ko-KR")}개 / {p.qtyGrowthRate >= 0 ? "+" : ""}{formatPct(p.qtyGrowthRate)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    금주 판매금액 {formatWon(p.weekAmount)} · 판매율 {formatPct(p.salesRate)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card title="🧠 주간 매출 리뷰">
            <ul className="list-disc space-y-2 pl-5 text-gray-700">
              {review.review.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </Card>
          <Card title="📌 운영 제안">
            <ul className="list-disc space-y-2 pl-5 text-gray-700">
              {review.actions.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-sm font-semibold text-gray-500">{sub}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function makeReview(risks: ChannelSale[], topProducts: ProductSale[], forecastRate: number) {
  const topRisk = risks[0];
  const topProduct = topProducts[0];
  const review: string[] = [];
  const actions: string[] = [];

  review.push(`현재 착지예측 달성률은 ${formatPct(forecastRate)} 수준으로 예상됩니다.`);
  if (topRisk) {
    review.push(`${topRisk.storeName}은 전주 대비 ${topRisk.wowRate >= 0 ? "+" : ""}${formatPct(topRisk.wowRate)} 변동되어 주간 관리 우선순위로 확인됩니다.`);
  }
  if (topProduct) {
    review.push(`금주 판매량 기준 TOP 상품은 ${topProduct.productName}이며, 전주 대비 ${topProduct.qtyGrowthRate >= 0 ? "+" : ""}${formatPct(topProduct.qtyGrowthRate)} 변동되었습니다.`);
  }

  actions.push("전주 대비 하락폭이 큰 매장은 메인 진열, 베스트 상품 노출, 주말 전환율 점검을 우선 진행하세요.");
  actions.push("착지예측 달성률이 낮은 매장은 남은 영업일 기준 필요 매출을 확인하고 단기 프로모션 또는 상품 이동을 검토하세요.");
  actions.push("금주 판매량이 급증한 상품은 주요 매장 재고를 점검하고, 유사 스타일 연계 판매를 강화하세요.");

  return { review, actions };
}
