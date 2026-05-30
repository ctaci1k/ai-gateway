// app.jsx — AI Gateway multi-model UI
const { useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "sidebarStyle": "bar",
  "accent": "#8b5cf6"
}/*EDITMODE-END*/;

const ACCENTS = ["#8b5cf6", "#6366f1", "#10b981", "#e0a13c", "#38bdf8"];

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

const MODELS = [
  {
    id: "groq", name: "GROQ", model: "llama-3.3-70b-versatile",
    time: "2.31s", tokens: "842", score: 87, winner: true,
    text: "AI Gateway is a system that sends a user prompt to multiple AI models at the same time. It collects all responses and uses an AI judge (Gemini) or a fallback script to evaluate them and choose the best one. This improves accuracy, reliability, and provides more diverse answers.",
  },
  {
    id: "cerebras", name: "CEREBRAS", model: "llama3.1-8b",
    time: "1.48s", tokens: "612", score: 78, winner: false,
    text: "AI Gateway works by distributing the user prompt across multiple AI models, getting their responses, and then selecting the best response using Gemini Judge or a script. This approach increases quality and ensures that the user receives the most helpful answer.",
  },
  {
    id: "sambanova", name: "SAMBANOVA", model: "Meta-Llama-3.3-70B-Instruct",
    time: "3.92s", tokens: "1021", score: 85, winner: false,
    text: "The AI Gateway takes your question and sends it to several AI models in parallel. It then compares all responses using Gemini Judge or a fallback script to pick the best one. This method improves response quality, reduces bias, and gives more comprehensive results.",
  },
];

/* ---------------- Sidebar ---------------- */
function SidebarItem({ icon, label, active, style, onClick }) {
  const base = "sb-item";
  const cls = active ? `${base} sb-active sb-active--${style}` : `${base} sb-ghost`;
  return (
    <button className={cls} onClick={onClick}>
      <span className="sb-bar" />
      <span className="sb-ic">{icon}</span>
      <span className="sb-label">{label}</span>
    </button>
  );
}

function Sidebar({ style }) {
  return (
    <aside className="sidebar">
      <div className="acct">
        <div className="acct-av"><IconUser size={17} /></div>
        <div className="acct-name">Ihor Shevchenko</div>
      </div>

      <button className="proj">
        <span>Chat 1 — Project Test</span>
        <IconChevron size={16} className="proj-chev" />
      </button>

      <SidebarItem active style={style} icon={<IconChat size={17} />} label="AI Gateway" />

      <div className="sb-cap">New Chat</div>

      <button className="newchat">
        <IconPlus size={16} /><span>New Chat</span>
      </button>

      <SidebarItem icon={<IconChat size={17} />} label="Chat 2 — Analysis" />
      <SidebarItem icon={<IconChat size={17} />} label="Chat 3 — Notes" />

      <div className="syslog">
        <div className="syslog-head">
          <span className="syslog-title">System Log</span>
          <span className="stat"><i className="dot dot-on" />Online</span>
        </div>
        <div className="syslog-rows">
          <div className="syslog-row"><span>Gemini Judge</span><span className="stat"><i className="dot dot-on" />Online</span></div>
          <div className="syslog-row"><span>Fallback Script</span><span className="muted2">Ready</span></div>
          <div className="syslog-row"><span>Last sync</span><span className="mono muted2">12:42:18</span></div>
        </div>
      </div>
    </aside>
  );
}

/* ---------------- Messages ---------------- */
function ChatView({ onOpenAll, bannerOpen, setBannerOpen }) {
  return (
    <section className="chat">
      <div className="chat-top">
        {bannerOpen ? (
          <div className="banner">
            <span className="banner-ic"><IconInfo size={16} /></span>
            <div className="banner-body">
              <b>Gemini Judge is unavailable.</b>
              <span> Responses were evaluated by fallback script.</span>
            </div>
            <button className="banner-x" onClick={() => setBannerOpen(false)}><IconClose size={15} /></button>
          </div>
        ) : <span />}
        <button className="show-all" onClick={onOpenAll}>
          <IconGrid size={15} /><span>Show All Responses</span>
        </button>
      </div>

      <div className="msgs">
        <div className="msg msg-user">
          <div className="bubble bubble-user">
            <p>How does AI Gateway work?</p>
            <span className="time">12:41</span>
          </div>
          <div className="u-av"><IconUser size={15} /></div>
        </div>

        <div className="msg msg-ai">
          <div className="ai-av"><IconSparkle size={17} /></div>
          <div className="bubble bubble-ai">
            <p>AI Gateway works by sending your prompt to multiple AI models simultaneously, collecting their responses, and using an AI judge (Gemini) or a fallback script to select the best answer. This ensures higher quality, reliability, and diversity of responses.</p>
            <span className="time">12:42</span>
          </div>
        </div>
      </div>

      <div className="composer">
        <input className="composer-input" placeholder="Type your message…" />
        <button className="composer-send"><IconSend size={19} /></button>
      </div>
    </section>
  );
}

/* ---------------- Responses modal ---------------- */
function ScoreBar({ value }) {
  return (
    <div className="score-bar"><span style={{ width: `${value}%` }} /></div>
  );
}

function ResponseCard({ m }) {
  let cta;
  if (m.winner) cta = <button className="cta cta-win"><IconStar size={15} /><span>Selected by Gemini Judge</span></button>;
  else if (m.id === "cerebras") cta = <button className="cta cta-confirm"><IconCheck size={16} /><span>Confirm This Response</span></button>;
  else cta = <button className="cta cta-change"><IconSwap size={16} /><span>Change to This Response</span></button>;

  return (
    <div className={"rcard" + (m.winner ? " rcard-win" : "")}>
      {m.winner && <div className="rcard-flag">Best answer</div>}
      <div className="rcard-head">
        <div>
          <div className="rcard-name">{m.name}</div>
          <div className="rcard-model mono">{m.model}</div>
        </div>
        <div className="stats">
          <div className="stats-row"><span>Time</span><b className="mono">{m.time}</b></div>
          <div className="stats-row"><span>Tokens</span><b className="mono">{m.tokens}</b></div>
          <div className="stats-row"><span>Score</span><b className="mono">{m.score}<i>/100</i></b></div>
        </div>
      </div>
      <ScoreBar value={m.score} />
      <p className="rcard-text">{m.text}</p>
      {cta}
    </div>
  );
}

function ResponsesModal({ onClose }) {
  return (
    <div className="modal-wrap">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title"><IconGrid size={18} /><span>All Model Responses</span></div>
          <button className="modal-x" onClick={onClose}><IconClose size={18} /></button>
        </div>
        <div className="modal-grid">
          {MODELS.map(m => <ResponseCard key={m.id} m={m} />)}
        </div>
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [showAll, setShowAll] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);

  const rootStyle = { "--accent": t.accent, "--accent-rgb": hexToRgb(t.accent) };

  return (
    <div className="app" style={rootStyle}>
      <Sidebar style={t.sidebarStyle} />
      <main className="main">
        <header className="topbar">
          <div className="topbar-l">
            <IconInfo size={17} className="topbar-info" />
            <span><b>AI Gateway v1.0</b> <i className="topbar-sub">— Multi-Model Response System</i></span>
          </div>
          <div className="topbar-r">
            <IconClock size={15} /><span className="mono">12:42:18</span>
            <i className="dot dot-on" />
          </div>
        </header>
        <div className="stage">
          <ChatView onOpenAll={() => setShowAll(true)} bannerOpen={bannerOpen} setBannerOpen={setBannerOpen} />
          {showAll && <ResponsesModal onClose={() => setShowAll(false)} />}
        </div>
      </main>

      <TweaksPanel>
        <TweakSection label="Sidebar" />
        <TweakRadio label="Active style" value={t.sidebarStyle}
          options={["bar", "solid", "glow", "flat"]}
          onChange={(v) => setTweak("sidebarStyle", v)} />
        <TweakSection label="Accent" />
        <TweakColor label="Color" value={t.accent} options={ACCENTS}
          onChange={(v) => setTweak("accent", v)} />
        <TweakButton label={showAll ? "Close All Responses" : "Open All Responses"}
          onClick={() => setShowAll(s => !s)} />
      </TweaksPanel>
    </div>
  );
}

const style = document.createElement("style");
style.textContent = APP_CSS;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
