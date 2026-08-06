import "./globals.css";

import AccessProvider from "../components/access/AccessProvider";

export const metadata = {
  title: {
    default: "SaiNal One",
    template: "%s | SaiNal One",
  },

  description:
    "SaiNal One is an AI-powered Business Operating System by SaiNal Technologies Ltd.",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en">
      <body>
        <AccessProvider>
          {children}
        </AccessProvider>
      </body>
    </html>
  );
}
