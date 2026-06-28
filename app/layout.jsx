import "./globals.css";

export const metadata = {
  title: "GitHub Trending — 뜨는 앱 / 유명한 앱",
  description: "GitHub에서 지금 뜨는 프로젝트와 역대 인기 레포를 찾아보세요.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
