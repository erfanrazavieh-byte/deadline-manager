import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://deadline-manager.erfan-dev.workers.dev";

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "ددلاین | ابزار رایگان مدیریت زمان، کارها و یادآوری",
    template: "%s | ددلاین",
  },
  description:
    "با ددلاین، کارها و پروژه‌های شخصی و دانشگاهی را ثبت و اولویت‌بندی کنید، تقویم ددلاین‌ها را ببینید و برای موعد تحویل کارها یادآور تنظیم کنید. ابزار آنلاین و رایگان مدیریت وظایف.",
  applicationName: "ددلاین",
  verification: {
    google: "7ofPtXtdxM6vLUJ46NmNwmq8zZ1bbQa8rN5M1t1bJfE",
  },
  keywords: [
    "مدیریت ددلاین",
    "مدیریت زمان",
    "مدیریت کارها",
    "مدیریت وظایف",
    "برنامه ریزی روزانه",
    "یادآور کارها",
    "یادآور آنلاین",
    "تقویم شمسی",
    "پیگیری پروژه",
    "برنامه ریزی دانشجویی",
    "deadline manager",
    "task manager",
    "to do list",
  ],
  category: "productivity",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "ددلاین",
    title: "ددلاین | ابزار رایگان مدیریت زمان، کارها و یادآوری",
    description:
      "کارها و ددلاین‌های شخصی، دانشگاهی و پروژه‌ها را در یک محیط ساده مدیریت کنید؛ با تقویم شمسی و یادآور موعد تحویل.",
  },
  twitter: {
    card: "summary",
    title: "ددلاین | مدیریت زمان و کارها",
    description:
      "ابزار آنلاین مدیریت وظایف، تقویم ددلاین‌ها و یادآوری موعد تحویل کارها.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
