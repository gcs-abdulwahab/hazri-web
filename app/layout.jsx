import "./globals.css";

export const metadata = {
  title: "Hazri Register",
  description: "Class attendance for teachers.",
};

export const viewport = {
  themeColor: "#2443B5",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&display=swap"
        />
        <link rel="stylesheet" href="/legacy/styles.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
