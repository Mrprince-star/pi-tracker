// api/complete-payment.js
// Vercel serverless function. After the user confirms in their Pi Wallet and
// the transaction is submitted to the Pi blockchain, our backend must call
// Pi's "complete" endpoint with the transaction id to finalize the payment.
//
// Setup: same PI_API_KEY environment variable as approve-payment.js.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { paymentId, txid } = req.body || {};
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

    // In a production app, this is also the right place to record the tip
    // (e.g. in a database) so "tipped" status can persist across sessions
    // instead of resetting if the user reloads the app.
    return res.status(200).json({ completed: true });
  } catch (err) {
    console.error("complete-payment handler error:", err);
    return res.status(500).json({ error: "Internal error completing payment" });
  }
}
