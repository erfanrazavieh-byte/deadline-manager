 "use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlarmClock, ArrowDownWideNarrow, Bell, CalendarDays, Check, CheckCheck,
  ChevronDown, Circle, Clock3, LayoutDashboard, ListTodo, MoreHorizontal,
  Plus, Search, Settings2, SlidersHorizontal, Trash2, X, Pencil, ChevronLeft,
  ChevronRight, CalendarClock, CircleAlert, Sparkles, Menu, CheckCircle2
} from "lucide-react";

// تبدیل تاریخ شمسی انتخاب‌شده به رشته میلادی قابل ذخیره در دیتابیس
const momentJalaali: any = require("moment-jalaali");
const jalaliMonths = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const jalaliDaysInMonth = (year: string | number, month: string | number) => {
  const m = Number(month);
  if (m >= 1 && m <= 6) return 31;
  if (m >= 7 && m <= 11) return 30;
  if (m === 12) {
    const start = momentJalaali(`${year}/12/1`, "jYYYY/jM/jD");
    const nextYear = momentJalaali(`${Number(year) + 1}/1/1`, "jYYYY/jM/jD");
    return nextYear.diff(start, "days");
  }
  return 31;
};
const toLocalInputDate = (value: any) => momentJalaali(value).format("YYYY-MM-DDTHH:mm");
const toJalaliParts = (value: string) => {
  const m = momentJalaali(value);
  return { year: String(m.jYear()), month: String(m.jMonth() + 1), day: String(m.jDate()), time: m.format("HH:mm") };
};
const fromJalaliParts = (year: string, month: string, day: string, time: string) =>
  momentJalaali(`${year}/${month}/${day} ${time || "23:59"}`, "jYYYY/jM/jD HH:mm").format("YYYY-MM-DDTHH:mm");

type Status = "todo" | "doing" | "done";
type Priority = "low" | "medium" | "high";
type Category = "دانشگاه" | "کار" | "پروژه شخصی" | "زندگی";
type Reminder = { id: string; at: string; offsetMins?: number; sent?: boolean };
type Task = {
  id: string; title: string; description: string; due: string;
  category: Category; priority: Priority; status: Status; reminders: Reminder[];
  createdAt: string;
};

const categories: Category[] = ["دانشگاه", "کار", "پروژه شخصی", "زندگی"];
const reminderChoices = [
  { v: "10080", l: "۱ هفته قبل" }, { v: "4320", l: "۳ روز قبل" },
  { v: "1440", l: "۱ روز قبل" }, { v: "180", l: "۳ ساعت قبل" }, { v: "30", l: "۳۰ دقیقه قبل" }
];
const parseReminderTime = (value: string) =>
  new Date(/(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(value) ? value : value + "Z").getTime();
const inferReminderOffset = (due: string, reminder: Reminder) => {
  if (typeof reminder.offsetMins === "number") return reminder.offsetMins;
  const diff = (new Date(due).getTime() - parseReminderTime(reminder.at)) / 60000;
  return reminderChoices.reduce((best, item) =>
    Math.abs(Number(item.v) - diff) < Math.abs(Number(best) - diff) ? item.v : best, reminderChoices[0].v);
};
const urlBase64ToUint8Array = (value: string) => {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
};


const faDate = (date: Date, opts: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short", ...opts }).format(date);
const faDateTime = (value: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
}).format(new Date(value));
const timeLeft = (value: string) => {
  const delta = new Date(value).getTime() - Date.now();
  if (delta < 0) return "عقب‌افتاده";
  const mins = Math.floor(delta / 60000);
  const days = Math.floor(mins / 1440), hours = Math.floor((mins % 1440) / 60), minutes = mins % 60;
  if (days) return `${days} روز و ${hours} ساعت باقی‌مانده`;
  if (hours) return `${hours} ساعت و ${minutes} دقیقه باقی‌مانده`;
  if (minutes) return `${minutes} دقیقه باقی‌مانده`;
  return "کمتر از یک دقیقه";
};
const emptyForm = () => ({
  title: "", description: "", due: "", category: "دانشگاه" as Category,
  priority: "medium" as Priority, status: "todo" as Status,
  reminderMins: ["1440"] as string[]
});

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [activeNav, setActiveNav] = useState("همه کارها");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("همه دسته‌ها");
  const [statusFilter, setStatusFilter] = useState("همه وضعیت‌ها");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [jalaliYear, setJalaliYear] = useState(String(momentJalaali().jYear()));
  const [jalaliMonth, setJalaliMonth] = useState(String(momentJalaali().jMonth() + 1));
  const [jalaliDay, setJalaliDay] = useState(String(momentJalaali().jDate()));
  const [deadlineTime, setDeadlineTime] = useState(momentJalaali().format("HH:mm"));
  const syncJalaliDate = (year: string, month: string, day: string, time: string) => {
    const maxDay = jalaliDaysInMonth(year, month);
    const safeDay = String(Math.min(Number(day), maxDay));
    setJalaliYear(year); setJalaliMonth(month); setJalaliDay(safeDay); setDeadlineTime(time);
    const converted = fromJalaliParts(year, month, safeDay, time);
    if (momentJalaali(converted, "YYYY-MM-DDTHH:mm", true).isValid()) setForm(old => ({ ...old, due: converted }));
  };
  const prepareJalaliFields = (value?: string) => {
    const m = value ? momentJalaali(value) : momentJalaali();
    setJalaliYear(String(m.jYear())); setJalaliMonth(String(m.jMonth() + 1)); setJalaliDay(String(m.jDate())); setDeadlineTime(m.format("HH:mm"));
  };
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [permission, setPermission] = useState("default");
  const [toast, setToast] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    setNotifications(localStorage.getItem("deadline-manager-notifications") === "true");
    if ("Notification" in window) setPermission(Notification.permission);
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError("برقراری ارتباط با حساب کاربری ممکن نشد.");
      setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setTasks([]); setReady(true); return; }
    let cancelled = false;
    setReady(false);
    supabase.from("tasks").select("*").eq("user_id", user.id).order("due", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setToast("بارگذاری ددلاین‌ها ناموفق بود: " + error.message);
        else setTasks((data || []).map((row: any) => ({
          id: row.id, title: row.title, description: row.description || "", due: row.due,
          category: row.category, priority: row.priority, status: row.status,
          reminders: row.reminders || [], createdAt: row.created_at
        })));
        setReady(true);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeTasks = tasks.filter(t => t.status !== "done");
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate()+1);
  const todayTasks = activeTasks.filter(t => new Date(t.due) >= todayStart && new Date(t.due) < tomorrow);
  const overdueTasks = activeTasks.filter(t => new Date(t.due).getTime() < Date.now());
  const nextTask = [...activeTasks].filter(t => new Date(t.due).getTime() >= Date.now()).sort((a,b)=>+new Date(a.due)-+new Date(b.due))[0];

  const visibleTasks = useMemo(() => {
    let list = [...tasks];
    if (activeNav === "امروز") list = list.filter(t => new Date(t.due) >= todayStart && new Date(t.due) < tomorrow && t.status !== "done");
    if (activeNav === "۷ روز آینده") {
      const end = new Date(); end.setDate(end.getDate()+7);
      list = list.filter(t => new Date(t.due) >= new Date() && new Date(t.due) <= end && t.status !== "done");
    }
    if (activeNav === "عقب‌افتاده") list = list.filter(t => t.status !== "done" && new Date(t.due) < new Date());
    if (activeNav === "انجام‌شده") list = list.filter(t => t.status === "done");
    if (categoryFilter !== "همه دسته‌ها") list = list.filter(t => t.category === categoryFilter);
    if (statusFilter !== "همه وضعیت‌ها") list = list.filter(t => t.status === statusFilter);
    if (query.trim()) list = list.filter(t => (t.title+" "+t.description).toLowerCase().includes(query.toLowerCase()));
    return list.sort((a,b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      return +new Date(a.due)-+new Date(b.due);
    });
  }, [tasks, activeNav, categoryFilter, statusFilter, query]);

  const openNew = () => {
    const now = momentJalaali();
    const due = now.format("YYYY-MM-DDTHH:mm");
    setEditing(null); setForm({ ...emptyForm(), due }); prepareJalaliFields(due); setModalOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditing(task.id);
    setForm({ title: task.title, description: task.description, due: task.due, category: task.category, priority: task.priority, status: task.status, reminderMins: Array.from(new Set(task.reminders.map(r => String(inferReminderOffset(task.due, r))))) });
    prepareJalaliFields(task.due);
    setModalOpen(true);
  };
  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setToast("ابتدا وارد حساب کاربری شو."); return; }
    if (!form.title.trim() || !form.due) { setToast("عنوان و زمان ددلاین را وارد کن."); return; }
    if (new Date(form.due).getTime() <= 0) { setToast("زمان ددلاین معتبر نیست."); return; }
    if (!ready) { setToast("لطفاً تا پایان بارگذاری صبر کن."); return; }
    if (editing) {
      const existing = tasks.find(t => t.id === editing);
      if (!existing) return;
      const previousByOffset = new Map(existing.reminders.map(r => [String(inferReminderOffset(existing.due, r)), r]));
      const reminders: Reminder[] = form.reminderMins.map((m, i) => {
        const offsetMins = Number(m);
        const previous = previousByOffset.get(m);
        return {
          id: previous?.id || `${Date.now()}-r${i}`,
          at: new Date(new Date(form.due).getTime() - offsetMins * 60000).toISOString(),
          offsetMins,
        };
      });
      const updated: Task = { ...existing, title: form.title.trim(), description: form.description, due: form.due, category: form.category, priority: form.priority, status: form.status, reminders };
      const { error } = await supabase.from("tasks").update({
        title: updated.title, description: updated.description, due: updated.due,
        category: updated.category, priority: updated.priority, status: updated.status, reminders: updated.reminders
      }).eq("id", editing).eq("user_id", user.id);
      if (error) { setToast("ذخیره تغییرات ناموفق بود: " + error.message); return; }
      setTasks(old => old.map(t => t.id === editing ? updated : t));
      setToast("تغییرات ذخیره شد.");
    } else {
      const now = Date.now();
      const reminders: Reminder[] = form.reminderMins.map((m,i) => ({ id: `${now}-r${i}`, at: new Date(new Date(form.due).getTime()-Number(m)*60000).toISOString(), offsetMins: Number(m) }));
      const created: Task = { id: `${now}`, title: form.title.trim(), description: form.description, due: form.due, category: form.category, priority: form.priority, status: form.status, reminders, createdAt: new Date().toISOString() };
      const { error } = await supabase.from("tasks").insert({
        id: created.id, user_id: user.id, title: created.title, description: created.description,
        due: created.due, category: created.category, priority: created.priority, status: created.status,
        reminders: created.reminders, created_at: created.createdAt
      });
      if (error) { setToast("ثبت کار ناموفق بود: " + error.message); return; }
      setTasks(old => [...old, created]);
      setToast("کار جدید اضافه شد.");
    }
    setModalOpen(false);
  };
  const deleteTask = async (task: Task) => {
    if (!user || !window.confirm(`کار «${task.title}» حذف شود؟`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id).eq("user_id", user.id);
    if (error) { setToast("حذف کار ناموفق بود: " + error.message); return; }
    setTasks(old => old.filter(t => t.id !== task.id));
    setToast("کار حذف شد.");
  };
  const toggleDone = async (task: Task) => {
    if (!user) return;
    const status = task.status === "done" ? "todo" : "done";
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id).eq("user_id", user.id);
    if (error) { setToast("تغییر وضعیت ناموفق بود: " + error.message); return; }
    setTasks(old => old.map(t => t.id === task.id ? { ...t, status } : t));
  };
  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(""); setAuthBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
        if (!data.session) setAuthError("حساب ساخته شد. ایمیلت را برای تأیید بررسی کن؛ بعد وارد شو.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(error?.message || "ورود یا ثبت‌نام انجام نشد.");
    } finally { setAuthBusy(false); }
  };
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setToast("خروج انجام نشد: " + error.message);
  };
  const askNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setToast("این مرورگر از اعلان‌های پس‌زمینه پشتیبانی نمی‌کند."); return;
    }
    if (!user) { setToast("ابتدا وارد حساب کاربری شو."); return; }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      const enabled = result === "granted";
      setNotifications(enabled);
      localStorage.setItem("deadline-manager-notifications", String(enabled));
      if (!enabled) { setToast("اجازه اعلان داده نشد."); return; }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setToast("اجازه مرورگر فعال شد؛ برای یادآوری پس‌زمینه باید کلید VAPID در Netlify تنظیم شود.");
        return;
      }
      if (!("PushManager" in window)) {
        setToast("این مرورگر Web Push را پشتیبانی نمی‌کند."); return;
      }
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) throw new Error("کلیدهای اشتراک اعلان دریافت نشد.");
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      setToast("اعلان‌های پس‌زمینه برای این دستگاه فعال شدند.");
    } catch (error: any) {
      setToast("فعال‌سازی اعلان کامل نشد: " + (error?.message || "خطای نامشخص"));
    }
  };
  const testNotification = async () => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      setToast("ابتدا اجازه اعلان را فعال کن."); return;
    }
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification("ددلاین | اعلان آزمایشی", {
          body: "اعلان‌های این دستگاه فعال هستند.",
          data: { url: "/" },
        });
      } else {
        new Notification("ددلاین | اعلان آزمایشی", { body: "اعلان‌های این دستگاه فعال هستند." });
      }
      setToast("اعلان آزمایشی ارسال شد.");
    } catch (error: any) {
      setToast("ارسال اعلان آزمایشی ناموفق بود: " + (error?.message || "خطای نامشخص"));
    }
  };

  const navItems = [
    { name: "نمای کلی", icon: LayoutDashboard },
    { name: "همه کارها", icon: ListTodo, count: activeTasks.length },
    { name: "امروز", icon: CalendarDays, count: todayTasks.length },
    { name: "۷ روز آینده", icon: CalendarClock },
    { name: "عقب‌افتاده", icon: CircleAlert, count: overdueTasks.length },
    { name: "انجام‌شده", icon: CheckCheck }
  ];
  const shownTasks = activeNav === "نمای کلی" ? visibleTasks.filter(t=>t.status!=="done").slice(0,4) : visibleTasks;
  const monthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 0).getDate();
  const monthOffset = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay()+1)%7;
  const taskDaySet = new Set(tasks.map(t => {
    const d = new Date(t.due);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));

  if (authLoading) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f8fc", color: "#25283b", fontFamily: "inherit" }}><p>در حال بررسی حساب کاربری…</p></main>;

  if (!user) return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f7f8fc", color: "#25283b", fontFamily: "inherit" }} dir="rtl">
      <form onSubmit={submitAuth} style={{ width: "100%", maxWidth: 420, background: "white", border: "1px solid #e7e9f1", borderRadius: 20, padding: 28, boxShadow: "0 18px 60px rgba(30,40,80,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}><div style={{ width: 48, height: 48, display: "grid", placeItems: "center", background: "#ecebff", color: "#5d54c6", borderRadius: 14, fontSize: 24 }}>◷</div><div><h1 style={{ margin: 0, fontSize: 26 }}>ددلاین</h1><p style={{ margin: "4px 0 0", color: "#73778b" }}>مدیریت زمان، ساده‌تر</p></div></div>
        <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>{authMode === "signin" ? "ورود به حساب" : "ساخت حساب کاربری"}</h2>
        <p style={{ color: "#73778b", lineHeight: 1.8, margin: "0 0 20px" }}>ددلاین‌هایت در حساب شخصی‌ات ذخیره می‌شوند و از دستگاه‌های مختلف در دسترس‌اند.</p>
        <label style={{ display: "block", marginBottom: 14, fontSize: 14 }}>ایمیل<input type="email" autoComplete="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="name@example.com" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: "12px 14px", border: "1px solid #dfe2ed", borderRadius: 10, font: "inherit", direction: "ltr" }} /></label>
        <label style={{ display: "block", marginBottom: 14, fontSize: 14 }}>رمز عبور<input type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={6} required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="حداقل ۶ نویسه" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: "12px 14px", border: "1px solid #dfe2ed", borderRadius: 10, font: "inherit" }} /></label>
        {authError && <p role="alert" style={{ background: "#fff0f0", color: "#a82d36", padding: 12, borderRadius: 10, fontSize: 13, lineHeight: 1.7 }}>{authError}</p>}
        <button type="submit" disabled={authBusy} style={{ width: "100%", padding: 13, border: 0, borderRadius: 10, background: "#6258d5", color: "white", font: "inherit", fontWeight: 700, cursor: "pointer", marginTop: 8 }}>{authBusy ? "لطفاً صبر کن…" : authMode === "signin" ? "ورود" : "ثبت‌نام"}</button>
        <button type="button" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); }} style={{ width: "100%", marginTop: 14, padding: 10, border: 0, background: "transparent", color: "#5d54c6", font: "inherit", cursor: "pointer" }}>{authMode === "signin" ? "حساب نداری؟ ثبت‌نام کن" : "قبلاً حساب ساخته‌ای؟ وارد شو"}</button>
      </form>
    </main>
  );

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><AlarmClock size={22}/></div><div><strong>ددلاین</strong><span>مدیریت زمان، ساده‌تر</span></div><button className="mobile-close icon-btn" onClick={()=>setMobileMenu(false)} aria-label="بستن"><X size={18}/></button></div>
        <button className="add-task-button" onClick={openNew}><Plus size={18}/> ایجاد کار جدید <span>⌘ K</span></button>
        <div className="nav-caption">فضای کاری</div>
        <nav className="nav-list">
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.name} className={`nav-item ${activeNav===item.name?"active":""}`} onClick={()=>{setActiveNav(item.name);setMobileMenu(false);}}>
              <Icon size={18}/><span>{item.name}</span>{item.count !== undefined && <small>{item.count}</small>}
            </button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="focus-card"><div className="focus-icon"><Sparkles size={17}/></div><strong>قدم‌به‌قدم جلو برو</strong><p>کارهای بزرگ با انجام کارهای کوچک تمام می‌شوند.</p></div>
          <button className={`nav-item ${showSettings?"active":""}`} onClick={()=>{setShowSettings(!showSettings);setMobileMenu(false);}}><Settings2 size={18}/><span>تنظیمات</span></button>
          <div className="profile-row"><div className="avatar">ا</div><div className="profile-text"><strong>فضای شخصی</strong><span>{user.email || "حساب کاربری"}</span></div><MoreHorizontal size={19} className="muted"/></div>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-overlay" onClick={()=>setMobileMenu(false)} aria-label="بستن منو"/>}
      <section className="main-panel">
        <header className="topbar">
          <button className="icon-btn menu-trigger" onClick={()=>setMobileMenu(true)} aria-label="منو"><Menu size={20}/></button>
          <div className="breadcrumbs">فضای کاری <ChevronLeft size={14}/> <strong>{showSettings?"تنظیمات":activeNav}</strong></div>
          <div className="top-actions">
            <div className="date-chip"><CalendarDays size={15}/>{faDate(new Date(), { weekday:"long", year:"numeric" })}</div><button className="secondary-btn compact" onClick={signOut} title={user.email || "خروج از حساب"}>خروج</button>
            <button className={`icon-btn notification-btn ${notifications?"notification-on":""}`} onClick={()=>setShowSettings(!showSettings)} aria-label="تنظیمات اعلان"><Bell size={18}/><i/></button>
          </div>
        </header>

        {showSettings ? (
          <div className="content settings-content">
            <div className="page-heading"><div><div className="eyebrow">شخصی‌سازی</div><h1>تنظیمات</h1><p>تنظیم تجربه کار با ددلاین</p></div></div>
            <div className="settings-card">
              <div className="settings-row"><div className="settings-icon"><Bell size={20}/></div><div className="settings-copy"><strong>اعلان‌های مرورگر</strong><p>برای دریافت یادآور حتی وقتی سایت بسته است، اجازه مرورگر و تنظیمات سرور لازم است.</p><span className={`permission ${permission==="granted"?"ok":""}`}>وضعیت: {permission==="granted"?"فعال":permission==="denied"?"مسدود شده":"نیازمند اجازه"}</span></div><button className="primary-btn compact" onClick={askNotifications}>{notifications?"بررسی مجدد":"فعال‌سازی"}</button></div>
              <div className="settings-row"><div className="settings-icon"><AlarmClock size={20}/></div><div className="settings-copy"><strong>آزمایش اعلان</strong><p>نمایش یک اعلان آزمایشی روی همین دستگاه.</p></div><button className="secondary-btn compact" onClick={testNotification}>ارسال آزمایشی</button></div>
              <div className="settings-note"><CircleAlert size={17}/><span>برای ارسال واقعی، ابتدا فایل SQL داخل پوشه supabase را در SQL Editor اجرا کن و کلیدهای Supabase و VAPID را در متغیرهای محیطی Netlify قرار بده. زمان‌بند سرور هر دقیقه یادآورها را بررسی می‌کند.</span></div>
            </div>
          </div>
        ) : (
          <div className="content">
            <div className="page-heading">
              <div><div className="eyebrow">{activeNav==="نمای کلی"?"خلاصه فعالیت‌ها":"مدیریت وظایف"}</div><h1>{activeNav==="نمای کلی"?"نمای کلی":activeNav}</h1><p>{activeNav==="نمای کلی"?"برنامه امروزت را مرتب کن و با تمرکز جلو برو.":"همه‌چیز را مرتب نگه دار؛ یک کار در هر لحظه."}</p></div>
              <button className="primary-btn" onClick={openNew}><Plus size={18}/> کار جدید</button>
            </div>

            {activeNav==="نمای کلی" && <div className="stats-grid">
              <div className="stat-card"><div className="stat-top"><span>کارهای فعال</span><div className="stat-icon purple"><ListTodo size={18}/></div></div><div className="stat-value">{activeTasks.length.toLocaleString("fa-IR")}</div><div className="stat-foot"><span className="dot purple-dot"/>کار باقی‌مانده</div></div>
              <div className="stat-card"><div className="stat-top"><span>ددلاین امروز</span><div className="stat-icon blue"><CalendarDays size={18}/></div></div><div className="stat-value">{todayTasks.length.toLocaleString("fa-IR")}</div><div className="stat-foot">برای امروز برنامه‌ریزی شده</div></div>
              <div className="stat-card"><div className="stat-top"><span>عقب‌افتاده</span><div className="stat-icon red"><Clock3 size={18}/></div></div><div className="stat-value">{overdueTasks.length.toLocaleString("fa-IR")}</div><div className="stat-foot">{overdueTasks.length?"نیازمند بررسی":"همه‌چیز تحت کنترل"}</div></div>
              <div className="stat-card next-stat"><div className="stat-top"><span>نزدیک‌ترین ددلاین</span><div className="stat-icon green"><AlarmClock size={18}/></div></div><div className="next-title">{nextTask?.title || "ددلاین فعالی نیست"}</div><div className="stat-foot">{nextTask?timeLeft(nextTask.due):"می‌توانی یک کار جدید بسازی"}</div></div>
            </div>}

            <div className="workspace-grid">
              <div className="tasks-section">
                <div className="section-heading"><div><h2>{activeNav==="نمای کلی"?"کارهای پیش رو":`فهرست ${activeNav}`}</h2><span>{shownTasks.length.toLocaleString("fa-IR")} کار</span></div><button className="text-button" onClick={()=>setActiveNav("همه کارها")}>مشاهده همه <ChevronLeft size={15}/></button></div>
                <div className="toolbar">
                  <div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی کارها..."/>{query&&<button onClick={()=>setQuery("")} aria-label="پاک کردن"><X size={14}/></button>}</div>
                  <div className="filter-wrap"><SlidersHorizontal size={15}/><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} aria-label="فیلتر دسته‌بندی"><option>همه دسته‌ها</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
                  <div className="filter-wrap status-filter"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="فیلتر وضعیت"><option value="همه وضعیت‌ها">همه وضعیت‌ها</option><option value="todo">انجام‌نشده</option><option value="doing">در حال انجام</option><option value="done">انجام‌شده</option></select><ChevronDown size={14}/></div>
                </div>
                <div className="task-list">
                  {shownTasks.length===0 ? <div className="empty-state"><div><CheckCircle2 size={27}/></div><strong>کاری برای نمایش نیست</strong><p>فیلترها را تغییر بده یا یک کار جدید اضافه کن.</p><button className="secondary-btn" onClick={openNew}><Plus size={16}/> ایجاد کار</button></div> :
                    shownTasks.map(task => {
                      const late = task.status!=="done" && new Date(task.due).getTime()<Date.now();
                      return <article className={`task-row ${task.status==="done"?"task-completed":""}`} key={task.id}>
                        <button className={`task-check ${task.status==="done"?"checked":""}`} onClick={()=>toggleDone(task)} aria-label={task.status==="done"?"بازگرداندن کار":"تکمیل کار"}>{task.status==="done"&&<Check size={14}/>}</button>
                        <div className="task-main">
                          <div className="task-title-line"><h3>{task.title}</h3>{late&&<span className="late-pill">عقب‌افتاده</span>}</div>
                          {task.description&&<p className="task-description">{task.description}</p>}
                          <div className="task-meta"><span className={`category-tag ${task.category==="دانشگاه"?"cat-study":task.category==="کار"?"cat-work":task.category==="پروژه شخصی"?"cat-project":"cat-life"}`}><i/>{task.category}</span><span className="task-due"><Clock3 size={13}/>{faDateTime(task.due)}</span>{task.reminders.length>0&&<span className="reminder-count"><Bell size={12}/>{task.reminders.length} یادآور</span>}</div>
                        </div>
                        <div className="task-end"><span className={`priority priority-${task.priority}`}>{task.priority==="high"?"زیاد":task.priority==="medium"?"متوسط":"کم"}</span><span className={`time-left ${late?"time-late":""}`}>{task.status==="done"?"انجام‌شده":timeLeft(task.due)}</span></div>
                        <div className="task-actions"><button className="icon-btn small-icon" onClick={()=>openEdit(task)} aria-label="ویرایش"><Pencil size={15}/></button><button className="icon-btn small-icon delete-icon" onClick={()=>deleteTask(task)} aria-label="حذف"><Trash2 size={15}/></button></div>
                      </article>;
                    })
                  }
                </div>
                {activeNav==="نمای کلی"&&<button className="view-all-button" onClick={()=>setActiveNav("همه کارها")}>مشاهده تمام کارها <ChevronLeft size={16}/></button>}
              </div>

              <aside className="right-column">
                <div className="calendar-card">
                  <div className="calendar-head"><div><h2>تقویم ددلاین‌ها</h2><p>{new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric"}).format(calendarMonth)}</p></div><div className="calendar-arrows"><button className="icon-btn" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))} aria-label="ماه قبل"><ChevronRight size={16}/></button><button className="icon-btn" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))} aria-label="ماه بعد"><ChevronLeft size={16}/></button></div></div>
                  <div className="calendar-grid">
                    {["ش","ی","د","س","چ","پ","ج"].map(d=><span key={d} className="weekday">{d}</span>)}
                    {Array.from({length:monthOffset},(_,i)=><span key={`blank-${i}`}/>)}
                    {Array.from({length:monthDays},(_,i)=>{
                      const day=i+1, key=`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}-${day}`;
                      const isToday = new Date().getDate()===day && new Date().getMonth()===calendarMonth.getMonth() && new Date().getFullYear()===calendarMonth.getFullYear();
                      return <button key={day} className={`calendar-day ${isToday?"today":""} ${taskDaySet.has(key)?"has-task":""}`} onClick={()=>{setActiveNav("همه کارها");setQuery("");}}>{day.toLocaleString("fa-IR")}{taskDaySet.has(key)&&<i/>}</button>;
                    })}
                  </div>
                  <div className="calendar-legend"><span><i className="legend-dot"/> دارای ددلاین</span><span><i className="legend-today"/> امروز</span></div>
                </div>
                <div className="upcoming-card"><div className="upcoming-head"><h2>در یک نگاه</h2><span className="upcoming-icon"><AlarmClock size={17}/></span></div>
                  {activeTasks.filter(t=>new Date(t.due)>=new Date()).sort((a,b)=>+new Date(a.due)-+new Date(b.due)).slice(0,3).map((t,i)=><div className="upcoming-item" key={t.id}><div className={`upcoming-line line-${i}`}/><div><strong>{t.title}</strong><span>{faDateTime(t.due)}</span></div><small>{timeLeft(t.due)}</small></div>)}
                  {activeTasks.filter(t=>new Date(t.due)>=new Date()).length===0&&<p className="muted empty-upcoming">ددلاین آینده‌ای ثبت نشده.</p>}
                </div>
                <div className="tip-card"><div className="tip-icon"><Sparkles size={18}/></div><div><strong>یک نکته برای تمرکز</strong><p>کار مهم بعدی را مشخص کن و فقط روی همان تمرکز کن.</p></div></div>
              </aside>
            </div>
          </div>
        )}
      </section>

      {modalOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModalOpen(false);}}><form className="task-modal" onSubmit={saveTask}>
        <div className="modal-head"><div><h2>{editing?"ویرایش کار":"ایجاد کار جدید"}</h2><p>جزئیات کار و زمان تحویل را مشخص کن.</p></div><button type="button" className="icon-btn" onClick={()=>setModalOpen(false)} aria-label="بستن"><X size={19}/></button></div>
        <label className="field-label">عنوان کار <b>*</b><input autoFocus value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="مثلاً تحویل پروژه دانشگاه" required maxLength={120}/></label>
        <label className="field-label">توضیحات <span>اختیاری</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="جزئیات یا یادداشت کوتاه..." rows={3} maxLength={1000}/></label>
        <div className="form-two"><div className="field-label"><span>تاریخ شمسی ددلاین <b>*</b></span><div className="form-two" style={{ gap: 8, marginTop: 8 }}><select aria-label="روز شمسی" value={jalaliDay} onChange={e=>syncJalaliDate(jalaliYear,jalaliMonth,e.target.value,deadlineTime)} required>{Array.from({ length: jalaliDaysInMonth(jalaliYear, jalaliMonth) }, (_,i)=>String(i+1)).map(d=><option key={d} value={d}>{new Intl.NumberFormat("fa-IR").format(Number(d))}</option>)}</select><select aria-label="ماه شمسی" value={jalaliMonth} onChange={e=>syncJalaliDate(jalaliYear,e.target.value,jalaliDay,deadlineTime)}>{jalaliMonths.map((m,i)=><option key={m} value={String(i+1)}>{m}</option>)}</select><select aria-label="سال شمسی" value={jalaliYear} onChange={e=>syncJalaliDate(e.target.value,jalaliMonth,jalaliDay,deadlineTime)}>{Array.from({length: 11},(_,i)=>momentJalaali().jYear()-5+i).map(y=><option key={y} value={String(y)}>{new Intl.NumberFormat("fa-IR").format(y)}</option>)}</select></div><label style={{display:"block",marginTop:10}}>ساعت ددلاین<input type="time" value={deadlineTime} onChange={e=>syncJalaliDate(jalaliYear,jalaliMonth,jalaliDay,e.target.value)} required/></label></div><label className="field-label">دسته‌بندی<select value={form.category} onChange={e=>setForm({...form,category:e.target.value as Category})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
        <div className="form-two"><label className="field-label">اولویت<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})}><option value="low">کم</option><option value="medium">متوسط</option><option value="high">زیاد</option></select></label><label className="field-label">وضعیت<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})}><option value="todo">انجام‌نشده</option><option value="doing">در حال انجام</option><option value="done">انجام‌شده</option></select></label></div>
        <div className="reminder-field"><div className="reminder-label"><Bell size={15}/> یادآورها <span>زمان‌ها نسبت به ددلاین محاسبه می‌شوند</span></div><div className="reminder-options">{reminderChoices.map(r=><label key={r.v} className={`reminder-option ${form.reminderMins.includes(r.v)?"selected":""}`}><input type="checkbox" checked={form.reminderMins.includes(r.v)} onChange={e=>setForm({...form,reminderMins:e.target.checked?[...form.reminderMins,r.v]:form.reminderMins.filter(v=>v!==r.v)})}/>{r.l}</label>)}</div></div>
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setModalOpen(false)}>انصراف</button><button type="submit" className="primary-btn"><Check size={17}/>{editing?"ذخیره تغییرات":"ثبت کار"}</button></div>
      </form></div>}
      {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
      <div className="mobile-bottom"><button onClick={()=>setActiveNav("نمای کلی")} className={activeNav==="نمای کلی"?"selected":""}><LayoutDashboard size={19}/><span>نمای کلی</span></button><button onClick={()=>setActiveNav("همه کارها")} className={activeNav==="همه کارها"?"selected":""}><ListTodo size={19}/><span>کارها</span></button><button onClick={openNew}><Plus size={22}/><span>کار جدید</span></button><button onClick={()=>setShowSettings(true)}><Settings2 size={19}/><span>تنظیمات</span></button></div>
    </main>
  );
}
