import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ددلاین | مدیریت زمان و کارها",
  description: "مدیریت متمرکز کارها و ددلاین‌های شخصی",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}