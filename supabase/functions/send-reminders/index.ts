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
    .from("tasks").select("id,user_id,title,status,reminders").neq("status", "done");
  if (taskError) return new Response(taskError.message, { status: 500, headers: corsHeaders });

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
            body: task.title,
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
  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
