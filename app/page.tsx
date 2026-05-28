"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyze, createReview } from "@/lib/analysis";
import {
  csvUrl,
  fetchCsvRows,
  formatWon,
  parseChannelSales,
  parseProductSales,
} from "@/lib/sheets";

const SHEET_ID =
  process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || "1lQHjJ920HXMazzdD0csxKaVbz1U6VFZg";
const CHANNEL_GID = process.env.NEXT_PUBLIC_CHANNEL_SALES_GID || "565810951";
const PRODUCT_GID = process.env.NEXT_PUBLIC_PRODUCT_SALES_GID || "1439021839";

function Card({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-sm text-gray-500">{sub}</p> : null}
    </div>
  );
}

export default function Home() {
  const [channelRows, setChannelRows] = useState<any[]>([]);
  const [productRows, setProductRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState("");

  async function loadData() {
    setError("");
    try {
      const [channelCsv, productCsv] = await Promise.all([
        fetchCsvRows(csvUrl(SHEET_ID, CHANNEL_GID)),
        fetchCsvRows(csvUrl(SHEET_ID, PRODUCT_GID)),
      ]);
      setChannelRows(parseChannelSales(channelCsv));
      setProductRows(parseProductSales(productCsv));
      setLoadedAt(new Date().toLocaleString("ko-KR"));
    } catch (e: any) {
      setError(e?.message || "데이터를 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(
    () => analyze(channelRows, productRows),
    [channelRows, productRows],
  );

  const review = useMemo(() => createReview(summary), [summary]);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-indigo-600">
              Google Sheets 자동연동
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 md:text-4xl">
              AI 매출 리뷰 대시보드
            </h1>
            <p className="mt-2 text-gray-600">
              월일자별 채널판매와 점별 상품별 판매 데이터를 자동으로 읽어 분석합니다.
            </p>
          </div>
          <button
            onClick={loadData}
            className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white shadow-sm"
          >
            데이터 새로고침
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
            <p className="mt-2 text-sm">
              구글 스프레드시트가 “링크가 있는 모든 사용자 보기 가능”으로 설정되어 있는지 확인하세요.
            </p>
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card title="월 목표" value={formatWon(summary.totalTarget)} />
          <Card title="누적 매출" value={formatWon(summary.totalSales)} />
          <Card
            title="목표 달성률"
            value={`${summary.achievementRate.toFixed(1)}%`}
          />
          <Card
            title="일평균 합계"
            value={formatWon(summary.avgSales)}
            sub={loadedAt ? `갱신: ${loadedAt}` : ""}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">일별 매출 추이</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000000)}M`} />
                  <Tooltip formatter={(v: any) => formatWon(Number(v))} />
                  <Line type="monotone" dataKey="amount" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">매장별 매출 TOP 10</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.topStores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="storeName" hide />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000000)}M`} />
                  <Tooltip
                    labelFormatter={(label) => `매장: ${label}`}
                    formatter={(v: any) => formatWon(Number(v))}
                  />
                  <Bar dataKey="total" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">관리 필요 매장</h2>
            <div className="space-y-3">
              {summary.lowStores.map((store: any) => (
                <div
                  key={`${store.channel}-${store.storeName}`}
                  className="flex items-center justify-between rounded-xl bg-gray-50 p-3"
                >
                  <div>
                    <p className="font-semibold">{store.storeName}</p>
                    <p className="text-sm text-gray-500">
                      매출 {formatWon(store.total)} / 목표 {formatWon(store.target)}
                    </p>
                  </div>
                  <p className="font-bold">{store.achievementRate.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">상품 매출 TOP 10</h2>
            <div className="space-y-3">
              {summary.topProducts.map((item: any) => (
                <div
                  key={`${item.storeName}-${item.styleCode}-${item.productName}`}
                  className="rounded-xl bg-gray-50 p-3"
                >
                  <div className="flex justify-between gap-4">
                    <p className="font-semibold">{item.productName}</p>
                    <p className="whitespace-nowrap font-bold">
                      {formatWon(item.salesAmount)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {item.storeName} · 판매 {item.sold.toLocaleString("ko-KR")}개 · 재고 {item.stock.toLocaleString("ko-KR")}개
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl bg-gray-950 p-6 text-white shadow-sm">
          <h2 className="text-xl font-bold">AI 매출 리뷰 초안</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-white/10 p-4 text-sm leading-7">
            {review}
          </pre>
        </section>
      </div>
    </main>
  );
}
