// api/complete-payment.js
// Vercel serverless function. After the user confirms in their Pi Wallet and
// the transaction is submitted to the Pi blockchain, our backend must call
// Pi's "complete" endpoint with the transaction id to finalize the payment.
//
// It also records that this Pi user has tipped, in Upstash Redis, so the
// "tipped" state persists across logins/devices instead of resetting to
// locked every time the app reloads (React state alone doesn't survive a
// refresh, and there's no source of truth for "did this person already pay"
// without storing it somewhere server-side).
//
// Setup:
// - PI_API_KEY: same as approve-payment.js
// - KV_REST_API_URL and KV_REST_API_TOKEN: auto-injected by Vercel once the
//   "Upstash for Redis" integration (Marketplace > Storage) is connected to
//   this project. Vercel names these KV_REST_API_* rather than the more
//   generic UPSTASH_REDIS_REST_* names Upstash itself uses elsewhere.

async function recordTip(uid) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token || !uid) return; // Not configured yet, or no uid available — skip quietly.
  try {
    await fetch(`${url}/set/tipped:${encodeURIComponent(uid)}/true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error("Failed to record tip in Upstash:", err);
    // Payment already succeeded on-chain — don't fail the request over this.
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { paymentId, txid, uid } = req.body || {};
  if (!paymentId || !txid) {
    return res.status(400).json({ error: "Missing paymentId or txid" });
  }

  try {
    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Pi complete-payment error:", errText);
      return res.status(502).json({ error: "Failed to complete payment with Pi Platform API" });
    }

    await recordTip(uid);

    return res.status(200).json({ completed: true });
  } catch (err) {
    console.error("complete-payment handler error:", err);
    return res.status(500).json({ error: "Internal error completing payment" });
  }
}

