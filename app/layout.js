import "./globals.css";

export const metadata = {
  title: "SaiNal One",
  description: "AI-powered CRM by SaiNal Technologies Ltd",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
