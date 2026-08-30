const html = "<!doctype html><html lang='pl'><meta charset='utf-8'><title>ShareGPT test</title><p>Test integracji ShareGPT Export.</p></html>";

const response = await fetch("https://ship.page/deploy?ttl=60", {
  method: "POST",
  headers: {
    "Content-Type": "text/html; charset=utf-8"
  },
  body: html,
  cache: "no-store",
  credentials: "omit",
  signal: AbortSignal.timeout(20000)
});

const payload = await response.json();
if (!response.ok) {
  throw new Error(`Hosting test failed with HTTP ${response.status}: ${payload.error || "unknown error"}`);
}
if (typeof payload.url !== "string" || !payload.url.startsWith("https://") || !payload.url.includes(".shipped.page/")) {
  throw new Error("Hosting test returned an invalid public URL.");
}

const verificationResponse = await fetch(payload.url, {
  cache: "no-store",
  redirect: "follow",
  signal: AbortSignal.timeout(20000)
});
const deployedHtml = await verificationResponse.text();
if (!verificationResponse.ok || !deployedHtml.includes("Test integracji ShareGPT Export.")) {
  throw new Error("Hosting accepted the upload but the public page did not return the expected HTML.");
}

console.log(JSON.stringify({
  ok: true,
  verified: true,
  url: payload.url,
  expiresAt: payload.expires_at || ""
}));
