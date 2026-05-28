import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 매출 리뷰 대시보드",
  description: "구글 스프레드시트 자동연동 매출 리뷰 웹앱",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
