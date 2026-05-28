
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
import { analyze } from "@/lib/analysis";
import {
  csvUrl,
  fetchCsvRows,
  formatCompactWon,
  formatWon,
  parseChannelSales,
  parseProductSales,
} from "@/lib/sheets";

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || "1lQHjJ920HXMazzdD0csxKaVbz1U6VFZg";
const CHANNEL_GID = process.env.NEXT_PUBLIC_CHANNEL_SALES_GID || "565810951";
const PRODUCT_GID = process.env.NEXT_PUBLIC_PRODUCT_SALES_GID || "1439021839";

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function plainPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function statusClass(rate: number) {
  if (rate < 70) return "red";
  if (rate < 85) return "orange";
  return "blue";
}

export default function Home() {
  const [channelRows, setChannelRows] = useState<any[]>([]);
  const [productRows, setProductRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [channelRaw, productRaw] = await Promise.all([
        fetchCsvRows(csvUrl(SHEET_ID, CHANNEL_GID)),
        fetchCsvRows(csvUrl(SHEET_ID, PRODUCT_GID)),
      ]);
      setChannelRows(parseChannelSales(channelRaw));
      setProductRows(parseProductSales(productRaw));
    } catch (e: any) {
      setError(e?.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const data = useMemo(() => analyze(channelRows, productRows), [channelRows, productRows]);

  return (
    <main>
      <div className="header">
        <div>
          <h1>오프라인 매출 리뷰 대시보드(소재천)</h1>
          <p className="subtitle">
            Google Sheets 자동연동 · 기준 경과일 {data.elapsedDays}일 / 월 {data.monthDays}일
          </p>
        </div>
        <button onClick={load}>{loading ? "불러오는 중..." : "데이터 새로고침"}</button>
      </div>

      {error ? <div className="notice">{error}</div> : null}

      <section className="grid4">
        <div className="card">
          <div className="kpi-title">월 목표</div>
          <div className="kpi-value">{formatWon(data.totalTarget)}</div>
          <div className="kpi-sub">전체 채널 목표 합계</div>
        </div>
        <div className="card">
          <div className="kpi-title">누적 매출</div>
          <div className="kpi-value">{formatWon(data.totalSales)}</div>
          <div className="kpi-sub">현재 입력 데이터 기준</div>
        </div>
        <div className="card">
          <div className="kpi-title">목표 달성률</div>
          <div className="kpi-value">{plainPct(data.achievementRate)}</div>
          <div className="kpi-sub">누적매출 ÷ 월목표</div>
        </div>
        <div className="card">
          <div className="kpi-title">착지예측 매출(달성률)</div>
          <div className="kpi-value">{formatWon(data.landingSales)}</div>
          <div className="kpi-sub">예상 달성률 {plainPct(data.landingRate)}</div>
        </div>
      </section>

      <section className="grid2">
        <div className="card">
          <h2>일별 매출 추이</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis tickFormatter={(v) => formatCompactWon(Number(v))} />
              <Tooltip formatter={(v: any) => formatWon(Number(v))} />
              <Line type="monotone" dataKey="sales" name="매출" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>매장별 매출 TOP10</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.topStores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={72} />
              <YAxis tickFormatter={(v) => formatCompactWon(Number(v))} />
              <Tooltip
                formatter={(v: any, n: any) => [formatWon(Number(v)), n === "sales" ? "매출" : n]}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="sales" name="매출" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid2">
        <div className="card">
          <h2>매출관리 필요매장(주간)</h2>
          <p className="subtitle" style={{ marginBottom: 10 }}>
            기준: 금주 {data.ranges.thisWeekLabel} vs 전주 {data.ranges.lastWeekLabel} · 전주비 등락폭 + 착지예측 위험 기준
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>매장명</th>
                <th>전주비</th>
                <th>착지예측</th>
                <th>부족예상</th>
              </tr>
            </thead>
            <tbody>
              {data.managedStores.map((row: any) => (
                <tr key={row.name}>
                  <td><strong>{row.name}</strong></td>
                  <td>
                    <span className={row.weeklyChangeRate !== null && row.weeklyChangeRate < 0 ? "down" : "up"}>
                      {pct(row.weeklyChangeRate)}
                    </span>
                    <div className="muted">{formatCompactWon(row.lastWeekSales)} → {formatCompactWon(row.thisWeekSales)}</div>
                  </td>
                  <td>
                    <span className={`badge ${statusClass(row.landingRate)}`}>{plainPct(row.landingRate)}</span>
                    <div className="muted">{formatCompactWon(row.landingSales)}</div>
                  </td>
                  <td>{formatCompactWon(row.shortage)}</td>
                </tr>
              ))}
              {data.managedStores.length === 0 ? (
                <tr><td colSpan={4} className="muted">표시할 관리 필요 매장이 없습니다.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>상품 TOP10</h2>
          <p className="subtitle" style={{ marginBottom: 10 }}>
            기준: 금주 판매량 높은 순 · T~W열 금주 / X~AA열 전주 합계 비교
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>상품</th>
                <th>금주</th>
                <th>전주</th>
                <th>증감률</th>
                <th>판매금액</th>
              </tr>
            </thead>
            <tbody>
              {data.productTop10.map((row: any, index: number) => (
                <tr key={`${row.styleCode}-${index}`}>
                  <td>
                    <strong>{index + 1}. {row.productName}</strong>
                    <div className="muted">{row.styleCode}</div>
                  </td>
                  <td>{row.thisWeekQty.toLocaleString("ko-KR")}</td>
                  <td>{row.lastWeekQty.toLocaleString("ko-KR")}</td>
                  <td>
                    <span className={row.qtyChangeRate !== null && row.qtyChangeRate < 0 ? "down" : "up"}>
                      {pct(row.qtyChangeRate)}
                    </span>
                  </td>
                  <td>
                    {formatCompactWon(row.salesAmount)}
                    <div className="muted">판매율 {plainPct(row.sellThrough)}</div>
                  </td>
                </tr>
              ))}
              {data.productTop10.length === 0 ? (
                <tr><td colSpan={5} className="muted">상품 데이터가 없습니다. 상품 시트의 T~AA열 위치를 확인해주세요.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
