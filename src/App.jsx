import { useState, useEffect, useMemo } from "react";
import { initPi, authenticateWithPi, createPiPayment, maybeShowInterstitialAd } from "./pi.js";

const APPROX_CIRCULATING = 870_000_000;
const APPROX_DAILY_UNLOCK = 6_500_000;

function formatPi(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function formatUSD(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const THEMES = {
  navy: { name: "Navy & Gold", ink: "#10182B", navyLight: "#22315A", gold: "#C9A24B", goldSoft: "#E4CD8F", text: "#1B2540", textMuted: "#6B7390", border: "#E4E1D8", bgCard: "#FFFFFF", bgPage: "#F7F4EC" },
  forest: { name: "Forest & Sage", ink: "#13261E", navyLight: "#26473A", gold: "#7FA37A", goldSoft: "#BFD8B8", text: "#1C2E26", textMuted: "#6B8278", border: "#DEE6DD", bgCard: "#FFFFFF", bgPage: "#F3F6F1" },
  plum: { name: "Plum & Rose", ink: "#2A1830", navyLight: "#452A4E", gold: "#C98AA3", goldSoft: "#E8C2D2", text: "#2A1B30", textMuted: "#806B89", border: "#EBE0EB", bgCard: "#FFFFFF", bgPage: "#FAF5F8" },
  slate: { name: "Slate & Sky", ink: "#1B232C", navyLight: "#33424F", gold: "#6FA8C9", goldSoft: "#B9DCEC", text: "#1E2630", textMuted: "#6B7B89", border: "#E2E7EB", bgCard: "#FFFFFF", bgPage: "#F4F7F9" },
};
// COLORS is a single mutable object so existing inline styles (which read
// COLORS.x directly) update automatically when the active theme changes —
// the component forces a re-render via themeVersion whenever this mutates.
const COLORS = { ...THEMES.navy };
function applyTheme(key) {
  Object.assign(COLORS, THEMES[key]);
}

const CURRENCIES = {
  USD: { symbol: "$", rate: 1 },
  EUR: { symbol: "€", rate: 0.92 },
  GBP: { symbol: "£", rate: 0.79 },
  NGN: { symbol: "₦", rate: 1530 },
  INR: { symbol: "₹", rate: 83.4 },
  PHP: { symbol: "₱", rate: 56.1 },
};

function UnlockRing({ percent, size = 144 }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(Math.max(percent, 0), 100) / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE7D6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.gold} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600, color: COLORS.ink }}>{percent.toFixed(0)}%</span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: COLORS.textMuted, letterSpacing: "0.06em" }}>UNLOCKED</span>
      </div>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: COLORS.bgCard, borderRadius: 18, padding: "20px 18px", boxShadow: "0 1px 2px rgba(16,24,43,0.04), 0 6px 20px rgba(16,24,43,0.06)", border: `1px solid ${COLORS.border}`, boxSizing: "border-box", width: "100%", ...style }}>
      {children}
    </div>
  );
}
function Label({ children, style }) {
  return <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: COLORS.gold, marginBottom: 8, ...style }}>{children}</div>;
}
function PageHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 16px 10px" }}>
      <button onClick={onBack} aria-label="Back" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>←</button>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: COLORS.ink, minWidth: 0 }}>{title}</div>
    </div>
  );
}
function StaticPage({ children }) {
  return <div style={{ padding: "4px 18px 90px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>;
}
function P({ children }) { return <p style={{ fontSize: 13.5, lineHeight: 1.65, color: COLORS.text, margin: 0 }}>{children}</p>; }
function H({ children }) { return <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15.5, fontWeight: 600, color: COLORS.ink, marginTop: 6 }}>{children}</div>; }
function Field({ label, value, onChange, placeholder = "0" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12.5, fontWeight: 500, display: "block", marginBottom: 5, color: COLORS.text }}>{label}</label>
      <input type="number" inputMode="decimal" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: `1.5px solid ${COLORS.border}`, fontSize: 15, fontFamily: "'JetBrains Mono', monospace", outline: "none", boxSizing: "border-box", background: COLORS.bgPage }}
        onFocus={(e) => (e.target.style.borderColor = COLORS.gold)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />
    </div>
  );
}
function ChecklistRow({ label, desc, checked, onToggle }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", cursor: "pointer" }}>
      <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${checked ? COLORS.gold : COLORS.border}`, background: checked ? COLORS.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
        {checked && <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>✓</span>}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.text, textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.6 : 1 }}>{label}</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}
// "What / Why / How" intro block used at the top of every individual tool page
function ToolIntro({ what, why, how }) {
  return (
    <Card style={{ background: COLORS.bgPage, border: `1px dashed ${COLORS.border}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <Label style={{ marginBottom: 4 }}>What this is</Label>
          <p style={{ fontSize: 13, color: COLORS.text, margin: 0, lineHeight: 1.55 }}>{what}</p>
        </div>
        <div>
          <Label style={{ marginBottom: 4 }}>Why it helps</Label>
          <p style={{ fontSize: 13, color: COLORS.text, margin: 0, lineHeight: 1.55 }}>{why}</p>
        </div>
        <div>
          <Label style={{ marginBottom: 4 }}>How to use it</Label>
          <p style={{ fontSize: 13, color: COLORS.text, margin: 0, lineHeight: 1.55 }}>{how}</p>
        </div>
      </div>
    </Card>
  );
}
function MiniLineChart({ data, height = 140 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12.5, color: COLORS.textMuted }}>
        Save at least 2 snapshots to see a trend line.
      </div>
    );
  }
  const width = 280;
  const pad = 16;
  const values = data.map((d) => d.total);
  const max = Math.max(...values, 0.0001);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (data.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y];
  });
  const pathD = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const areaD = `${pathD} L${points[points.length - 1][0]},${height - pad} L${points[0][0]},${height - pad} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d={areaD} fill={COLORS.gold} opacity="0.12" />
      <path d={pathD} fill="none" stroke={COLORS.gold} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={COLORS.ink} />)}
    </svg>
  );
}

function ToolRow({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: "white", border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "16px 14px", cursor: "pointer", boxShadow: "0 1px 2px rgba(16,24,43,0.04)" }}>
      <div style={{ fontSize: 22, width: 36, height: 36, borderRadius: 10, background: COLORS.bgPage, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{title}</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 1 }}>{desc}</div>
      </div>
      <span style={{ color: COLORS.textMuted, fontSize: 16, flexShrink: 0 }}>›</span>
    </button>
  );
}

export default function PiTracker() {
  const [page, setPage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState(null);
  const [piReady, setPiReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authDebug, setAuthDebug] = useState(null);

  const [mined, setMined] = useState("");
  const [migrated, setMigrated] = useState("");
  const [locked, setLocked] = useState("");
  const [priceUsd] = useState(0.13);
  const [tipped, setTipped] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [savedReminder, setSavedReminder] = useState(null);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);

  const [baseRate, setBaseRate] = useState("0.39");
  const [circleCount, setCircleCount] = useState("0");
  const [referralCount, setReferralCount] = useState("0");

  const [convAmount, setConvAmount] = useState("100");
  const [convCurrency, setConvCurrency] = useState("USD");

  const [daysMining, setDaysMining] = useState("0");
  const [hasReferrals, setHasReferrals] = useState(false);
  const [hasNode, setHasNode] = useState(false);

  const [checklist, setChecklist] = useState({ wallet: false, kyc: false, lockup: false, security: false });
  const [activeTheme, setActiveTheme] = useState("navy");
  const [, setThemeVersion] = useState(0);

  function chooseTheme(key) {
    applyTheme(key);
    setActiveTheme(key);
    setThemeVersion((v) => v + 1); // forces re-render so mutated COLORS values are reflected
    setToast(`Theme set to ${THEMES[key].name}`);
  }

  function downloadCsv() {
    if (history.length === 0) {
      setToast("No snapshots yet to export");
      return;
    }
    const header = "date,mined,migrated,locked,total\n";
    const rows = history.map((h) => `${h.date},${h.mined},${h.migrated},${h.locked},${h.total}`).join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pi-tracker-history.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast("CSV downloaded");
  }

  // Initialize and authenticate with Pi once, on mount. If the SDK isn't
  // present (e.g. previewing in a regular browser, not Pi Browser),
  // authenticateWithPi() resolves to null and the app simply runs without
  // a personalized greeting or live payments — everything else still works.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ready = await initPi({ sandbox: true }); // set sandbox: false only after Mainnet approval
      if (cancelled) return;
      setPiReady(ready);
      if (ready) {
        const result = await authenticateWithPi();
        if (cancelled) return;
        setAuthDebug(result);
        if (result?.username) {
          setUsername(result.username);
          setIsAuthenticated(true);
        } else {
          console.warn("Pi auth completed without a username:", result?.error);
        }
      } else {
        setAuthDebug({ error: "Pi SDK never loaded (window.Pi missing)." });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const minedNum = parseFloat(mined) || 0;
  const migratedNum = parseFloat(migrated) || 0;
  const lockedNum = parseFloat(locked) || 0;
  const totalHoldings = minedNum + migratedNum + lockedNum;

  const unlockedPercent = useMemo(() => (totalHoldings <= 0 ? 0 : (migratedNum / totalHoldings) * 100), [migratedNum, totalHoldings]);

  const projection = useMemo(() => {
    if (lockedNum <= 0) return [];
    const networkLockedShare = lockedNum / APPROX_CIRCULATING;
    return [3, 6, 12, 24].map((m) => {
      const networkUnlockedByThen = APPROX_DAILY_UNLOCK * 30 * m;
      const estReleased = Math.min(lockedNum, networkUnlockedByThen * networkLockedShare * 40);
      return { month: m, est: Math.min(estReleased, lockedNum) };
    });
  }, [lockedNum]);

  const usdValue = totalHoldings * priceUsd;

  const proFeatures = [
    { icon: "📈", title: "Historical charts", desc: "Track how your entered balances change over time" },
    { icon: "⬇️", title: "CSV export", desc: "Download your data anytime, fully yours" },
    { icon: "🔔", title: "Unlock reminders", desc: "Get a nudge on dates that matter to you" },
    { icon: "🎨", title: "Custom themes", desc: "A few extra looks for your dashboard" },
  ];

  async function logSnapshot() {
    setHistory((h) => [...h, { date: new Date().toISOString(), total: totalHoldings, mined: minedNum, migrated: migratedNum, locked: lockedNum }].slice(-12));
    setToast("Snapshot saved to History");
    await maybeShowInterstitialAd();
  }
  function handleTip() {
    setShowTipModal(false);
    if (!piReady) {
      setToast("Open this app in Pi Browser to send a real tip.");
      return;
    }
    if (!isAuthenticated) {
      setToast("Couldn't verify your Pi account yet — please reopen the app and try again.");
      return;
    }
    createPiPayment(1, "Tip for Pi Tracker", {
      onSuccess: () => {
        setTipped(true);
        setToast("Thank you 💛 Extras unlocked");
      },
      onCancel: () => setToast("Tip cancelled"),
      onError: (err) => {
        console.error(err);
        setToast("Something went wrong sending the tip");
      },
    });
  }
  function handleSaveReminder() { if (!reminderDate) return; setSavedReminder(reminderDate); setToast("Reminder saved"); }

  const base = parseFloat(baseRate) || 0;
  const circles = Math.min(parseInt(circleCount) || 0, 5);
  const referrals = Math.max(parseInt(referralCount) || 0, 0);
  const circleBonus = circles * 0.2;
  const referralBonus = referrals * 0.25;
  const effectiveRate = base * (1 + circleBonus + referralBonus);

  const piAmt = parseFloat(convAmount) || 0;
  const conv = CURRENCIES[convCurrency];
  const convertedValue = piAmt * priceUsd * conv.rate;

  const daysNum = parseInt(daysMining) || 0;
  const roles = [
    { name: "Pioneer", met: true, note: "Everyone starts here." },
    { name: "Contributor", met: daysNum >= 3, note: "Mine for 3 days to unlock Security Circles." },
    { name: "Ambassador", met: hasReferrals, note: "Invite at least one active referral." },
    { name: "Node", met: hasNode, note: "Run the Pi Node app on a desktop." },
  ];
  const currentRole = [...roles].reverse().find((r) => r.met)?.name || "Pioneer";

  const checklistItems = [
    { key: "wallet", label: "Create your Pi Wallet", desc: "Set up your non-custodial wallet and securely back up your passphrase." },
    { key: "kyc", label: "Complete KYC", desc: "Verify your identity so your balance is eligible to migrate." },
    { key: "security", label: "Build your Security Circle", desc: "Add trusted Pioneers to strengthen the network's trust graph." },
    { key: "lockup", label: "Set a lockup configuration", desc: "Optionally commit a lockup period to help stabilize the network." },
  ];
  const checklistDone = Object.values(checklist).filter(Boolean).length;

  const toolIndex = [
    { key: "tool-mining", icon: "🧮", title: "Mining rate calculator", desc: "See your effective hourly rate" },
    { key: "tool-currency", icon: "💱", title: "Currency converter", desc: "Turn π into real-world money" },
    { key: "tool-role", icon: "🏅", title: "Role progress", desc: "Pioneer → Contributor → Ambassador → Node" },
    { key: "tool-checklist", icon: "📋", title: "Mainnet checklist", desc: `${checklistDone}/4 steps tracked` },
  ];

  const navItems = [
    { key: "about", label: "About", icon: "ⓘ" },
    { key: "support", label: "Support & FAQ", icon: "✦" },
    { key: "privacy", label: "Privacy Policy", icon: "🔒" },
    { key: "contact", label: "Contact", icon: "✉" },
  ];
  const tabItems = [
    { key: "tools", label: "Tools", icon: "▣" },
    { key: "history", label: "History", icon: "▤" },
    { key: "support", label: "Support", icon: "✦" },
    { key: "more", label: "More", icon: "☰" },
  ];
  const isToolsActive = page === "tools" || page.startsWith("tool-");

  function goTab(key) {
    if (key === "more") setMenuOpen(true);
    else setPage(key);
  }
  function goHome() { setPage("dashboard"); setMenuOpen(false); }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bgPage, fontFamily: "'Inter', sans-serif", color: COLORS.text, maxWidth: 480, margin: "0 auto", position: "relative", overflowX: "hidden", paddingBottom: 64 }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" />

      <div style={{ background: COLORS.ink, padding: "16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => setMenuOpen(true)} aria-label="Open menu" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>☰</button>
        <button onClick={goHome} aria-label="Go to dashboard" style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: COLORS.gold, color: COLORS.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', serif", fontSize: 13, fontWeight: 700 }}>π</div>
          <span style={{ color: "white", fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600 }}>Pi Tracker</span>
        </button>
        <div style={{ width: 36 }} />
      </div>

      {/* DASHBOARD */}
      {page === "dashboard" && (
        <div style={{ padding: "16px 16px 50px", display: "flex", flexDirection: "column", gap: 14 }}>
          {authDebug?.error && (
            <div style={{ background: "#FFF3CD", border: "1px solid #E0B341", borderRadius: 12, padding: "10px 12px", fontSize: 11.5, color: "#5C4400", lineHeight: 1.5, wordBreak: "break-word" }}>
              <strong>Debug — Pi auth status:</strong> piReady={String(piReady)}, error: {authDebug.error}
            </div>
          )}
          <Card style={{ background: `linear-gradient(135deg, ${COLORS.ink} 0%, ${COLORS.navyLight} 100%)`, border: "none" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16.5, fontWeight: 600, color: "white", marginBottom: 6 }}>
              {username ? `Welcome back, ${username}` : "Welcome to Pi Tracker"}
            </div>
            <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, margin: 0 }}>
              Pi Tracker is a companion for your Pi journey. Enter the numbers you already see in your own Pi app, and get a clear view of your holdings, mining rate, role progress, and the steps left before Mainnet — no passphrase or login ever needed.
            </p>
          </Card>

          <Card style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <UnlockRing percent={unlockedPercent} />
            <div style={{ flex: "1 1 140px", minWidth: 0 }}>
              <Label>Total holdings</Label>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 21, fontWeight: 600, wordBreak: "break-word" }}>{formatPi(totalHoldings)} π</div>
              <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 2 }}>≈ {formatUSD(usdValue)} at {formatUSD(priceUsd)}/π</div>
            </div>
          </Card>

          <div>
            <Label style={{ paddingLeft: 2 }}>Quick tools</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {toolIndex.map((t) => (
                <button key={t.key} onClick={() => setPage(t.key)}
                  style={{ textAlign: "left", background: "white", border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "14px 12px", cursor: "pointer", boxShadow: "0 1px 2px rgba(16,24,43,0.04)" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Card>
            <Label>Your balances</Label>
            <p style={{ fontSize: 12.5, color: COLORS.textMuted, margin: "-2px 0 14px", lineHeight: 1.5 }}>Enter what you see in your Pi app. Nothing is sent anywhere — this stays on your device.</p>
            <Field label="Mining balance (not yet migrated)" value={mined} onChange={setMined} />
            <Field label="Migrated balance (on Mainnet)" value={migrated} onChange={setMigrated} />
            <Field label="Locked balance" value={locked} onChange={setLocked} />
            <button onClick={logSnapshot} disabled={totalHoldings <= 0}
              style={{ width: "100%", padding: "11px", borderRadius: 12, border: `1.5px solid ${COLORS.ink}`, background: "transparent", color: totalHoldings > 0 ? COLORS.ink : COLORS.textMuted, fontWeight: 600, fontSize: 13, cursor: totalHoldings > 0 ? "pointer" : "default", marginTop: 4 }}>
              Save snapshot to History
            </button>
          </Card>

          <Card>
            <Label>How unlocks actually work</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { t: "Mining balance", d: "Pi you've earned daily. Becomes transferable after you pass KYC and complete the Mainnet checklist." },
                { t: "Tentative KYC", d: "Your documents passed initial checks, but final approval is still in progress. This is common and usually resolves with liveness checks." },
                { t: "Locked balance", d: "Released gradually over time as part of the network-wide unlock schedule — not something any single app can speed up." },
              ].map((item) => (
                <div key={item.t} style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.gold, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.t}</div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{item.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {lockedNum > 0 && (
            <Card>
              <Label>Rough unlock outlook</Label>
              <p style={{ fontSize: 11.5, color: COLORS.textMuted, margin: "-2px 0 14px", lineHeight: 1.5 }}>An estimate based on public, network-wide unlock pacing — not official data about your account.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {projection.map((p) => (
                  <div key={p.month} style={{ textAlign: "center", minWidth: 0 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis" }}>{formatPi(p.est)}</div>
                    <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 2 }}>in {p.month}mo</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Label style={{ marginBottom: 0 }}>Unlock reminder</Label>
              {!tipped && <span style={{ fontSize: 10.5, color: COLORS.gold, fontWeight: 700, letterSpacing: "0.04em" }}>EXTRA</span>}
            </div>
            {tipped ? (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12.5, color: COLORS.textMuted, margin: "0 0 12px" }}>Set a date and we'll keep it visible here for you.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
                    style={{ flex: "1 1 140px", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${COLORS.border}`, fontSize: 14, fontFamily: "'Inter', sans-serif", minWidth: 0 }} />
                  <button onClick={handleSaveReminder} style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: COLORS.ink, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Save</button>
                </div>
                {savedReminder && <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.ink, fontWeight: 600 }}>📌 Reminder set for {new Date(savedReminder).toLocaleDateString()}</div>}
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: COLORS.textMuted, margin: 0, lineHeight: 1.5 }}>Tip the dev to unlock reminders, charts, exports, and themes.</p>
            )}
          </Card>

          <Card style={{ background: `linear-gradient(135deg, ${COLORS.ink} 0%, ${COLORS.navyLight} 100%)`, border: "none" }}>
            <Label style={{ color: COLORS.goldSoft }}>Support this app</Label>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.55, margin: "0 0 14px" }}>Pi Tracker is free to use. If it's been useful, you can tip the dev — this also unlocks a few extras.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
              {proFeatures.map((f) => (
                <div key={f.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 15 }}>{f.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{f.title}</div>
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)" }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            {tipped ? (
              <div>
                <div style={{ textAlign: "center", padding: "10px", background: "rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 13, fontWeight: 600, color: COLORS.goldSoft, marginBottom: 14 }}>💛 Thanks for your support — extras unlocked</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>Choose a theme</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {Object.keys(THEMES).map((key) => (
                    <button key={key} onClick={() => chooseTheme(key)} aria-label={THEMES[key].name}
                      style={{ width: 40, height: 40, borderRadius: "50%", background: THEMES[key].gold, border: activeTheme === key ? "3px solid white" : "2px solid rgba(255,255,255,0.3)", cursor: "pointer", flexShrink: 0 }} />
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "8px 0 0" }}>Current: {THEMES[activeTheme].name}</p>
              </div>
            ) : (
              <button onClick={() => setShowTipModal(true)} style={{ width: "100%", padding: "13px", borderRadius: 14, border: "none", background: COLORS.gold, color: COLORS.ink, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Tip the dev — 1 π</button>
            )}
          </Card>

          <div style={{ textAlign: "center", fontSize: 10.5, color: "#A8A28E", padding: "4px 12px 0" }}>Figures are estimates for general understanding only, not official Pi Network data.</div>
        </div>
      )}

      {/* TOOLS INDEX */}
      {page === "tools" && (
        <div style={{ padding: "16px 16px 50px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: "-2px 0 4px", lineHeight: 1.55 }}>
            A few extra tools for everyday Pi questions. Tap any one to open it.
          </p>
          {toolIndex.map((t) => (
            <ToolRow key={t.key} icon={t.icon} title={t.title} desc={t.desc} onClick={() => setPage(t.key)} />
          ))}
        </div>
      )}

      {/* TOOL: Mining calculator */}
      {page === "tool-mining" && (
        <>
          <PageHeader title="Mining rate calculator" onBack={() => setPage("tools")} />
          <StaticPage>
            <ToolIntro
              what="A calculator that estimates your effective Pi mining rate per hour, based on the bonuses Pi Network publicly documents."
              why="Your mining rate isn't just your base rate — Security Circle and Referral Team bonuses can roughly double or triple it, but the official app doesn't show you the math behind that boost clearly."
              how="Enter your base mining rate, how many active Security Circle members you have (up to 5), and how many active referrals you have. The breakdown below updates instantly."
            />
            <Card>
              <Field label="Base mining rate (π/hour)" value={baseRate} onChange={setBaseRate} />
              <Field label="Active Security Circle members (max 5)" value={circleCount} onChange={setCircleCount} />
              <Field label="Active referrals" value={referralCount} onChange={setReferralCount} />
              <div style={{ marginTop: 4, padding: "12px 14px", background: COLORS.bgPage, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: COLORS.textMuted, marginBottom: 4 }}>
                  <span>Circle bonus (+20% each)</span><span>+{(circleBonus * 100).toFixed(0)}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: COLORS.textMuted, marginBottom: 8 }}>
                  <span>Referral bonus (+25% each)</span><span>+{(referralBonus * 100).toFixed(0)}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Effective rate</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: COLORS.ink }}>{effectiveRate.toFixed(4)} π/h</span>
                </div>
              </div>
            </Card>
            <p style={{ fontSize: 11.5, color: COLORS.textMuted, textAlign: "center", margin: 0 }}>Pi Network may adjust formulas or base rates over time — treat this as a general guide, not an exact match to your app.</p>
          </StaticPage>
        </>
      )}

      {/* TOOL: Currency converter */}
      {page === "tool-currency" && (
        <>
          <PageHeader title="Currency converter" onBack={() => setPage("tools")} />
          <StaticPage>
            <ToolIntro
              what="A simple converter that turns an amount of π into an approximate value in real-world currency."
              why="Most Pioneers think in π, but it helps to know roughly what that means in money you actually spend day to day."
              how="Type any amount of π, choose a currency, and see the converted value update instantly, based on the price shown on your Dashboard."
            />
            <Card>
              <Field label="Amount in π" value={convAmount} onChange={setConvAmount} />
              <label style={{ fontSize: 12.5, fontWeight: 500, display: "block", marginBottom: 5 }}>Currency</label>
              <select value={convCurrency} onChange={(e) => setConvCurrency(e.target.value)}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: `1.5px solid ${COLORS.border}`, fontSize: 14, background: COLORS.bgPage, marginBottom: 12, boxSizing: "border-box" }}>
                {Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ padding: "12px 14px", background: COLORS.bgPage, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 700, color: COLORS.ink }}>
                  {conv.symbol}{convertedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            </Card>
            <p style={{ fontSize: 11.5, color: COLORS.textMuted, textAlign: "center", margin: 0 }}>A rough estimate for everyday context, not a live trading quote — never financial advice.</p>
          </StaticPage>
        </>
      )}

      {/* TOOL: Role progress */}
      {page === "tool-role" && (
        <>
          <PageHeader title="Role progress" onBack={() => setPage("tools")} />
          <StaticPage>
            <ToolIntro
              what="A visual tracker for Pi's four roles: Pioneer, Contributor, Ambassador, and Node."
              why="Each role unlocks something — Contributor unlocks Security Circles, for example — but the requirements are scattered across different FAQ pages instead of shown in one place."
              how="Tell us how many days you've been mining and tick the boxes that apply to you. The list below highlights your current role and what's needed for the next one."
            />
            <Card>
              <Field label="Days mining (consecutive not required)" value={daysMining} onChange={setDaysMining} />
              <div style={{ display: "flex", gap: 16, margin: "4px 0 14px", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
                  <input type="checkbox" checked={hasReferrals} onChange={(e) => setHasReferrals(e.target.checked)} /> Have active referrals
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
                  <input type="checkbox" checked={hasNode} onChange={(e) => setHasNode(e.target.checked)} /> Run a Node
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {roles.map((r) => (
                  <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderRadius: 10, background: r.name === currentRole ? "rgba(201,162,75,0.12)" : COLORS.bgPage }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: r.met ? COLORS.ink : COLORS.textMuted }}>{r.name}{r.name === currentRole ? " · current" : ""}</div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted }}>{r.note}</div>
                    </div>
                    <span style={{ fontSize: 16 }}>{r.met ? "✅" : "—"}</span>
                  </div>
                ))}
              </div>
            </Card>
          </StaticPage>
        </>
      )}

      {/* TOOL: Mainnet checklist */}
      {page === "tool-checklist" && (
        <>
          <PageHeader title="Mainnet checklist" onBack={() => setPage("tools")} />
          <StaticPage>
            <ToolIntro
              what="A personal copy of the official steps Pi Network asks every Pioneer to complete before migrating to Mainnet."
              why="It's easy to lose track of which steps you've already finished in the official app, especially since some steps (like KYC review) can take a while between sessions."
              how="Tap a row to check it off as you complete each step in your real Pi app. This only updates your personal copy here — it doesn't affect your actual account."
            />
            <Card>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, color: COLORS.textMuted }}>{checklistDone}/4 complete</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {checklistItems.map((item) => (
                  <ChecklistRow key={item.key} label={item.label} desc={item.desc} checked={checklist[item.key]}
                    onToggle={() => setChecklist((c) => ({ ...c, [item.key]: !c[item.key] }))} />
                ))}
              </div>
            </Card>
          </StaticPage>
        </>
      )}

      {/* HISTORY */}
      {page === "history" && (
        <div style={{ padding: "16px 16px 50px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: "-2px 0 4px", lineHeight: 1.55 }}>
            Every time you save a snapshot from the Dashboard, it's logged here so you can see how your holdings change over time.
          </p>
          {history.length === 0 ? (
            <Card><p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0, lineHeight: 1.6 }}>No snapshots yet. Go to Dashboard, enter your balances, and tap <strong>Save snapshot</strong> to get started.</p></Card>
          ) : (
            <>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Label style={{ marginBottom: 0 }}>Historical chart</Label>
                  {!tipped && <span style={{ fontSize: 10.5, color: COLORS.gold, fontWeight: 700, letterSpacing: "0.04em" }}>EXTRA</span>}
                </div>
                {tipped ? (
                  <div style={{ marginTop: 10 }}>
                    <MiniLineChart data={history} />
                    <p style={{ fontSize: 11.5, color: COLORS.textMuted, textAlign: "center", margin: "8px 0 0" }}>Total π holdings across your saved snapshots.</p>
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: COLORS.textMuted, margin: "8px 0 0", lineHeight: 1.5 }}>Tip the dev from the Dashboard to unlock a visual trend chart of your snapshots.</p>
                )}
              </Card>

              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Label style={{ marginBottom: 0 }}>Saved snapshots</Label>
                  {tipped ? (
                    <button onClick={downloadCsv} style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.ink, background: COLORS.bgPage, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                      ⬇ Export CSV
                    </button>
                  ) : (
                    <span style={{ fontSize: 10.5, color: COLORS.gold, fontWeight: 700, letterSpacing: "0.04em" }}>CSV: EXTRA</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                  {history.slice().reverse().map((h, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < history.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                      <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>{formatDate(h.date)}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600 }}>{formatPi(h.total)} π</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ABOUT */}
      {page === "about" && (
        <>
          <PageHeader title="About Pi Tracker" onBack={goHome} />
          <StaticPage>
            <Card>
              <P>Pi Tracker is a personal companion for Pioneers who want a clearer picture of their Pi journey — holdings, mining rate, role progress, and the Mainnet steps ahead.</P>
              <H>Where it started</H>
              <P>It began as a simple question: with so many Pioneers, why is there no single place to make sense of mining bonuses, unlock timelines, and the checklist everyone eventually has to complete? Pi Tracker brings those pieces together in one calm, easy-to-read space, built independently using the tools Pi makes available to outside developers.</P>
              <H>What it does</H>
              <P>You enter numbers you already see in your own Pi app — balances, days mining, referral counts. Pi Tracker turns them into clear visuals: an unlock ring on your Dashboard, plus four individual tools — a mining rate calculator, a currency converter, a role progress tracker, and a Mainnet checklist. Snapshots you save are kept under History so you can see how your numbers move over time.</P>
              <H>What it doesn't do</H>
              <P>Pi Tracker never asks for your passphrase, seed phrase, or wallet credentials, and it has no technical ability to read your real balance, KYC status, or migration status. Those aren't available through any public or developer channel, by design, to protect Pioneers. Every figure you see is based on what you've typed in yourself, plus general, publicly known information about how the network works.</P>
              <H>Why it exists</H>
              <P>Many Pioneers have said the unlock and migration process feels confusing, and that mining bonuses are hard to estimate without doing the math by hand. Pi Tracker won't change the official process, but it can make today's numbers easier to understand while you wait for tomorrow's.</P>
              <H>Independence</H>
              <P>Pi Tracker is an independent, third-party companion built using the Pi SDK. It is not built, operated, or endorsed by the Pi Core Team, and isn't an official Pi Network product.</P>
            </Card>
          </StaticPage>
        </>
      )}

      {/* SUPPORT */}
      {page === "support" && (
        <>
          <PageHeader title="Support & FAQ" onBack={goHome} />
          <StaticPage>
            <Card>
              <H>Is my data safe?</H>
              <P>Yes. Your entered balances and tool inputs stay on your device. Pi Tracker never asks for your passphrase or wallet credentials, and has no way to access your real account data, even if it wanted to.</P>
              <H>Why can't I see my real balance automatically?</H>
              <P>The Pi platform doesn't currently give any third-party app read access to a user's balance, KYC, or migration status — that information stays private to you and the official Pi app. We ask you to enter numbers manually so nothing sensitive about your account ever needs to leave your hands.</P>
              <H>Are the unlock estimates official?</H>
              <P>No. They're general, educational estimates based on publicly reported network-wide unlock pacing. Your actual experience depends entirely on your own KYC and migration status with Pi Network directly — always treat the official Pi app as the source of truth for your real balance and status.</P>
              <H>How accurate is the mining rate calculator?</H>
              <P>It mirrors the publicly documented bonus structure — Security Circle bonuses (up to +20% per member, max 5) and Referral Team bonuses (+25% per active referral, uncapped). Pi Network may adjust formulas or base rates over time, so use it as a general guide rather than an exact match to what you see in your app.</P>
              <H>What happens when I tip the dev?</H>
              <P>Tipping is a one-time, optional payment of 1 π, sent through your Pi Wallet using the official Pi SDK. It simply unlocks a few extra display features within Pi Tracker — historical charts, CSV export, unlock reminders, and custom themes. It never unlocks access to anyone else's data.</P>
              <H>Will Pi Tracker ever show ads?</H>
              <P>If Pi Tracker is approved for the Pi Ad Network, it may show occasional full-screen ads at natural pause points, like after saving a snapshot — never ads that block core functionality. You'll never be asked to watch an ad to access your own entered data.</P>
              <H>How do I get help or report a bug?</H>
              <P>Visit the Contact page from the menu, or email us directly — we read every message and try to respond within a few days.</P>
            </Card>
          </StaticPage>
        </>
      )}

      {/* PRIVACY */}
      {page === "privacy" && (
        <>
          <PageHeader title="Privacy Policy" onBack={goHome} />
          <StaticPage>
            <Card>
              <P>Last updated: June 2026</P>
              <H>What we collect</H>
              <P>Pi Tracker stores the figures you manually enter — balances, mining stats, role progress, and checklist completion — locally on your own device. If you choose to connect with Pi, we receive only your Pi username, for personalization, as permitted by the Pi SDK's username scope.</P>
              <H>What we never collect</H>
              <P>We never request, receive, or store your passphrase, private keys, or any wallet credentials. We have no technical ability to access your actual Pi balance, KYC status, or account status, regardless of what you enter into Pi Tracker.</P>
              <H>Payments</H>
              <P>Optional tips are processed entirely through the Pi Wallet via the Pi SDK's payments scope. Pi Tracker never handles your payment credentials directly, and cannot initiate a payment without your explicit on-screen confirmation through the Pi Wallet itself.</P>
              <H>Advertising</H>
              <P>Pi Tracker is not currently part of the Pi Ad Network. If it's approved in the future, any ads shown will be delivered through Pi's own ad framework, governed by Pi Network's privacy practices, separate from the data you enter into Pi Tracker.</P>
              <H>Third parties</H>
              <P>We do not sell, rent, or share your entered data with advertisers or any third party.</P>
              <H>Your control</H>
              <P>You can clear your entered data at any time by clearing the app's local storage in your browser or device settings. Since all data is stored on your device, clearing site data or uninstalling removes it completely. There's no central server copy to request deletion from.</P>
              <H>Changes to this policy</H>
              <P>If this policy changes, we'll update the date above. Continued use after a change means you accept the updated terms.</P>
            </Card>
          </StaticPage>
        </>
      )}

      {/* CONTACT */}
      {page === "contact" && (
        <>
          <PageHeader title="Contact" onBack={goHome} />
          <StaticPage>
            <Card>
              <P>This page is for reporting bugs, suggesting features, asking questions about how Pi Tracker works, or flagging anything that feels off. We built this as Pioneers ourselves, so genuine feedback actually shapes what gets built next.</P>
              <H>Email</H>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink, margin: "4px 0 0" }}>faithfulbizteam@gmail.com</p>
              <H>What to include</H>
              <P>If you're reporting a bug, it helps to mention what you were doing, what you expected, and what happened instead. If you have an idea for a new tool, tell us how you'd use it — that context helps more than the feature name alone.</P>
              <H>A safety note</H>
              <P>Please don't include your Pi passphrase or any wallet credentials in your message. We will never ask for it, and you should never need to share it with anyone, including us.</P>
              <P>We aim to respond within a few days.</P>
            </Card>
          </StaticPage>
        </>
      )}

      {/* SIDE MENU */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex" }}>
          <div onClick={() => setMenuOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(16,24,43,0.5)" }} />
          <div style={{ position: "relative", width: "78%", maxWidth: 300, height: "100vh", maxHeight: "100vh", background: COLORS.ink, padding: "20px 16px", display: "flex", flexDirection: "column", boxShadow: "4px 0 24px rgba(0,0,0,0.25)", overflowY: "auto", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 4 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: COLORS.gold, color: COLORS.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 700 }}>π</div>
                <span style={{ color: "white", fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600 }}>Pi Tracker</span>
              </div>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu"
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                ✕
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[{ key: "dashboard", label: "Dashboard", icon: "◆" }, { key: "tools", label: "Tools", icon: "▣" }, { key: "history", label: "History", icon: "▤" }, ...navItems].map((item) => (
                <button key={item.key} onClick={() => { setPage(item.key); setMenuOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", borderRadius: 10, border: "none", background: page === item.key ? "rgba(201,162,75,0.15)" : "transparent", color: page === item.key ? COLORS.goldSoft : "rgba(255,255,255,0.85)", fontSize: 14.5, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 14, width: 18 }}>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Pi Tracker v1.0<br />Not affiliated with the Pi Core Team.</div>
            </div>
          </div>
        </div>
      )}

      {/* TIP MODAL */}
      {showTipModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(16,24,43,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 80 }} onClick={() => setShowTipModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "24px 20px 28px", width: "100%", maxWidth: 480, boxSizing: "border-box" }}>
            <div style={{ width: 36, height: 4, background: COLORS.border, borderRadius: 4, margin: "0 auto 18px" }} />
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Tip the dev</div>
            <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 18 }}>This sends 1 π via the Pi Wallet. You'll get a confirmation prompt before anything is sent.</p>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: COLORS.bgPage, borderRadius: 12, marginBottom: 18, fontSize: 13.5 }}>
              <span style={{ color: COLORS.textMuted }}>Amount</span><span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>1.00 π</span>
            </div>
            <button onClick={handleTip} style={{ width: "100%", padding: "13px", borderRadius: 14, border: "none", background: COLORS.ink, color: "white", fontWeight: 600, fontSize: 14.5, cursor: "pointer", marginBottom: 8 }}>Confirm tip</button>
            <button onClick={() => setShowTipModal(false)} style={{ width: "100%", padding: "13px", borderRadius: 14, border: "none", background: "transparent", color: COLORS.textMuted, fontWeight: 500, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: 74, left: "50%", transform: "translateX(-50%)", background: COLORS.ink, color: "white", padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 90, maxWidth: "90%", textAlign: "center" }}>
          {toast}
        </div>
      )}

      {/* BOTTOM TAB BAR */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "white", borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-around", padding: "8px 4px 10px", zIndex: 60, boxSizing: "border-box" }}>
        {tabItems.map((t) => {
          const active = t.key === "tools" ? isToolsActive : (t.key === page || (t.key === "more" && menuOpen));
          return (
            <button key={t.key} onClick={() => goTab(t.key)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 10px", color: active ? COLORS.ink : COLORS.textMuted }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
