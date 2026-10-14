import { createClient } from "@supabase/supabase-js";
import {
  createCipheriv,
  createPrivateKey,
  createSign,
  diffieHellman,
  generateKeyPairSync,
  createHmac,
  randomBytes,
} from "node:crypto";

const b64url = (value) => Buffer.from(value).toString("base64url");
const fromB64url = (value) => Buffer.from(value, "base64url");

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function hkdfExpand(prk, info, length) {
  const chunks = [];
  let previous = Buffer.alloc(0);
  let counter = 1;
  let total = 0;
  while (total < length) {
    previous = hmac(prk, Buffer.concat([previous, info, Buffer.from([counter])]));
    chunks.push(previous);
    total += previous.length;
    counter += 1;
  }
  return Buffer.concat(chunks).subarray(0, length);
}

function vapidToken(endpoint, publicKey, privateKey, subject) {
  const publicBytes = fromB64url(publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw new Error("VAPID_PUBLIC_KEY must be a base64url uncompressed P-256 public key.");
  }
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: b64url(publicBytes.subarray(1, 33)),
    y: b64url(publicBytes.subarray(33, 65)),
    d: privateKey,
  };
  const key = createPrivateKey({ key: jwk, format: "jwk" });
  const origin = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64url(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  }));
  const unsigned = header + "." + payload;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" });
  return unsigned + "." + b64url(signature);
}

function encryptPayload(subscription, payload) {
  const userPublic = fromB64url(subscription.p256dh);
  const authSecret = fromB64url(subscription.auth);
  if (userPublic.length !== 65 || userPublic[0] !== 4 || authSecret.length < 16) {
    throw new Error("Invalid push subscription keys.");
  }

  const { publicKey: ephemeralPublicKey, privateKey: ephemeralPrivateKey } =
    generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const ephemeralJwk = ephemeralPublicKey.export({ format: "jwk" });
  const ephemeralBytes = Buffer.concat([
    Buffer.from([4]),
    fromB64url(ephemeralJwk.x),
    fromB64url(ephemeralJwk.y),
  ]);
  const userJwk = {
    kty: "EC",
    crv: "P-256",
    x: b64url(userPublic.subarray(1, 33)),
    y: b64url(userPublic.subarray(33, 65)),
  };
  const sharedSecret = diffieHellman({
    privateKey: ephemeralPrivateKey,
    publicKey: createPublicKey({ key: userJwk, format: "jwk" }),
  });

  const prkKey = hmac(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    userPublic,
    ephemeralBytes,
  ]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);
  const salt = randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);
  const plaintext = Buffer.concat([Buffer.from(JSON.stringify(payload), "utf8"), Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([ephemeralBytes.length]),
    ephemeralBytes,
    encrypted,
  ]);
}

async function sendWebPush(subscription, payload, env) {
  const token = vapidToken(
    subscription.endpoint,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
    env.VAPID_SUBJECT || "mailto:admin@example.com"
  );
  const body = encryptPayload(subscription, payload);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${env.VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
    },
    body,
  });
  if (!response.ok) {
    const error = new Error(`Push service returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
}

export const config = { schedule: "* * * * *" };

export default async (request, context) => {
  const env = process.env;
  const manualSecret = env.SCHEDULER_SECRET;
  const isScheduled = Boolean(context?.scheduledTime);
  if (!isScheduled && (!manualSecret || request.headers.get("authorization") !== `Bearer ${manualSecret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) {
    return Response.json({ error: "Missing environment variables", missing }, { status: 500 });
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: dueReminders, error: claimError } = await supabase.rpc("claim_due_push_reminders");
    if (claimError) throw claimError;
    const summary = { claimed: dueReminders?.length || 0, sent: 0, failed: 0, removedSubscriptions: 0 };

    for (const reminder of dueReminders || []) {
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", reminder.user_id);
      if (subscriptionError) throw subscriptionError;

      if (!subscriptions?.length) {
        await supabase.from("push_delivery_log")
          .update({ status: "failed", last_error: "No push subscription registered" })
          .eq("task_id", reminder.task_id).eq("reminder_id", reminder.reminder_id);
        summary.failed += 1;
        continue;
      }

      let delivered = false;
      const errors = [];
      for (const subscription of subscriptions) {
        try {
          await sendWebPush(subscription, {
            title: "یادآور ددلاین",
            body: `زمان یادآوری کار «${reminder.task_title}» رسیده است.`,
            url: "/",
            tag: `deadline-${reminder.task_id}-${reminder.reminder_id}`,
          }, env);
          delivered = true;
        } catch (error) {
          errors.push(error?.message || "Unknown push error");
          if (error?.status === 404 || error?.status === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
            summary.removedSubscriptions += 1;
          }
        }
      }

      if (delivered) {
        await supabase.from("push_delivery_log")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("task_id", reminder.task_id).eq("reminder_id", reminder.reminder_id);
        summary.sent += 1;
      } else {
        await supabase.from("push_delivery_log")
          .update({ status: "failed", last_error: errors.join("; ").slice(0, 1000) || "Delivery failed" })
          .eq("task_id", reminder.task_id).eq("reminder_id", reminder.reminder_id);
        summary.failed += 1;
      }
    }

    return Response.json(summary);
  } catch (error) {
    console.error("Scheduled push delivery failed:", error);
    return Response.json({ error: error?.message || "Scheduled push delivery failed" }, { status: 500 });
  }
};
