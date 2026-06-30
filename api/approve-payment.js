// api/approve-payment.js
// Vercel serverless function. Pi requires server-side approval of a payment
// before the user's wallet will let them confirm it — this can't be done
// from the frontend, since it needs your app's secret API key.
//
// Setup: in your Vercel project settings, add an environment variable
// PI_API_KEY with the key from the Pi Developer Portal. Never put this key
// in any frontend file.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { paymentId } = req.body || {};
  if (!paymentId) {
    return res.status(400).json({ error: "Missing paymentId" });
  }

  try {
    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Pi approve-payment error:", errText);
      return res.status(502).json({ error: "Failed to approve payment with Pi Platform API" });
    }

    return res.status(200).json({ approved: true });
  } catch (err) {
    console.error("approve-payment handler error:", err);
    return res.status(500).json({ error: "Internal error approving payment" });
  }
}
