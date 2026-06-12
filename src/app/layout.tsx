import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "VenueFlow",
  description:
    "The CRM built for wedding venues. Capture every enquiry, nurture every couple, book every viewing.",
};

export const viewport = {
  themeColor: "#101833",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased font-sans", dmSans.variable)}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
