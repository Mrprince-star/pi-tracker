// api/check-tip-status.js
// Vercel serverless function. Called once after a user authenticates, to
// check whether their Pi account has already tipped the dev previously —
// so unlocked extras (charts, CSV export, reminders, themes) stay unlocked
// across logins and devices, instead of resetting every time the app loads.
//
// Setup: same KV_REST_API_URL / KV_REST_API_TOKEN as complete-payment.js
// (auto-injected by Vercel's "Upstash for Redis" integration).

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid } = req.query || {};
  if (!uid) {
    return res.status(400).json({ error: "Missing uid" });
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    // Storage not configured yet — behave as "not tipped" rather than error,
    // so the app still works before this step is set up.
    return res.status(200).json({ tipped: false });
  }

  try {
    const response = await fetch(`${url}/get/tipped:${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return res.status(200).json({ tipped: data?.result === "true" });
  } catch (err) {
    console.error("check-tip-status error:", err);
    return res.status(200).json({ tipped: false });
  }
}
