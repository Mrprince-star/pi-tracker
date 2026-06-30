// src/pi.js
// Thin wrapper around the official Pi SDK (loaded via <script> tag in index.html
// as window.Pi). Keeping all direct Pi.* calls in one file makes it easy to see
// exactly what this app asks the Pi platform for, and easy to test/mock.

const isPiAvailable = () => typeof window !== "undefined" && !!window.Pi;

/**
 * The Pi SDK loads via a <script> tag, which can finish loading slightly
 * after our React code has already mounted and tried to call window.Pi.
 * This polls briefly (up to ~2s) before giving up, instead of checking once
 * and silently failing if the script just hadn't finished loading yet.
 */
function waitForPi(timeoutMs = 2000, intervalMs = 100) {
  return new Promise((resolve) => {
    if (isPiAvailable()) return resolve(true);
    const start = Date.now();
    const check = setInterval(() => {
      if (isPiAvailable()) {
        clearInterval(check);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(check);
        resolve(false);
      }
    }, intervalMs);
  });
}

/**
 * Initializes the Pi SDK. Must be called once before authenticate/payments.
 * `sandbox: true` should be used while testing in the Pi Developer Portal's
 * sandbox mode; set to false (or remove) only once approved for Mainnet.
 * Waits briefly for window.Pi to exist before giving up, since the SDK
 * <script> tag can still be loading when this first runs.
 */
export async function initPi({ sandbox = true } = {}) {
  const available = await waitForPi();
  if (!available) {
    console.warn("Pi SDK never became available — are we running inside Pi Browser?");
    return false;
  }
  window.Pi.init({ version: "2.0", sandbox });
  return true;
}

/**
 * Authenticates the user with the minimum scopes this app actually needs:
 * - "username": to personalize the greeting
 * - "payments": required before createPayment() can be called
 *
 * Returns { username, uid } on success, or null if the SDK isn't present
 * (e.g. when previewing outside the Pi Browser) or auth fails/is cancelled.
 */
export async function authenticateWithPi() {
  if (!isPiAvailable()) {
    console.warn("authenticateWithPi: Pi SDK not available.");
    return null;
  }
  try {
    const scopes = ["username", "payments"];
    const onIncompletePaymentFound = (payment) => {
      // A payment from a previous session never finished. Hand it to our
      // backend to resolve, so it doesn't block future payments.
      reportIncompletePayment(payment);
    };
    const authResult = await window.Pi.authenticate(scopes, onIncompletePaymentFound);
    console.log("Pi auth success:", authResult);
    return { username: authResult.user?.username ?? null, uid: authResult.user?.uid ?? null };
  } catch (err) {
    console.error("Pi authentication failed or was cancelled:", err);
    return null;
  }
}

/**
 * Creates a real Pi payment (e.g. the "Tip the dev" flow). This opens the
 * Pi Wallet confirmation UI for the user. Approval/completion happen via our
 * backend (see /api/approve-payment and /api/complete-payment) since Pi
 * requires server-side confirmation for security — it can't be done from the
 * frontend alone.
 *
 * @param {number} amount - amount in Pi
 * @param {string} memo - shown to the user in the confirmation UI
 * @param {object} callbacks - { onSuccess, onCancel, onError }
 */
export function createPiPayment(amount, memo, { onSuccess, onCancel, onError } = {}) {
  if (!isPiAvailable()) {
    onError?.(new Error("Pi SDK not available — open this app inside Pi Browser."));
    return;
  }
  try {
    window.Pi.createPayment(
      { amount, memo, metadata: { type: "tip" } },
      {
        onReadyForServerApproval: async (paymentId) => {
          console.log("onReadyForServerApproval:", paymentId);
          await fetch("/api/approve-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId }),
          });
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          console.log("onReadyForServerCompletion:", paymentId, txid);
          await fetch("/api/complete-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId, txid }),
          });
          onSuccess?.({ paymentId, txid });
        },
        onCancel: (paymentId) => {
          console.log("Payment cancelled:", paymentId);
          onCancel?.(paymentId);
        },
        onError: (error, payment) => {
          console.error("Pi payment error:", error, payment);
          onError?.(error, payment);
        },
      }
    );
  } catch (err) {
    console.error("createPiPayment threw synchronously:", err);
    onError?.(err);
  }
}

async function reportIncompletePayment(payment) {
  try {
    await fetch("/api/complete-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payment.identifier, txid: payment.transaction?.txid }),
    });
  } catch (err) {
    console.warn("Could not resolve incomplete payment:", err);
  }
}

/**
 * Shows an interstitial ad at a natural pause point, only if:
 * - the Pi SDK and Ads module are present, and
 * - this app has been approved for the Pi Ad Network, and an ad is ready.
 * Fails silently otherwise — never blocks the app's core functionality.
 */
export async function maybeShowInterstitialAd() {
  if (!isPiAvailable() || !window.Pi.Ads) return;
  try {
    const ready = await window.Pi.Ads.isAdReady("interstitial");
    if (ready?.ready) await window.Pi.Ads.showAd("interstitial");
  } catch (err) {
    // Not approved yet, or ad unavailable — this is expected pre-approval.
  }
}
