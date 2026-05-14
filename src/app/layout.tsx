import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pitchline · From a one-line pitch to a full campaign",
  description:
    "Paste an advertiser pitch. Get publisher picks, persona-tuned ad creative, and a structured campaign config — streamed stage-by-stage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="ambient-glow" aria-hidden />
        {children}
      </body>
    </html>
  );
}
