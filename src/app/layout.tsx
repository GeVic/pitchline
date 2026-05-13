import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Disco · Ad placement & creative generation",
  description: "Turn a one-sentence advertiser pitch into a draft campaign.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
