 "use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlarmClock, ArrowDownWideNarrow, Bell, CalendarDays, Check, CheckCheck,
  ChevronDown, Circle, Clock3, LayoutDashboard, ListTodo, MoreHorizontal,
  Plus, Search, Settings2, SlidersHorizontal, Trash2, X, Pencil, ChevronLeft,
  ChevronRight, CalendarClock, CircleAlert, Sparkles, Menu, CheckCircle2
} from "lucide-react";

type Status = "todo" | "doing" | "done";
type Priority = "low" | "medium" | "high";
type Category = "دانشگاه" | "کار" | "پروژه شخصی" | "زندگی";
type Reminder = { id: string; at: string; sent?: boolean };
type Task = {
  id: string; title: string; description: string; due: string;
  category: Category; priority: Priority; status: Status; reminders: Reminder[];
  createdAt: string;
};

const categories: Category[] = ["دانشگاه", "کار", "پروژه شخصی", "زندگی"];
const initialTasks: Task[] = [
  { id: "a1", title: "تحویل گزارش تحلیل سیستم", description: "بازبینی نهایی و آماده‌سازی فایل ارائه", due: "2026-10-14T16:00", category: "دانشگاه", priority: "high", status: "doing", reminders: [{ id: "r1", at: "2026-10-14T13:00" }], createdAt: "2026-10-12T10:00" },
  { id: "a2", title: "مطالعه کنترل موجودی", description: "مرور EOQ و حل تمرین‌های فصل دوم", due: "2026-10-15T20:30", category: "دانشگاه", priority: "medium", status: "todo", reminders: [], createdAt: "2026-10-12T10:10" },
  { id: "a3", title: "تکمیل نسخه اولیه وب‌اپ", description: "بررسی تجربه کاربری و حالت موبایل", due: "2026-10-17T18:00", category: "پروژه شخصی", priority: "high", status: "todo", reminders: [{ id: "r2", at: "2026-10-16T18:00" }], createdAt: "2026-10-12T10:15" },
  { id: "a4", title: "ارسال فایل کارآموزی", description: "جمع‌بندی ماژول خرید و انبار", due: "2026-10-13T12:00", category: "کار", priority: "low", status: "todo", reminders: [], createdAt: "2026-10-11T12:00" },
  { id: "a5", title: "مرتب‌کردن یادداشت‌ها", description: "", due: "2026-10-19T10:00", category: "زندگی", priority: "low", status: "done", reminders: [], createdAt: "2026-10-10T09:00" },
];

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
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [permission, setPermission] = useState("default");
  const [toast, setToast] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 9, 1));

  useEffect(() => {
    try {
      const stored = localStorage.getItem("deadline-manager-tasks-v1");
      setTasks(stored ? JSON.parse(stored) : initialTasks);
      setNotifications(localStorage.getItem("deadline-manager-notifications") === "true");
      if ("Notification" in window) setPermission(Notification.permission);
    } catch { setTasks(initialTasks); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("deadline-manager-tasks-v1", JSON.stringify(tasks));
  }, [tasks, ready]);

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

  const openNew = () => { setEditing(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (task: Task) => {
    setEditing(task.id);
    setForm({ title: task.title, description: task.description, due: task.due, category: task.category, priority: task.priority, status: task.status, reminderMins: [] });
    setModalOpen(true);
  };
  const saveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.due) { setToast("عنوان و زمان ددلاین را وارد کن."); return; }
    if (new Date(form.due).getTime() <= 0) { setToast("زمان ددلاین معتبر نیست."); return; }
    if (editing) {
      setTasks(old => old.map(t => t.id === editing ? { ...t, title: form.title.trim(), description: form.description, due: form.due, category: form.category, priority: form.priority, status: form.status } : t));
      setToast("تغییرات ذخیره شد.");
    } else {
      const now = Date.now();
      const reminders = form.reminderMins.map((m,i) => ({ id: `${now}-r${i}`, at: new Date(new Date(form.due).getTime()-Number(m)*60000).toISOString().slice(0,16) }));
      setTasks(old => [...old, { id: `${now}`, title: form.title.trim(), description: form.description, due: form.due, category: form.category, priority: form.priority, status: form.status, reminders, createdAt: new Date().toISOString() }]);
      setToast("کار جدید اضافه شد.");
    }
    setModalOpen(false);
  };
  const deleteTask = (task: Task) => {
    if (!window.confirm(`کار «${task.title}» حذف شود؟`)) return;
    setTasks(old => old.filter(t => t.id !== task.id));
    setToast("کار حذف شد.");
  };
  const toggleDone = (task: Task) => setTasks(old => old.map(t => t.id === task.id ? { ...t, status: t.status === "done" ? "todo" : "done" } : t));
  const askNotifications = async () => {
    if (!("Notification" in window)) { setToast("این مرورگر از اعلان‌های وب پشتیبانی نمی‌کند."); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
    const enabled = result === "granted";
    setNotifications(enabled);
    localStorage.setItem("deadline-manager-notifications", String(enabled));
    setToast(enabled ? "اجازه اعلان مرورگر فعال شد." : "اجازه اعلان داده نشد.");
  };
  const testNotification = () => {
    if (!("Notification" in window) || Notification.permission !== "granted") { setToast("ابتدا اجازه اعلان را فعال کن."); return; }
    new Notification("ددلاین | اعلان آزمایشی", { body: "اعلان‌های مرورگر روی این دستگاه فعال هستند." });
    setToast("اعلان آزمایشی ارسال شد.");
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
          <div className="profile-row"><div className="avatar">ا</div><div className="profile-text"><strong>فضای شخصی</strong><span>حساب محلی</span></div><MoreHorizontal size={19} className="muted"/></div>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-overlay" onClick={()=>setMobileMenu(false)} aria-label="بستن منو"/>}
      <section className="main-panel">
        <header className="topbar">
          <button className="icon-btn menu-trigger" onClick={()=>setMobileMenu(true)} aria-label="منو"><Menu size={20}/></button>
          <div className="breadcrumbs">فضای کاری <ChevronLeft size={14}/> <strong>{showSettings?"تنظیمات":activeNav}</strong></div>
          <div className="top-actions">
            <div className="date-chip"><CalendarDays size={15}/>{faDate(new Date(), { weekday:"long", year:"numeric" })}</div>
            <button className={`icon-btn notification-btn ${notifications?"notification-on":""}`} onClick={()=>setShowSettings(!showSettings)} aria-label="تنظیمات اعلان"><Bell size={18}/><i/></button>
          </div>
        </header>

        {showSettings ? (
          <div className="content settings-content">
            <div className="page-heading"><div><div className="eyebrow">شخصی‌سازی</div><h1>تنظیمات</h1><p>تنظیم تجربه کار با ددلاین</p></div></div>
            <div className="settings-card">
              <div className="settings-row"><div className="settings-icon"><Bell size={20}/></div><div className="settings-copy"><strong>اعلان‌های مرورگر</strong><p>برای نمایش اعلان، اجازه مرورگر لازم است. این نسخه اعلان آزمایشی را پشتیبانی می‌کند.</p><span className={`permission ${permission==="granted"?"ok":""}`}>وضعیت: {permission==="granted"?"فعال":permission==="denied"?"مسدود شده":"نیازمند اجازه"}</span></div><button className="primary-btn compact" onClick={askNotifications}>{notifications?"بررسی مجدد":"فعال‌سازی"}</button></div>
              <div className="settings-row"><div className="settings-icon"><AlarmClock size={20}/></div><div className="settings-copy"><strong>آزمایش اعلان</strong><p>یک اعلان آزمایشی روی همین دستگاه نمایش بده.</p></div><button className="secondary-btn compact" onClick={testNotification}>ارسال آزمایشی</button></div>
              <div className="settings-note"><CircleAlert size={17}/><span>یادآوری واقعی در زمان تعیین‌شده به بک‌اند، پایگاه داده و سرویس زمان‌بندی نیاز دارد. نسخه فعلی یک نمونه قابل اجرا با ذخیره‌سازی محلی است و اعلان زمان‌بندی‌شده در پس‌زمینه را تضمین نمی‌کند.</span></div>
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
        <div className="form-two"><label className="field-label">تاریخ و ساعت ددلاین <b>*</b><input type="datetime-local" value={form.due} onChange={e=>setForm({...form,due:e.target.value})} required/></label><label className="field-label">دسته‌بندی<select value={form.category} onChange={e=>setForm({...form,category:e.target.value as Category})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
        <div className="form-two"><label className="field-label">اولویت<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})}><option value="low">کم</option><option value="medium">متوسط</option><option value="high">زیاد</option></select></label><label className="field-label">وضعیت<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})}><option value="todo">انجام‌نشده</option><option value="doing">در حال انجام</option><option value="done">انجام‌شده</option></select></label></div>
        {!editing&&<div className="reminder-field"><div className="reminder-label"><Bell size={15}/> یادآورهای پیشنهادی <span>زمان‌ها نسبت به ددلاین محاسبه می‌شوند</span></div><div className="reminder-options">{[{v:"10080",l:"۱ هفته قبل"},{v:"4320",l:"۳ روز قبل"},{v:"1440",l:"۱ روز قبل"},{v:"180",l:"۳ ساعت قبل"},{v:"30",l:"۳۰ دقیقه قبل"}].map(r=><label key={r.v} className={`reminder-option ${form.reminderMins.includes(r.v)?"selected":""}`}><input type="checkbox" checked={form.reminderMins.includes(r.v)} onChange={e=>setForm({...form,reminderMins:e.target.checked?[...form.reminderMins,r.v]:form.reminderMins.filter(v=>v!==r.v)})}/>{r.l}</label>)}</div></div>}
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setModalOpen(false)}>انصراف</button><button type="submit" className="primary-btn"><Check size={17}/>{editing?"ذخیره تغییرات":"ثبت کار"}</button></div>
      </form></div>}
      {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
      <div className="mobile-bottom"><button onClick={()=>setActiveNav("نمای کلی")} className={activeNav==="نمای کلی"?"selected":""}><LayoutDashboard size={19}/><span>نمای کلی</span></button><button onClick={()=>setActiveNav("همه کارها")} className={activeNav==="همه کارها"?"selected":""}><ListTodo size={19}/><span>کارها</span></button><button onClick={openNew}><Plus size={22}/><span>کار جدید</span></button><button onClick={()=>setShowSettings(true)}><Settings2 size={19}/><span>تنظیمات</span></button></div>
    </main>
  );
}