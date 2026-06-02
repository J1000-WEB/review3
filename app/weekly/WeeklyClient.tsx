"use client";

import NavTabs from "@/components/NavTabs";
import { csvUrl, fetchCsvMatrix, formatWon, parseChannelSales, parseProductSales, pct } from "@/lib/sheets";
import { getTotals, needAttentionStores, productTop10, storeWeeklyComparison, weeklyReview, weeklyTrend } from "@/lib/analysis";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || "1lQHjJ920HXMazzdD0csxKaVbz1U6VFZg";
const CHANNEL_GID = process.env.NEXT_PUBLIC_CHANNEL_SALES_GID || "565810951";
const PRODUCT_GID = process.env.NEXT_PUBLIC_PRODUCT_SALES_GID || "1439021839";

export default function WeeklyClient() {
  const [channelMatrix, setChannelMatrix] = useState<any[]>([]);
  const [productMatrix, setProductMatrix] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchCsvMatrix(csvUrl(SHEET_ID, CHANNEL_GID)).catch(() => []),
      fetchCsvMatrix(csvUrl(SHEET_ID, PRODUCT_GID)).catch(() => []),
    ]).then(([c, p]) => {
      setChannelMatrix(c);
      setProductMatrix(p);
      setLoading(false);
    });
  }, []);

  const data = useMemo(() => {
    const channels = parseChannelSales(channelMatrix);
    const products = parseProductSales(productMatrix);
    const totals = getTotals(channels);
    return {
      totals,
      weeks: weeklyTrend(channels),
      storeCompare: storeWeeklyComparison(channels).slice(0, 10),
      attention: needAttentionStores(channels),
      topProducts: productTop10(products),
      review: weeklyReview(channels),
    };
  }, [channelMatrix, productMatrix]);

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">오프라인 매출 리뷰 대시보드(소재천)</h1>
            <p className="mt-1 text-sm text-slate-500">주간 기준: 금주 vs 전주 / 상품은 전체 매장 합산 기준</p>
          </div>
          <NavTabs active="weekly" />
        </header>

        {loading && <div className="rounded-3xl bg-white p-6 shadow-sm">데이터를 불러오는 중입니다...</div>}

        <section className="grid gap-4 md:grid-cols-4">
          <Kpi title="월 목표" value={formatWon(data.totals.target)} />
          <Kpi title="누적 매출" value={formatWon(data.totals.total)} />
          <Kpi title="목표 달성률" value={pct(data.totals.achievementRate)} />
          <Kpi title="착지예측 매출(달성률)" value={formatWon(data.totals.forecast)} sub={pct(data.totals.forecastRate)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card title="주차별 매출 추이">
            <div className="h-80"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weeks}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis tickFormatter={(v) => `${Math.round(Number(v) / 100000000)}억`} /><Tooltip formatter={(v: any) => formatWon(Number(v))} /><Line type="monotone" dataKey="매출" strokeWidth={3} dot /></LineChart>
            </ResponsiveContainer></div>
          </Card>
          <Card title="매장별 전주 vs 금주 매출 TOP10">
            <div className="h-80"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.storeCompare}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="storeName" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} /><YAxis tickFormatter={(v) => `${Math.round(Number(v) / 10000000)}천만`} /><Tooltip formatter={(v: any) => formatWon(Number(v))} /><Bar dataKey="prevWeek" name="전주" fill="#cbd5e1" /><Bar dataKey="thisWeek" name="금주" fill="#111827" /></BarChart>
            </ResponsiveContainer></div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card title="매출관리 필요매장(주간)">
            <div className="space-y-3">{data.attention.length === 0 && <Empty />}{data.attention.map((s:any, i:number) => (
              <div key={s.storeName} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-slate-500">#{i + 1}</p><p className="text-lg font-bold">{s.storeName}</p></div><div className="text-right"><p className={`text-xl font-black ${s.changeRate < 0 ? "text-red-600" : "text-blue-600"}`}>{s.changeRate >= 0 ? "+" : ""}{pct(s.changeRate)}</p><p className="text-xs text-slate-500">전주 대비</p></div></div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm"><Mini label="전주 매출" value={formatWon(s.prevWeek)} /><Mini label="금주 매출" value={formatWon(s.thisWeek)} bold /><Mini label="착지예측" value={pct(s.forecastRate)} /></div>
              </div>
            ))}</div>
          </Card>
          <Card title="상품 TOP10">
            <div className="space-y-3">{data.topProducts.length === 0 && <Empty />}{data.topProducts.map((p:any, i:number) => (
              <div key={p.styleCode || p.productName} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex justify-between gap-4"><div><p className="text-sm text-slate-500">#{i + 1} · {p.styleCode}</p><p className="font-bold">{p.productName}</p></div><div className="text-right"><p className="text-lg font-black">{p.weekSold.toLocaleString("ko-KR")}개</p><p className="text-xs text-slate-500">금주 판매량</p></div></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4"><Mini label="전주 판매량" value={`${p.prevSold.toLocaleString("ko-KR")}개`} /><Mini label="증감률" value={`${p.changeRate >= 0 ? "+" : ""}${pct(p.changeRate)}`} /><Mini label="판매금액" value={formatWon(p.weekAmount || p.salesAmount)} /><Mini label="판매율" value={pct(p.salesRate)} /></div>
              </div>
            ))}</div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card title="주간 매출 리뷰"><ul className="space-y-3 text-sm leading-6 text-slate-700">{data.review.review.map((text:string) => <li key={text}>• {text}</li>)}</ul></Card>
          <Card title="운영 제안"><ul className="space-y-3 text-sm leading-6 text-slate-700">{data.review.suggestions.map((text:string) => <li key={text}>• {text}</li>)}</ul></Card>
        </section>
      </div>
    </main>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub?: string }) { return <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{title}</p><p className="mt-3 text-2xl font-black tracking-tight">{value}</p>{sub && <p className="mt-1 text-sm font-bold text-slate-500">{sub}</p>}</div>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</section>; }
function Mini({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) { return <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 ${bold ? "font-black text-slate-950" : "font-bold text-slate-700"}`}>{value}</p></div>; }
function Empty() { return <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">표시할 데이터가 없습니다.</div>; }
