# ددلاین — Deadline Manager

وب‌اپلیکیشن فارسی و راست‌چین برای ثبت، اولویت‌بندی و مدیریت ددلاین‌ها.

## امکانات نسخه فعلی
- داشبورد و آمار کارهای فعال، امروز و عقب‌افتاده
- ایجاد، ویرایش، حذف و تکمیل کار
- مرتب‌سازی خودکار کارهای فعال بر اساس نزدیک‌ترین ددلاین
- جست‌وجو و فیلتر دسته‌بندی/وضعیت
- تقویم ماهانه و نمایش تاریخ شمسی در رابط
- یادآورهای پیشنهادی نسبت به ددلاین هنگام ساخت کار
- ذخیره کارها در `localStorage` مرورگر
- درخواست اجازه اعلان مرورگر و اعلان آزمایشی
- طراحی واکنش‌گرا برای موبایل و دسکتاپ

## اجرا
نیازمندی: Node.js 20 یا جدیدتر و npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

سپس `http://localhost:3000` را باز کنید.

برای ساخت نسخه production:
```bash
npm run build
npm start
```

## وضعیت مهم قابلیت‌ها
این پوشه یک نسخه اولیه قابل اجرا در سمت کاربر است. هنوز یک سامانه production-ready برای یادآوری پایدار نیست:
- داده‌ها در مرورگر ذخیره می‌شوند؛ ثبت‌نام/ورود و PostgreSQL پیاده‌سازی نشده‌اند.
- یادآورها فعلاً به‌عنوان داده کار ذخیره می‌شوند، اما زمان‌بند سمت سرور برای اجرای آن‌ها وجود ندارد.
- اعلان آزمایشی فقط وقتی مرورگر و صفحه مجاز باشند، از API اعلان مرورگر استفاده می‌کند. Web Push واقعی، Service Worker، Push subscription و ارسال زمان‌بندی‌شده از backend هنوز پیاده‌سازی نشده‌اند.
- انتخاب زمان در فرم با منطقه زمانی محلی دستگاه کار می‌کند؛ تنظیم مستقل منطقه زمانی و پشتیبانی چندکاربره نیازمند backend است.
- نمونه‌کارهای اولیه صرفاً برای پر شدن داشبورد هستند و می‌توان آن‌ها را حذف کرد.

## معماری پیشنهادی برای نسخه عملیاتی
- Next.js App Router + TypeScript برای UI و API
- PostgreSQL با Prisma برای کاربران، کارها، اشتراک‌های Push و یادآورها
- احراز هویت امن با Auth.js یا سرویس معتبر مدیریت هویت
- Web Push با `web-push`, VAPID و Service Worker
- صف/زمان‌بند پایدار مانند pg-boss یا BullMQ + Redis، به‌همراه retry و کلید یکتای idempotency
- ارسال اعلان از backend و ثبت وضعیت `pending/sent/failed`
- کنترل دسترسی هر رکورد بر اساس `userId` در تمام APIها

## مدل داده پیشنهادی
- `User(id, email, passwordHash/providerId, createdAt)`
- `Task(id, userId, title, description, dueAt, timezone, category, priority, status, createdAt, updatedAt)`
- `Reminder(id, taskId, userId, scheduledAt, status, sentAt, idempotencyKey, attempts, lastError)`
- `PushSubscription(id, userId, endpoint, p256dh, auth, createdAt, revokedAt)`

در نسخه عملیاتی، زمان یادآور باید در سرور به UTC ذخیره شود و منطقه زمانی IANA کاربر جداگانه نگه‌داری شود. با تغییر ددلاین، یادآورهای زمان‌بندی‌نشده باید در یک تراکنش باززمان‌بندی شوند. برای جلوگیری از اعلان تکراری، کلید idempotency یکتا و قفل/claim اتمیک روی کارهای آماده ارسال لازم است. برای استقرار عمومی، از HTTPS و مدیریت امن secrets استفاده کنید.

## متغیرهای محیطی نسخه عملیاتی
مقادیر واقعی را در `.env.local` قرار دهید و آن‌ها را در مخزن Git منتشر نکنید:
```dotenv
DATABASE_URL=
AUTH_SECRET=
NEXT_PUBLIC_APP_URL=https://your-domain.example
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@your-domain.example
REDIS_URL=
```

## استقرار
این نسخه UI را می‌توان روی یک میزبان پشتیبان Next.js مستقر کرد. برای اعلان پایدار در زمان تعیین‌شده، قبل از استفاده واقعی باید API، دیتابیس، زمان‌بند/صف، Service Worker، ذخیره اشتراک‌ها و تست end-to-end تکمیل شوند. HTTPS برای Web Push در محیط عمومی ضروری است (به‌جز localhost در توسعه).

## فعال‌سازی یادآورهای واقعی (Web Push)

برای دریافت اعلان حتی وقتی صفحه سایت باز نیست، این مراحل را یک‌بار انجام بده:

1. در Supabase وارد **SQL Editor** شو، فایل `supabase/push-notifications.sql` را باز کن و تمام محتوای آن را اجرا کن. این فایل جدول اشتراک اعلان‌ها، گزارش ارسال و تابع امن زمان‌بندی را ایجاد می‌کند.
2. روی کامپیوتری که Node.js دارد، در ریشه پروژه اجرا کن:
   ```bash
   node scripts/generate-vapid-keys.mjs
   ```
   خروجی چهار متغیر را نگه دار. برای `VAPID_SUBJECT` یک ایمیل واقعی وارد کن.
3. در Netlify وارد **Site configuration → Environment variables** شو و این متغیرها را تنظیم کن:
   - `NEXT_PUBLIC_SUPABASE_URL` (همان URL پروژه Supabase)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (کلید عمومی anon/publishable)
   - `SUPABASE_SERVICE_ROLE_KEY` (کلید محرمانه service_role از تنظیمات API پروژه Supabase)
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
   - `SCHEDULER_SECRET` (یک مقدار تصادفی و طولانی؛ فقط برای فراخوانی دستی تابع)
4. پس از ذخیره متغیرها، سایت را دوباره Deploy کن.
5. در سایت با حساب خودت وارد شو، از **تنظیمات → اعلان‌های مرورگر → فعال‌سازی** استفاده کن و اجازه اعلان را بده. برای هر دستگاه/مرورگر این کار باید جداگانه انجام شود.

تابع `netlify/functions/send-reminders.mjs` هر دقیقه یادآورهای رسیده را بررسی می‌کند. ارسال واقعی به اجرای موفق SQL، تنظیم درست متغیرهای محیطی، مجوز اعلان و پشتیبانی مرورگر/سیستم‌عامل وابسته است. اگر سایت از قبل یک جدول `tasks` با ساختار متفاوت از ستون‌های استفاده‌شده در این پروژه دارد، قبل از اجرای SQL ساختار جدول را بررسی کن. کلید `SUPABASE_SERVICE_ROLE_KEY` و `VAPID_PRIVATE_KEY` را هرگز با پیشوند `NEXT_PUBLIC_` تعریف نکن و در GitHub قرار نده.
