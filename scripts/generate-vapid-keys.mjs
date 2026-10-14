import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const base64url = (value) => Buffer.from(value).toString("base64url");
const publicKeyBytes = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(pub.x, "base64url"),
  Buffer.from(pub.y, "base64url"),
]);

console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + base64url(publicKeyBytes));
console.log("VAPID_PUBLIC_KEY=" + base64url(publicKeyBytes));
console.log("VAPID_PRIVATE_KEY=" + priv.d);
console.log("VAPID_SUBJECT=mailto:your-email@example.com");
