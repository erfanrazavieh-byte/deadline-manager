// Periodic reminder support is included in this function.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") || "";
  const expected = Deno.env.get("REMINDER_CRON_SECRET");
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = Date.now();
  const windowEnd = new Date(now + 60_000).toISOString();
  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth");
  if (subError) return new Response(subError.message, { status: 500, headers: corsHeaders });

  const { data: tasks, error: taskError } = await supabase
    .from("tasks").select("id,user_id,title,status,due,reminders").neq("status", "done");
  if (taskError) return new Response(taskError.message, { status: 500, headers: corsHeaders });

  const formatTimeRemaining = (due: string) => {
    const diff = new Date(due).getTime() - Date.now();
    if (!Number.isFinite(diff)) return "";
    if (diff <= 0) return "زمان ددلاین رسیده یا گذشته است";
    const totalMinutes = Math.ceil(diff / 60_000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [
      days > 0 ? `${new Intl.NumberFormat("fa-IR").format(days)} روز` : "",
      hours > 0 ? `${new Intl.NumberFormat("fa-IR").format(hours)} ساعت` : "",
      minutes > 0 && days === 0 ? `${new Intl.NumberFormat("fa-IR").format(minutes)} دقیقه` : ""
    ].filter(Boolean);
    return `${parts.join(" و ")} تا ددلاین باقی مانده`;
  };

  let sent = 0;
  for (const task of tasks || []) {
    for (const reminder of Array.isArray(task.reminders) ? task.reminders : []) {
      const at = new Date(reminder.at).getTime();
      if (!Number.isFinite(at) || at > now || at < now - 60_000) continue;
      const marker = `${task.id}:${reminder.id}`;
      const { data: alreadySent } = await supabase.from("sent_push_reminders")
        .select("id").eq("marker", marker).maybeSingle();
      if (alreadySent) continue;

      const targets = (subscriptions || []).filter((s: any) => s.user_id === task.user_id);
      let delivered = false;
      for (const target of targets) {
        try {
          await webpush.sendNotification({
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          }, JSON.stringify({
            title: "یادآوری ددلاین",
            body: `${task.title} — ${formatTimeRemaining(task.due)}`,
            url: "/",
            tag: `deadline-${task.id}-${reminder.id}`,
          }));
          delivered = true;
          sent++;
        } catch (e) {
          const statusCode = (e as any)?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", target.id);
          } else {
            console.error("Push delivery failed", statusCode || e);
          }
        }
      }
      if (delivered) {
        await supabase.from("sent_push_reminders").insert({ marker, task_id: String(task.id), reminder_id: String(reminder.id) });
      }
    }
  }
  const { data: periodicReminders, error: periodicError } = await supabase
    .from("periodic_reminders")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString());
  if (periodicError) return new Response(periodicError.message, { status: 500, headers: corsHeaders });

  const zonedParts = (date: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(date);
    const values: Record<string, number> = {};
    for (const part of parts) if (part.type !== "literal") values[part.type] = Number(part.value);
    return values;
  };
  const offsetAt = (date: Date, timeZone: string) => {
    const p = zonedParts(date, timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
  };
  const nextDailyRun = (from: Date, timeZone: string, dailyTime: string) => {
    const p = zonedParts(from, timeZone);
    const [hour, minute] = dailyTime.slice(0, 5).split(":").map(Number);
    const resolveLocal = (localTarget: number) => {
      let candidate = new Date(localTarget);
      for (let i = 0; i < 3; i++) candidate = new Date(localTarget - offsetAt(candidate, timeZone));
      return candidate;
    };
    let localTarget = Date.UTC(p.year, p.month - 1, p.day, hour, minute, 0);
    let candidate = resolveLocal(localTarget);
    if (candidate.getTime() <= from.getTime()) {
      const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
      localTarget = Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), hour, minute, 0);
      candidate = resolveLocal(localTarget);
    }
    return candidate;
  };

  for (const reminder of periodicReminders || []) {
    const targets = (subscriptions || []).filter((s: any) => s.user_id === reminder.user_id);
    let delivered = false;
    for (const target of targets) {
      try {
        await webpush.sendNotification({
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        }, JSON.stringify({
          title: reminder.title || "یادآور دوره‌ای",
          body: reminder.message,
          url: "/",
          tag: `periodic-${reminder.id}-${Math.floor(now / 60_000)}`,
        }));
        delivered = true;
        sent++;
      } catch (e) {
        const statusCode = (e as any)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", target.id);
        } else {
          console.error("Periodic push delivery failed", statusCode || e);
        }
      }
    }
    if (delivered) {
      const nextRun = reminder.schedule_type === "interval"
        ? new Date(Date.now() + Math.max(1, Number(reminder.interval_minutes) || 1) * 60_000)
        : nextDailyRun(new Date(), reminder.timezone || "Asia/Tehran", reminder.daily_time || "18:30");
      const { error: updateError } = await supabase.from("periodic_reminders")
        .update({ next_run_at: nextRun.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", reminder.id).eq("enabled", true);
      if (updateError) console.error("Could not schedule next periodic reminder", updateError.message);
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
