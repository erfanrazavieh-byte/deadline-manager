 "use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlarmClock, ArrowDownWideNarrow, Bell, CalendarDays, Check, CheckCheck, Sun, Moon,
  ChevronDown, Circle, Clock3, LayoutDashboard, ListTodo, MoreHorizontal,
  Plus, Search, Settings2, SlidersHorizontal, Trash2, X, Pencil, ChevronLeft,
  ChevronRight, CalendarClock, CircleAlert, Menu, CheckCircle2
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

const GUEST_OWNER_ID = "4b6ecd57-26b8-464f-bd24-dcda12ce4356";
type Status = "todo" | "doing" | "done";
type Priority = "low" | "medium" | "high";
type Category = "دانشگاه" | "کار" | "پروژه شخصی" | "زندگی";
type Reminder = { id: string; at: string; sent?: boolean };
type PeriodicReminder = { id: string; user_id: string; title: string; message: string; schedule_type: "interval" | "daily"; interval_minutes: number | null; daily_time: string | null; timezone: string; next_run_at: string; enabled: boolean; created_at?: string; updated_at?: string };
type Task = {
  id: string; title: string; description: string; due: string;
  category: Category; priority: Priority; status: Status; reminders: Reminder[];
  createdAt: string;
};

const categories: Category[] = ["دانشگاه", "کار", "پروژه شخصی", "زندگی"];





const faDate = (date: Date, opts: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short", ...opts }).format(date);
const faDateTime = (value: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
}).format(new Date(value));
const timeLeft = (value: string, now: number = Date.now()) => {
  const delta = new Date(value).getTime() - now;
  const totalSeconds = Math.floor(Math.abs(delta) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const countdown = days > 0
    ? `${days.toLocaleString("en-US")} روز ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return delta < 0 ? `${countdown} تأخیر` : countdown;
};
const emptyForm = () => ({
  title: "", description: "", due: "", category: "دانشگاه" as Category,
  priority: "medium" as Priority, status: "todo" as Status,
  reminderMins: ["1440"] as string[]
});

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const [ready, setReady] = useState(false);
  const [activeNav, setActiveNav] = useState("همه کارها");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("همه دسته‌ها");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [jalaliYear, setJalaliYear] = useState(String(momentJalaali().jYear()));
  const [jalaliMonth, setJalaliMonth] = useState(String(momentJalaali().jMonth() + 1));
  const [jalaliDay, setJalaliDay] = useState(String(momentJalaali().jDate()));
  const [deadlineTime, setDeadlineTime] = useState(momentJalaali().format("HH:mm"));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(String(momentJalaali().jYear()));
  const [pickerMonth, setPickerMonth] = useState(String(momentJalaali().jMonth() + 1));
  const [pickerDay, setPickerDay] = useState(String(momentJalaali().jDate()));
  const openDatePicker = () => {
    setPickerYear(jalaliYear); setPickerMonth(jalaliMonth); setPickerDay(jalaliDay);
    setDatePickerOpen(true);
  };
  const shiftPickerMonth = (amount: number) => {
    const next = momentJalaali(`${pickerYear}/${pickerMonth}/1`, "jYYYY/jM/jD").add(amount, "jMonth");
    setPickerYear(String(next.jYear())); setPickerMonth(String(next.jMonth() + 1));
  };
  const chooseQuickDate = (days: number) => {
    const target = momentJalaali().add(days, "days");
    setPickerYear(String(target.jYear())); setPickerMonth(String(target.jMonth() + 1)); setPickerDay(String(target.jDate()));
  };
  const chooseEndOfMonth = () => {
    const target = momentJalaali(`${pickerYear}/${pickerMonth}/1`, "jYYYY/jM/jD").endOf("jMonth");
    setPickerDay(String(target.jDate()));
  };
  const confirmPickedDate = () => {
    syncJalaliDate(pickerYear, pickerMonth, pickerDay, deadlineTime);
    setDatePickerOpen(false);
  };
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
  const [showPeriodic, setShowPeriodic] = useState(false);
  const [periodicReminders, setPeriodicReminders] = useState<PeriodicReminder[]>([]);
  const [periodicLoading, setPeriodicLoading] = useState(false);
  const [periodicTitle, setPeriodicTitle] = useState("");
  const [periodicMessage, setPeriodicMessage] = useState("");
  const [periodicType, setPeriodicType] = useState<"interval" | "daily">("interval");
  const [periodicHours, setPeriodicHours] = useState("1");
  const [periodicMinutes, setPeriodicMinutes] = useState("30");
  const [periodicDailyTime, setPeriodicDailyTime] = useState("18:30");
  const [periodicSaving, setPeriodicSaving] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [permission, setPermission] = useState("default");
  const [toast, setToast] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [user, setUser] = useState<{ id: string; email?: string; guest?: boolean } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const updateClock = () => setClockNow(Date.now());
    updateClock();
    const clock = window.setInterval(updateClock, 1_000);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("deadline-manager-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    setNotifications(localStorage.getItem("deadline-manager-notifications") === "true");
    if ("Notification" in window) setPermission(Notification.permission);
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError("برقراری ارتباط با حساب کاربری ممکن نشد.");
      setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email, guest: data.session.user.is_anonymous === true || data.session.user.app_metadata?.provider === "anonymous" } : null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email, guest: session.user.is_anonymous === true || session.user.app_metadata?.provider === "anonymous" } : null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setTasks([]); setReady(true); return; }
    let cancelled = false;
    setReady(false);
    const taskQuery = supabase.from("tasks").select("id,title,description,due,category,priority,status,reminders,created_at").eq("user_id", user.guest ? GUEST_OWNER_ID : user.id);
    if (user.guest) taskQuery.eq("category", "دانشگاه");
    taskQuery.order("due", { ascending: true }).then(({ data, error }) => {
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
    if (!user?.id || user.guest) { setPeriodicReminders([]); setPeriodicLoading(false); return; }
    let cancelled = false;
    setPeriodicLoading(true);
    supabase.from("periodic_reminders").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setToast("بارگذاری یادآورهای دوره‌ای ناموفق بود: " + error.message);
        else setPeriodicReminders((data || []) as PeriodicReminder[]);
        setPeriodicLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!user?.id || user.guest || !notifications || permission !== "granted" || !("Notification" in window)) return;
    let cancelled = false;
    let checking = false;
    let interval: number | undefined;

    const checkReminders = async () => {
      if (cancelled || checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const registration = await getNotificationRegistration();
        if (cancelled) return;
        const now = Date.now();
        for (const task of tasks) {
          if (cancelled) break;
          if (task.status === "done") continue;
          for (const reminder of task.reminders || []) {
            if (cancelled) break;
            const key = `deadline-manager-sent-${user.id}-${task.id}-${reminder.id}`;
            if (localStorage.getItem(key) === "true") continue;
            const reminderTime = new Date(reminder.at).getTime();
            if (!Number.isFinite(reminderTime)) continue;
            // Send due reminders when the page is open, including reminders up to 24 hours late.
            // Older reminders are marked handled to avoid a burst of stale notifications.
            if (reminderTime < now - 24 * 60 * 60 * 1000) {
              localStorage.setItem(key, "true");
              continue;
            }
            if (reminderTime <= now) {
              await registration.showNotification("یادآوری ددلاین", {
                body: task.title,
                tag: `deadline-${task.id}-${reminder.id}`,
                data: { url: "/" }
              });
              localStorage.setItem(key, "true");
            }
          }
        }
      } catch (error) {
        setToast("بررسی یادآوری‌ها ناموفق بود: " + (error instanceof Error ? error.message : "خطای اعلان"));
      } finally {
        checking = false;
      }
    };

    void checkReminders();
    interval = window.setInterval(() => { void checkReminders(); }, 5000);
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void checkReminders(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [tasks, user?.id, user?.guest, notifications, permission]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search-box input")?.focus();
      } else if (!typing && event.key.toLowerCase() === "n" && !modalOpen && user && !user.guest) {
        event.preventDefault();
        openNew();
      } else if (event.key === "Escape") {
        setModalOpen(false); setDatePickerOpen(false); setMobileMenu(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, user?.id]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (theme === "system") localStorage.removeItem("deadline-manager-theme");
    else localStorage.setItem("deadline-manager-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const currentlyDark = theme === "dark" || (theme === "system" && systemDark);
    setTheme(currentlyDark ? "light" : "dark");
  };
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
    if (query.trim()) list = list.filter(t => (t.title+" "+t.description).toLowerCase().includes(query.toLowerCase()));
    return list.sort((a,b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      return +new Date(a.due)-+new Date(b.due);
    });
  }, [tasks, activeNav, categoryFilter, query]);

  const openNew = () => {
    const now = momentJalaali();
    const due = now.format("YYYY-MM-DDTHH:mm");
    setEditing(null); setForm({ ...emptyForm(), due }); prepareJalaliFields(due); setModalOpen(true);
  };
  const reminderChoices = [{v:"20160",l:"دو هفته قبل"},{v:"10080",l:"۱ هفته قبل"},{v:"4320",l:"۳ روز قبل"},{v:"2880",l:"۲ روز قبل"},{v:"1440",l:"۱ روز قبل"},{v:"180",l:"۳ ساعت قبل"}];
  const openEdit = (task: Task) => {
    const offsets = (task.reminders || []).map(r => Math.round((new Date(task.due).getTime() - new Date(r.at).getTime()) / 60000));
    const reminderMins = reminderChoices
      .filter(choice => offsets.some(offset => Math.abs(offset - Number(choice.v)) <= 240))
      .map(choice => choice.v);
    setEditing(task.id);
    setForm({ title: task.title, description: task.description, due: task.due, category: task.category, priority: task.priority, status: task.status, reminderMins });
    prepareJalaliFields(task.due);
    setModalOpen(true);
  };
  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.guest) { setToast("در حالت مهمان امکان تغییر ددلاین وجود ندارد."); return; }
    if (!form.title.trim() || !form.due) { setToast("عنوان و زمان ددلاین را وارد کن."); return; }
    if (new Date(form.due).getTime() <= 0) { setToast("زمان ددلاین معتبر نیست."); return; }
    if (!ready) { setToast("لطفاً تا پایان بارگذاری صبر کن."); return; }
    if (editing) {
      const existing = tasks.find(t => t.id === editing);
      if (!existing) return;
      const now = Date.now();
      const reminders = form.reminderMins.map((m,i) => ({ id: `${now}-r${i}`, at: new Date(new Date(form.due).getTime()-Number(m)*60000).toISOString() }));
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
      const reminders = form.reminderMins.map((m,i) => ({ id: `${now}-r${i}`, at: new Date(new Date(form.due).getTime()-Number(m)*60000).toISOString() }));
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
    if (!user || user.guest || !window.confirm(`کار «${task.title}» حذف شود؟`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id).eq("user_id", user.id);
    if (error) { setToast("حذف کار ناموفق بود: " + error.message); return; }
    setTasks(old => old.filter(t => t.id !== task.id));
    setToast("کار حذف شد.");
  };
  const toggleDone = async (task: Task) => {
    if (!user || user.guest) return;
    const status = task.status === "done" ? "todo" : "done";
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id).eq("user_id", user.id);
    if (error) { setToast("تغییر وضعیت ناموفق بود: " + error.message); return; }
    setTasks(old => old.map(t => t.id === task.id ? { ...t, status } : t));
  };
  const signInGuest = async () => {
    setAuthBusy(true); setAuthError("");
    const { error } = await supabase.auth.signInAnonymously();
    if (error) setAuthError("ورود مهمان انجام نشد: " + error.message);
    setAuthBusy(false);
  };

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(""); setAuthBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword, options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : "https://deadline-manager.erfan-dev.workers.dev/" } });
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
  const getNotificationRegistration = async () => {
    if (!("serviceWorker" in navigator)) throw new Error("این مرورگر از Service Worker پشتیبانی نمی‌کند.");
    if (!window.isSecureContext) throw new Error("اعلان‌ها فقط در اتصال امن HTTPS قابل استفاده‌اند.");
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return registration;
  };

  const askNotifications = async () => {
    if (!("Notification" in window)) { setToast("این مرورگر از اعلان‌های وب پشتیبانی نمی‌کند."); return; }
    if (!user) { setToast("ابتدا وارد حساب کاربری شو."); return; }
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) { setToast("کلید VAPID هنوز در تنظیمات محیطی سایت ثبت نشده است."); return; }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      const enabled = result === "granted";
      if (!enabled) { setNotifications(false); localStorage.setItem("deadline-manager-notifications", "false"); setToast("اجازه اعلان داده نشد؛ مجوز اعلان سایت را در تنظیمات مرورگر بررسی کن."); return; }
      const registration = await getNotificationRegistration();
      const normalizedVapidKey = vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/");
      const paddedVapidKey = normalizedVapidKey.padEnd(Math.ceil(normalizedVapidKey.length / 4) * 4, "=");
      const applicationServerKey = Uint8Array.from(atob(paddedVapidKey), c => c.charCodeAt(0));
      // Reuse the current subscription when it already exists. Calling subscribe()
      // again can fail in some browser push services even when push is already working.
      let pushSubscription = await registration.pushManager.getSubscription();
      if (pushSubscription && pushSubscription.options.applicationServerKey) {
        const existingKey = new Uint8Array(pushSubscription.options.applicationServerKey);
        const sameKey =
          existingKey.length === applicationServerKey.length &&
          existingKey.every((byte, index) => byte === applicationServerKey[index]);
        if (!sameKey) {
          await pushSubscription.unsubscribe();
          pushSubscription = null;
        }
      }
      if (!pushSubscription) {
        pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }
      const serialized = pushSubscription.toJSON();
      const endpoint = serialized.endpoint;
      const p256dh = serialized.keys?.p256dh;
      const auth = serialized.keys?.auth;
      if (!endpoint || !p256dh || !auth) {
        throw new Error("اطلاعات اشتراک اعلان کامل نیست؛ اعلان را دوباره فعال کن.");
      }
      const { data: existing, error: lookupError } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("endpoint", endpoint)
        .maybeSingle();
      if (lookupError) throw lookupError;
      const subscriptionData = {
        user_id: user.id,
        guest_for_user_id: user.guest ? GUEST_OWNER_ID : null,
        endpoint,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      };
      const save = existing
        ? await supabase.from("push_subscriptions").update(subscriptionData).eq("id", existing.id).eq("user_id", user.id)
        : await supabase.from("push_subscriptions").insert(subscriptionData);
      if (save.error) throw save.error;
      setNotifications(true);
      localStorage.setItem("deadline-manager-notifications", "true");
      setToast("اعلان‌های این دستگاه برای دریافت یادآورها فعال شد.");
    } catch (error: any) {
      const detail = error?.message ? `${error?.name ? error.name + ": " : ""}${error.message}` : String(error || "خطای ناشناخته");
      setToast("فعال‌سازی اعلان ناموفق بود: " + detail);
    }
  };


  const shiftTaskDue = async (task: Task, days: number) => {
    if (!user || user.guest) return;
    const due = new Date(task.due);
    due.setDate(due.getDate() + days);
    const nextDue = due.toISOString();
    const reminders = (task.reminders || []).map(reminder => {
      const offset = new Date(task.due).getTime() - new Date(reminder.at).getTime();
      return { ...reminder, at: new Date(due.getTime() - offset).toISOString(), sent: false };
    });
    const { error } = await supabase.from("tasks").update({ due: nextDue, reminders }).eq("id", task.id).eq("user_id", user!.id);
    if (error) { setToast("تغییر ددلاین ذخیره نشد: " + error.message); return; }
    setTasks(prev => prev.map(item => item.id === task.id ? { ...item, due: nextDue, reminders } : item));
    setToast("ددلاین به فردا منتقل شد.");
  };

  const testNotification = async () => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      setToast("ابتدا «فعال‌سازی» را بزن و اجازه اعلان را بده.");
      return;
    }
    try {
      const registration = await getNotificationRegistration();
      await registration.showNotification("ددلاین | اعلان آزمایشی", {
        body: "اعلان‌های این دستگاه فعال هستند.",
        tag: "deadline-manager-test",
        data: { url: "/" }
      });
      setToast("درخواست اعلان آزمایشی ارسال شد؛ نوار اعلان و تنظیمات گوشی را بررسی کن.");
    } catch (error) {
      setToast("ارسال اعلان ناموفق بود: " + (error instanceof Error ? error.message : "خطای ناشناخته"));
    }
  };

  const savePeriodicReminder = async (event: any) => {
    event.preventDefault();
    if (!user?.id) { setToast("ابتدا وارد حساب کاربری شو."); return; }
    const title = periodicTitle.trim();
    const message = periodicMessage.trim();
    if (!title || !message) { setToast("عنوان و متن اعلان را وارد کن."); return; }
    const duration = Number(periodicHours) * 60 + Number(periodicMinutes);
    if (periodicType === "interval" && (!Number.isInteger(duration) || duration < 1 || duration > 525600)) {
      setToast("فاصله زمانی باید بین ۱ دقیقه تا یک سال باشد."); return;
    }
    if (periodicType === "daily" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(periodicDailyTime)) {
      setToast("ساعت روزانه را درست انتخاب کن."); return;
    }

    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran";
    let nextRun = new Date(now.getTime() + duration * 60_000);
    if (periodicType === "daily") {
      const [hour, minute] = periodicDailyTime.split(":").map(Number);
      nextRun = new Date(now);
      nextRun.setHours(hour, minute, 0, 0);
      if (nextRun.getTime() <= now.getTime()) nextRun.setDate(nextRun.getDate() + 1);
    }

    setPeriodicSaving(true);
    const { data, error } = await supabase.from("periodic_reminders").insert({
      user_id: user.id,
      title,
      message,
      schedule_type: periodicType,
      interval_minutes: periodicType === "interval" ? duration : null,
      daily_time: periodicType === "daily" ? periodicDailyTime : null,
      timezone,
      next_run_at: nextRun.toISOString(),
      enabled: true
    }).select("*").single();
    setPeriodicSaving(false);
    if (error) { setToast("ثبت یادآور ناموفق بود: " + error.message); return; }
    setPeriodicReminders(current => [data as PeriodicReminder, ...current]);
    setPeriodicTitle("");
    setPeriodicMessage("");
    setToast("یادآور دوره‌ای ثبت شد.");
  };

  const togglePeriodicReminder = async (item: PeriodicReminder) => {
    const enabled = !item.enabled;
    let nextRun = item.next_run_at;
    if (enabled && new Date(nextRun).getTime() <= Date.now()) {
      const now = new Date();
      if (item.schedule_type === "interval") {
        nextRun = new Date(now.getTime() + Math.max(1, item.interval_minutes || 1) * 60_000).toISOString();
      } else if (item.daily_time) {
        const [hour, minute] = item.daily_time.slice(0, 5).split(":").map(Number);
        const candidate = new Date(now);
        candidate.setHours(hour, minute, 0, 0);
        if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
        nextRun = candidate.toISOString();
      }
    }
    const { data, error } = await supabase.from("periodic_reminders")
      .update({ enabled, next_run_at: nextRun, updated_at: new Date().toISOString() })
      .eq("id", item.id).eq("user_id", user?.id).select("*").single();
    if (error) { setToast("تغییر وضعیت یادآور ناموفق بود: " + error.message); return; }
    setPeriodicReminders(current => current.map(row => row.id === item.id ? data as PeriodicReminder : row));
    setToast(enabled ? "یادآور فعال شد." : "یادآور غیرفعال شد.");
  };

  const deletePeriodicReminder = async (item: PeriodicReminder) => {
    const { error } = await supabase.from("periodic_reminders").delete().eq("id", item.id).eq("user_id", user?.id);
    if (error) { setToast("حذف یادآور ناموفق بود: " + error.message); return; }
    setPeriodicReminders(current => current.filter(row => row.id !== item.id));
    setToast("یادآور حذف شد.");
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
  const calendarJalali = momentJalaali(calendarMonth);
  const calendarJYear = calendarJalali.jYear();
  const calendarJMonth = calendarJalali.jMonth() + 1;
  const monthDays = jalaliDaysInMonth(calendarJYear, calendarJMonth);
  const monthOffset = (momentJalaali(`${calendarJYear}/${calendarJMonth}/1`, "jYYYY/jM/jD").day() + 1) % 7;
  // برای هر ددلاینِ انجام‌نشده، یک نقطه در روز مربوط به آن نمایش داده می‌شود.
  const taskDayCounts = tasks.filter(t => t.status !== "done").reduce((counts, task) => {
    const d = momentJalaali(task.due);
    const key = `${d.jYear()}-${d.jMonth() + 1}-${d.jDate()}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map<string, number>());

  if (authLoading) return <main className="auth-page" dir="rtl"><div className="auth-loading">در حال بررسی حساب کاربری…</div></main>;

  if (!user) return (
    <main className="auth-page" dir="rtl">
      <form className="auth-card" onSubmit={submitAuth}>
        <div className="auth-brand">
          <div className="auth-brand-mark">◷</div>
          <div><h1>ددلاین</h1><p>مدیریت زمان</p></div>
        </div>
        <div className="auth-intro">
          <span className="auth-eyebrow">فضای شخصی برنامه‌ریزی</span>
          <h2>{authMode === "signin" ? "ورود به حساب" : "ساخت حساب کاربری"}</h2>
          
        </div>
        <div className="auth-fields">
          <label className="auth-label">ایمیل<input className="auth-input" type="email" autoComplete="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="name@example.com" /></label>
          <label className="auth-label">رمز عبور<input className="auth-input" type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={6} required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="حداقل ۶ نویسه" /></label>
        </div>
        {authError && <p className="auth-error" role="alert">{authError}</p>}
        <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? "لطفاً صبر کن…" : authMode === "signin" ? "ورود به حساب" : "ساخت حساب"}</button>
        <button className="auth-switch" type="button" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); }}>{authMode === "signin" ? "حساب نداری؟ ثبت‌نام کن" : "قبلاً حساب ساخته‌ای؟ وارد شو"}</button>
        {authMode === "signin" && <div className="auth-divider"><span>یا</span></div>}
        {authMode === "signin" && <button className="auth-guest" type="button" disabled={authBusy} onClick={signInGuest}>ورود به‌عنوان مهمان دانشگاه</button>}
        <p className="auth-footnote">اطلاعات و وظایف حساب تو به‌صورت شخصی نگهداری می‌شوند.</p>
      </form>
    </main>
  );

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><AlarmClock size={22}/></div><div><strong>ددلاین</strong><span>مدیریت زمان، ساده‌تر</span></div><button className="mobile-close icon-btn" onClick={()=>setMobileMenu(false)} aria-label="بستن"><X size={18}/></button></div>
        {!user.guest && <button className="add-task-button" onClick={()=>{setShowSettings(false);openNew();}}><Plus size={18}/> ایجاد کار جدید <span>⌘ K</span></button>}{user.guest && <div className="nav-caption">حالت مشاهده مهمان</div>}
        <div className="nav-caption">فضای کاری</div>
        <nav className="nav-list">
          {(user.guest ? navItems.filter(item => ["نمای کلی","همه کارها","امروز","۷ روز آینده","عقب‌افتاده","انجام‌شده"].includes(item.name)) : navItems).map(item => {
            const Icon = item.icon;
            return <button key={item.name} className={`nav-item ${activeNav===item.name && !showPeriodic && !showSettings?"active":""}`} onClick={()=>{setActiveNav(item.name);setShowSettings(false);setShowPeriodic(false);setMobileMenu(false);}}>
              <Icon size={18}/><span>{item.name}</span>{item.count !== undefined && <small>{item.count}</small>}
            </button>;
          })}
          {!user.guest && <button className={`nav-item ${showPeriodic?"active":""}`} onClick={()=>{setShowPeriodic(true);setShowSettings(false);setMobileMenu(false);}}><Clock3 size={18}/><span>یادآورهای دوره‌ای</span></button>}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item theme-toggle" onClick={toggleTheme} aria-label="تغییر حالت روشن و تاریک"><span className="theme-toggle-icon">{theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? <Sun size={18}/> : <Moon size={18}/>}</span><span>{theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "حالت روز" : "حالت شب"}</span></button>
          <button className={`nav-item ${showSettings?"active":""}`} onClick={()=>{setShowSettings(!showSettings);setShowPeriodic(false);setMobileMenu(false);}}><Settings2 size={18}/><span>تنظیمات</span></button>
          <div className="profile-row"><div className="avatar">ا</div><div className="profile-text"><strong>{user.guest ? "مهمان دانشگاه" : "فضای شخصی"}</strong><span>{user.guest ? "فقط مشاهده ددلاین‌های دانشگاه" : (user.email || "حساب کاربری")}</span></div><MoreHorizontal size={19} className="muted"/></div>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-overlay" onClick={()=>setMobileMenu(false)} aria-label="بستن منو"/>}
      <section className="main-panel">
        <header className="topbar">
          <button className="icon-btn menu-trigger" onClick={()=>setMobileMenu(true)} aria-label="منو"><Menu size={20}/></button>
          <div className="breadcrumbs">{user.guest ? "مشاهده ددلاین‌های دانشگاه" : "فضای کاری"} <ChevronLeft size={14}/> <strong>{showPeriodic?"یادآورهای دوره‌ای":showSettings?"تنظیمات":activeNav}</strong></div>
          <div className="top-actions">
            <div className="date-chip"><CalendarDays size={15}/>{faDate(new Date(), { weekday:"long", year:"numeric" })}</div><button className="secondary-btn compact" onClick={signOut} title={user.guest ? "خروج از حالت مهمان" : (user.email || "خروج از حساب")}>خروج</button>
            <button className={`icon-btn notification-btn ${notifications?"notification-on":""}`} onClick={()=>{setShowSettings(!showSettings);setShowPeriodic(false);}} aria-label="تنظیمات اعلان"><Bell size={18}/><i/></button>
          </div>
        </header>

        {showPeriodic ? (
          <div className="content settings-content">
            <div className="page-heading"><div><div className="eyebrow">برنامه‌ریزی اعلان‌ها</div><h1>یادآورهای دوره‌ای</h1><p>اعلان تکرارشونده بساز؛ حتی وقتی سایت بسته است.</p></div></div>
            <div className="settings-card" style={{ padding: 22 }}>
              <form onSubmit={savePeriodicReminder} style={{ display: "grid", gap: 16 }}>
                <label className="field-label">عنوان یادآور <b>*</b><input value={periodicTitle} onChange={e=>setPeriodicTitle(e.target.value)} placeholder="مثلاً زمان استراحت" maxLength={100} required /></label>
                <label className="field-label">متن اعلان <b>*</b><textarea value={periodicMessage} onChange={e=>setPeriodicMessage(e.target.value)} placeholder="متنی که می‌خواهی در اعلان نمایش داده شود..." rows={3} maxLength={500} required /></label>
                <label className="field-label">نوع زمان‌بندی<select value={periodicType} onChange={e=>setPeriodicType(e.target.value as "interval" | "daily")}><option value="interval">تکرار با فاصله زمانی</option><option value="daily">هر روز در ساعت مشخص</option></select></label>
                {periodicType === "interval" ? (
                  <div className="form-two">
                    <label className="field-label">ساعت<input type="number" min="0" max="8760" value={periodicHours} onChange={e=>setPeriodicHours(e.target.value)} required /></label>
                    <label className="field-label">دقیقه<input type="number" min="0" max="59" value={periodicMinutes} onChange={e=>setPeriodicMinutes(e.target.value)} required /></label>
                    <p style={{ gridColumn: "1 / -1", margin: 0, color: "var(--muted, #777)", fontSize: 13 }}>مثلاً ۱ ساعت و ۳۰ دقیقه یعنی هر ۹۰ دقیقه یک اعلان.</p>
                  </div>
                ) : (
                  <div className="form-two">
                    <label className="field-label">ساعت ارسال<input type="time" value={periodicDailyTime} onChange={e=>setPeriodicDailyTime(e.target.value)} required /></label>
                    <p style={{ margin: 0, color: "var(--muted, #777)", fontSize: 13, alignSelf: "center" }}>بر اساس ساعت محلی دستگاه هنگام ساخت یادآور.</p>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-start" }}><button type="submit" className="primary-btn" disabled={periodicSaving}><Plus size={17}/>{periodicSaving ? "در حال ثبت..." : "ثبت یادآور"}</button></div>
              </form>
            </div>
            <div className="settings-card" style={{ padding: 22, marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}><h2 style={{ margin: 0, fontSize: 18 }}>یادآورهای ثبت‌شده</h2><span>{periodicReminders.length.toLocaleString("fa-IR")}</span></div>
              {periodicLoading ? <p>در حال بارگذاری...</p> : periodicReminders.length === 0 ? <p style={{ color: "var(--muted, #777)" }}>هنوز یادآور دوره‌ای نساخته‌ای.</p> : periodicReminders.map(item => (
                <div key={item.id} className="settings-row" style={{ alignItems: "flex-start", gap: 12 }}>
                  <div className="settings-icon"><Clock3 size={19}/></div>
                  <div className="settings-copy" style={{ minWidth: 0, flex: 1 }}>
                    <strong>{item.title}</strong>
                    <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.message}</p>
                    <p>{item.schedule_type === "interval" ? `هر ${Math.floor((item.interval_minutes || 0) / 60) ? `${Math.floor((item.interval_minutes || 0) / 60)} ساعت و ` : ""}${(item.interval_minutes || 0) % 60 || (item.interval_minutes || 0) < 60 ? (item.interval_minutes || 0) % 60 : 0} دقیقه` : `هر روز ساعت ${(item.daily_time || "").slice(0, 5)}`}</p>
                    <span className={`permission ${item.enabled ? "ok" : ""}`}>{item.enabled ? "فعال" : "غیرفعال"} · نوبت بعدی: {faDateTime(item.next_run_at)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button type="button" className="secondary-btn compact" onClick={()=>togglePeriodicReminder(item)}>{item.enabled ? "غیرفعال" : "فعال‌سازی"}</button>
                    <button type="button" className="secondary-btn compact" onClick={()=>deletePeriodicReminder(item)}><Trash2 size={14}/> حذف</button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "var(--muted, #777)", marginTop: 12 }}>برای دریافت اعلان، یک‌بار از بخش تنظیمات، اعلان‌های این دستگاه را فعال کن.</p>
          </div>
        ) : showSettings ? (
          <div className="content settings-content">
            <div className="page-heading"><div><div className="eyebrow">شخصی‌سازی</div><h1>تنظیمات</h1><p>تنظیم تجربه کار با ددلاین</p></div></div>
            <div className="settings-card">
              <div className="settings-row"><div className="settings-icon"><Bell size={20}/></div><div className="settings-copy"><strong>اعلان‌های مرورگر</strong><p>{user.guest ? "برای دریافت یادآور ددلاین‌های دانشگاه، اعلان این دستگاه را فعال کن." : "برای نمایش اعلان، اجازه مرورگر لازم است."}</p><span className={`permission ${permission==="granted"?"ok":""}`}>وضعیت: {permission==="granted"?"فعال":permission==="denied"?"مسدود شده":"نیازمند اجازه"}</span></div><button className="primary-btn compact" onClick={askNotifications}>{notifications?"بررسی مجدد":"فعال‌سازی"}</button></div>
              {!user.guest && <div className="settings-row"><div className="settings-icon"><AlarmClock size={20}/></div><div className="settings-copy"><strong>آزمایش اعلان</strong><p>یک اعلان آزمایشی روی همین دستگاه نمایش بده.</p></div><button className="secondary-btn compact" onClick={testNotification}>ارسال آزمایشی</button></div>}
              
            </div>
          </div>
        ) : (
          <div className="content">
            {user.guest && <div className="guest-mode-banner">READ-ONLY MODE</div>}
            <div className="page-heading">
              <div><div className="eyebrow">{activeNav==="نمای کلی"?"خلاصه فعالیت‌ها":"مدیریت وظایف"}</div><h1>{activeNav==="نمای کلی"?"نمای کلی":activeNav}</h1>{activeNav==="نمای کلی" ? <p>برنامه امروزت را مرتب کن و با تمرکز جلو برو.</p> : activeNav==="همه کارها" ? <p>ددلاین ثبت کن و اعلان یادآوری دریافت کن</p> : null}</div>
              {!user.guest && <button className="primary-btn" onClick={openNew}><Plus size={18}/> کار جدید</button>}
            </div>

            {activeNav==="نمای کلی" && <div className="stats-grid">
              <div className="stat-card"><div className="stat-top"><span>کارهای فعال</span><div className="stat-icon purple"><ListTodo size={18}/></div></div><div className="stat-value">{activeTasks.length.toLocaleString("fa-IR")}</div><div className="stat-foot"><span className="dot purple-dot"/>کار باقی‌مانده</div></div>
              <div className="stat-card"><div className="stat-top"><span>ددلاین امروز</span><div className="stat-icon blue"><CalendarDays size={18}/></div></div><div className="stat-value">{todayTasks.length.toLocaleString("fa-IR")}</div><div className="stat-foot">برای امروز برنامه‌ریزی شده</div></div>
              <div className="stat-card"><div className="stat-top"><span>عقب‌افتاده</span><div className="stat-icon red"><Clock3 size={18}/></div></div><div className="stat-value">{overdueTasks.length.toLocaleString("fa-IR")}</div><div className="stat-foot">{overdueTasks.length?"نیازمند بررسی":"همه‌چیز تحت کنترل"}</div></div>
              <div className="stat-card next-stat"><div className="stat-top"><span>نزدیک‌ترین ددلاین</span><div className="stat-icon green"><AlarmClock size={18}/></div></div><div className="next-title">{nextTask?.title || "ددلاین فعالی نیست"}</div><div className="stat-foot">{nextTask?timeLeft(nextTask.due, clockNow):"می‌توانی یک کار جدید بسازی"}</div></div>
            </div>}

            <div className="workspace-grid">
              <div className="tasks-section">
                <div className="section-heading"><div><h2>{activeNav==="نمای کلی"?"کارهای پیش رو":`فهرست ${activeNav}`}</h2><span>{shownTasks.length.toLocaleString("fa-IR")} کار</span></div><button className="text-button" onClick={()=>{setActiveNav("همه کارها");setShowSettings(false);}}>مشاهده همه <ChevronLeft size={15}/></button></div>
                <div className="toolbar">
                  <div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی کارها..."/>{query&&<button onClick={()=>setQuery("")} aria-label="پاک کردن"><X size={14}/></button>}</div>
                  <div className="filter-wrap"><SlidersHorizontal size={15}/><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} aria-label="فیلتر دسته‌بندی"><option>همه دسته‌ها</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
                </div>
                <div className="task-list">
                  {shownTasks.length===0 ? <div className="empty-state"><div><CheckCircle2 size={27}/></div><strong>کاری برای نمایش نیست</strong><p>فیلترها را تغییر بده یا یک کار جدید اضافه کن.</p>{!user.guest && <button className="secondary-btn" onClick={openNew}><Plus size={16}/> ایجاد کار</button>}</div> :
                    shownTasks.map(task => {
                      const late = task.status!=="done" && new Date(task.due).getTime()<Date.now();
                      return <article className={`task-row ${task.status==="done"?"task-completed":""}`} key={task.id}>
                        {!user.guest && <button className={`task-check ${task.status==="done"?"checked":""}`} onClick={()=>toggleDone(task)} aria-label={task.status==="done"?"بازگرداندن کار":"تکمیل کار"}>{task.status==="done"&&<Check size={14}/>}</button>}
                        <div className="task-main">
                          <div className="task-title-line"><h3>{task.title}</h3>{late&&<span className="late-pill">عقب‌افتاده</span>}</div>
                          {task.description&&<p className="task-description">{task.description}</p>}
                          <div className="task-meta"><span className={`category-tag ${task.category==="دانشگاه"?"cat-study":task.category==="کار"?"cat-work":task.category==="پروژه شخصی"?"cat-project":"cat-life"}`}><i/>{task.category}</span><span className="task-due"><Clock3 size={13}/>{faDateTime(task.due)}</span>{task.reminders.length>0&&<span className="reminder-count"><Bell size={12}/>{task.reminders.length} یادآور</span>}</div>
                        </div>
                        <div className="task-end"><span className={`time-left ${late?"time-late":""}`}>{task.status==="done"?"انجام‌شده":timeLeft(task.due, clockNow)}</span></div>
                        {!user.guest && <div className="task-actions"><button className="icon-btn small-icon" onClick={()=>openEdit(task)} aria-label="ویرایش"><Pencil size={15}/></button><button className="icon-btn small-icon delete-icon" onClick={()=>deleteTask(task)} aria-label="حذف"><Trash2 size={15}/></button></div>}
                      </article>;
                    })
                  }
                </div>
                {activeNav==="نمای کلی"&&<button className="view-all-button" onClick={()=>{setActiveNav("همه کارها");setShowPeriodic(false);setShowSettings(false);}}>مشاهده تمام کارها <ChevronLeft size={16}/></button>}
              </div>

              <aside className="right-column">
                <div className="calendar-card">
                  <div className="calendar-head"><div><h2>تقویم ددلاین‌ها</h2><p>{new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric"}).format(calendarMonth)}</p></div><div className="calendar-arrows"><button className="icon-btn" onClick={()=>setCalendarMonth(momentJalaali(calendarMonth).subtract(1, "jMonth").toDate())} aria-label="ماه قبل"><ChevronRight size={16}/></button><button className="icon-btn" onClick={()=>setCalendarMonth(momentJalaali(calendarMonth).add(1, "jMonth").toDate())} aria-label="ماه بعد"><ChevronLeft size={16}/></button></div></div>
                  <div className="calendar-grid">
                    {["ش","ی","د","س","چ","پ","ج"].map(d=><span key={d} className="weekday">{d}</span>)}
                    {Array.from({length:monthOffset},(_,i)=><span key={`blank-${i}`}/>)}
                    {Array.from({length:monthDays},(_,i)=>{
                      const day=i+1, key=`${calendarJYear}-${calendarJMonth}-${day}`;
                      const todayJalali = momentJalaali();
                      const isToday = todayJalali.jDate()===day && todayJalali.jMonth()+1===calendarJMonth && todayJalali.jYear()===calendarJYear;
                      const deadlineCount = taskDayCounts.get(key) || 0;
                       return <button key={day} className={`calendar-day ${isToday?"today":""} ${deadlineCount>0?"has-task":""}`} onClick={()=>{setActiveNav("همه کارها");setQuery("");}}>{day.toLocaleString("fa-IR")}{deadlineCount>0&&<span className="calendar-dots" aria-label={`${deadlineCount} ددلاین`}>{Array.from({length:deadlineCount},(_,dotIndex)=><i key={dotIndex}/>)}</span>}</button>;
                    })}
                  </div>
                  <div className="calendar-legend"><span><i className="legend-dot"/> دارای ددلاین</span><span><i className="legend-today"/> امروز</span></div>
                </div>
                <div className="upcoming-card"><div className="upcoming-head"><h2>در یک نگاه</h2><span className="upcoming-icon"><AlarmClock size={17}/></span></div>
                  {activeTasks.filter(t=>new Date(t.due)>=new Date()).sort((a,b)=>+new Date(a.due)-+new Date(b.due)).slice(0,3).map((t,i)=><div className="upcoming-item" key={t.id}><div className={`upcoming-line line-${i}`}/><div><strong>{t.title}</strong><span>{faDateTime(t.due)}</span></div><small>{timeLeft(t.due, clockNow)}</small></div>)}
                  {activeTasks.filter(t=>new Date(t.due)>=new Date()).length===0&&<p className="muted empty-upcoming">ددلاین آینده‌ای ثبت نشده.</p>}
                </div>
              </aside>
            </div>
          </div>
        )}
      </section>

      {modalOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModalOpen(false);}}><form className="task-modal" onSubmit={saveTask}>
        <div className="modal-head"><div><h2>{editing?"ویرایش کار":"ایجاد کار جدید"}</h2><p>جزئیات کار و زمان تحویل را مشخص کن.</p></div><button type="button" className="icon-btn" onClick={()=>setModalOpen(false)} aria-label="بستن"><X size={19}/></button></div>
        <label className="field-label">عنوان کار <b>*</b><input autoFocus value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="مثلاً تحویل پروژه دانشگاه" required maxLength={120}/></label>
        <label className="field-label">توضیحات <span>اختیاری</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="جزئیات یا یادداشت کوتاه..." rows={3} maxLength={1000}/></label>
        <div className="form-two"><div className="field-label"><span>تاریخ شمسی ددلاین <b>*</b></span><div className="date-picker-wrap"><button type="button" className="date-picker-trigger" onClick={openDatePicker} aria-expanded={datePickerOpen}><CalendarDays size={17}/><span>{new Intl.NumberFormat("fa-IR").format(Number(jalaliDay))} {jalaliMonths[Number(jalaliMonth)-1]} {new Intl.NumberFormat("fa-IR").format(Number(jalaliYear))}</span><ChevronDown size={16}/></button>
        {datePickerOpen && <div className="date-picker-popover" dir="rtl">
          <div className="date-picker-main">
            <div className="date-picker-month"><button type="button" className="icon-btn" onClick={()=>shiftPickerMonth(-1)} aria-label="ماه قبل"><ChevronRight size={17}/></button><strong>{jalaliMonths[Number(pickerMonth)-1]} {new Intl.NumberFormat("fa-IR").format(Number(pickerYear))}</strong><button type="button" className="icon-btn" onClick={()=>shiftPickerMonth(1)} aria-label="ماه بعد"><ChevronLeft size={17}/></button></div>
            <div className="date-picker-weekdays">{["ش","ی","د","س","چ","پ","ج"].map(d=><span key={d}>{d}</span>)}</div>
            <div className="date-picker-days">{Array.from({length:(momentJalaali(`${pickerYear}/${pickerMonth}/1`,"jYYYY/jM/jD").day()+1)%7},(_,i)=><span key={`blank-${i}`}/>)}{Array.from({length:jalaliDaysInMonth(pickerYear,pickerMonth)},(_,i)=>{const d=String(i+1);const today=momentJalaali();const isToday=Number(d)===today.jDate()&&Number(pickerMonth)===today.jMonth()+1&&Number(pickerYear)===today.jYear();return <button type="button" key={d} className={`date-picker-day ${pickerDay===d?"selected":""} ${isToday?"is-today":""}`} onClick={event=>{event.preventDefault();event.stopPropagation();setPickerDay(d);}}>{new Intl.NumberFormat("fa-IR").format(i+1)}</button>})}</div>
          </div>
          <aside className="date-picker-side"><strong>انتخاب سریع</strong><button type="button" onClick={()=>chooseQuickDate(0)}><CalendarDays size={15}/> امروز</button><button type="button" onClick={()=>chooseQuickDate(7)}><Clock3 size={15}/> ۷ روز دیگر</button><button type="button" onClick={()=>chooseQuickDate(30)}><CalendarDays size={15}/> ۳۰ روز دیگر</button><button type="button" onClick={chooseEndOfMonth}><CalendarDays size={15}/> پایان ماه</button><label>زمان ددلاین<input type="time" value={deadlineTime} onChange={e=>setDeadlineTime(e.target.value)} required/></label></aside>
          <div className="date-picker-actions"><button type="button" className="secondary-btn" onClick={()=>setDatePickerOpen(false)}>لغو</button><button type="button" className="primary-btn" onClick={confirmPickedDate}><Check size={16}/> تأیید تاریخ</button></div>
        </div>}</div></div><label className="field-label">دسته‌بندی<select value={form.category} onChange={e=>setForm({...form,category:e.target.value as Category})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
        <div className="reminder-field"><div className="reminder-label"><Bell size={15}/> یادآورهای پیشنهادی <span>زمان‌ها نسبت به ددلاین محاسبه می‌شوند</span></div><div className="reminder-options">{reminderChoices.map(r=><label key={r.v} className={`reminder-option ${form.reminderMins.includes(r.v)?"selected":""}`}><input type="checkbox" checked={form.reminderMins.includes(r.v)} onChange={e=>setForm({...form,reminderMins:e.target.checked?[...form.reminderMins,r.v]:form.reminderMins.filter(v=>v!==r.v)})}/>{r.l}</label>)}</div></div>
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setModalOpen(false)}>انصراف</button><button type="submit" className="primary-btn"><Check size={17}/>{editing?"ذخیره تغییرات":"ثبت کار"}</button></div>
      </form></div>}
      {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
      <div className="mobile-bottom"><button onClick={()=>{setActiveNav("نمای کلی");setShowSettings(false);setShowPeriodic(false);}} className={activeNav==="نمای کلی"?"selected":""}><LayoutDashboard size={19}/><span>نمای کلی</span></button><button onClick={()=>setActiveNav("همه کارها")} className={activeNav==="همه کارها"?"selected":""}><ListTodo size={19}/><span>کارها</span></button>{!user.guest && <button onClick={openNew}><Plus size={22}/><span>کار جدید</span></button>}<button onClick={()=>{setShowSettings(true);setShowPeriodic(false);}}><Settings2 size={19}/><span>تنظیمات</span></button></div>
    </main>
  );
}

// Trigger a fresh production build for the public VAPID environment variable.
