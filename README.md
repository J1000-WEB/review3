# AI 매출 리뷰 대시보드

구글 스프레드시트 공개 CSV를 자동으로 읽어 매출 리뷰를 보여주는 Next.js + Vercel용 웹앱입니다.

## Vercel 환경변수

아래 값을 Vercel Project Settings → Environment Variables에 입력하세요.

```text
NEXT_PUBLIC_GOOGLE_SHEET_ID=1lQHjJ920HXMazzdD0csxKaVbz1U6VFZg
NEXT_PUBLIC_CHANNEL_SALES_GID=565810951
NEXT_PUBLIC_PRODUCT_SALES_GID=1439021839
```

## 구글 스프레드시트 설정

공유 → 링크가 있는 모든 사용자 → 뷰어

## 로컬 실행

```bash
npm install
npm run dev
```

## 배포

GitHub에 이 폴더 안의 파일들을 저장소 루트에 올린 뒤 Vercel에서 Import Project 하면 됩니다.
