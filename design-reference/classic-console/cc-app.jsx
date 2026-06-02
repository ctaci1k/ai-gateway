// cc-app.jsx — AI Gateway · Classic Console (interactive)
const { useState: useState_ } = React;

const MODELS = [
  { id: "groq", name: "GROQ", model: "llama-3.3-70b-versatile", color: "#f0663c", desc: "Fastest inference. Great for quick, low-latency single answers.", score: 87 },
  { id: "cerebras", name: "Cerebras", model: "llama3.1-8b", color: "#3b9d6e", desc: "Lightweight & efficient. Snappy replies on simpler prompts.", score: 78 },
  { id: "sambanova", name: "SambaNova", model: "Meta-Llama-3.3-70B", color: "#3b6fd4", desc: "High-capacity reasoning for longer, detailed responses.", score: 85 },
  { id: "gemini", name: "Gemini", model: "gemini-1.5-pro", color: "#9d7bf5", desc: "Strong general reasoning. Also acts as the judge in Compare.", score: 90 },
];

const SINGLE_HISTORY = [
  { id: "s1", title: "Routing explained", time: "12:42", active: true },
  { id: "s2", title: "Summarize PRD", time: "11:08" },
  { id: "s3", title: "Rewrite intro", time: "Mon" },
];
const COMPARE_HISTORY = [
  { id: "c1", title: "3-model analysis", time: "10:24" },
  { id: "c2", title: "Best caption", time: "Sun" },
];

/* ---------- shared bits ---------- */
const CCAvatar = ({ size = 32, ring }) => (
  <div className="cc-av" data-ring={ring ? "1" : undefined}
    style={{ width: size, height: size, fontSize: size * 0.38 }}>ІШ</div>
);

const FLAGS = { EN: "🇬🇧", UK: "🇺🇦", DE: "🇩🇪", FR: "🇫🇷" };

function LangMenu({ lang, onPick }) {
  const langs = [["EN", "English"], ["UK", "Українська"], ["DE", "Deutsch"], ["FR", "Français"]];
  return (
    <div className="cc-menu cc-menu-lang">
      <div className="cc-menu-cap">Language</div>
      {langs.map(([c, n]) => (
        <button key={c} className={"cc-menu-item" + (lang === c ? " is-sel" : "")} onClick={() => onPick(c)}>
          <span className="cc-menu-flag">{FLAGS[c]}</span><span className="lab">{n}</span>
          {lang === c && <EI.check size={15} className="chk" />}
        </button>
      ))}
    </div>
  );
}

function AccountMenu() {
  return (
    <div className="cc-menu cc-menu-acct">
      <div className="cc-acct-head">
        <CCAvatar size={42} ring />
        <div className="cc-acct-id"><b>Ihor Shevchenko</b><span>ihor@company.com</span></div>
      </div>
      <div className="cc-menu-sep" />
      <button className="cc-menu-item"><EI.user size={16} /><span className="lab">Profile &amp; Avatar</span></button>
      <button className="cc-menu-item"><EI.gear size={16} /><span className="lab">Account Settings</span></button>
      <button className="cc-menu-item"><EI.shield size={16} /><span className="lab">Security</span></button>
      <div className="cc-menu-sep" />
      <button className="cc-menu-item cc-menu-danger"><EI.logout size={16} /><span className="lab">Sign out</span></button>
    </div>
  );
}

/* ---------- accordion section ---------- */
function AccSection({ icon, label, sub, open, onToggle, mode, onNewChat, history, histOpen, onHistToggle, activeHist, onPickHist }) {
  return (
    <div className={"cc-acc" + (open ? " is-open" : "")}>
      <button className="cc-acc-head" onClick={onToggle}>
        <span className="ic">{icon}</span>
        <span className="lab">{label}<small>{sub}</small></span>
        <EI.chevD size={16} className="chev" />
      </button>
      {open && (
        <div className="cc-acc-body">
          <button className="cc-newchat" onClick={onNewChat}><EI.plus size={15} />New Chat</button>
          <div className={"cc-sub" + (histOpen ? " is-open" : "")}>
            <button className="cc-sub-head" onClick={onHistToggle}>
              <EI.history size={14} />History
              <EI.chevR size={13} className="chev" />
            </button>
            {histOpen && (
              <div className="cc-sub-body">
                {history.map(h => (
                  <button key={h.id} className={"cc-hrow" + (activeHist === h.id ? " is-active" : "")}
                    onClick={() => onPickHist(h.id)}>
                    <span className="dotm" /><span className="htx">{h.title}</span><span className="htime">{h.time}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- main views ---------- */
function ChatView({ model }) {
  return (
    <>
      <div className="cc-convo">
        <div className="cc-msg cc-msg-u">
          <div className="cc-bub cc-bub-u">How does AI Gateway route my prompt?</div>
          <CCAvatar size={28} />
        </div>
        <div className="cc-msg">
          <div className="cc-aiav"><EI.sparkle size={15} /></div>
          <div className="cc-bub cc-bub-a">In a single-model chat your prompt goes straight to <b>{model.name}</b> ({model.model}). Switch to <b>Compare</b> to send it to several models at once and let the judge pick the best reply.</div>
        </div>
      </div>
      <div className="cc-composer">
        <input placeholder={"Message " + model.name + "…"} />
        <button className="cc-send"><EI.send size={18} /></button>
      </div>
    </>
  );
}

function PickerView({ onPick }) {
  return (
    <div className="cc-pick">
      <div className="cc-pick-inner">
        <h2>Start a single-model chat</h2>
        <p>Choose which model should answer. You can switch models anytime from the chat header.</p>
        <div className="cc-pick-grid">
          {MODELS.map(m => (
            <button key={m.id} className="cc-mcard" onClick={() => onPick(m.id)}>
              <div className="cc-mcard-top">
                <span className="cc-mcard-ic" style={{ background: m.color }}><EI.sparkle size={18} /></span>
                <div><b>{m.name}</b><div className="mdl mono">{m.model}</div></div>
              </div>
              <div className="desc">{m.desc}</div>
              <span className="pickbtn">Use {m.name}<EI.chevR size={13} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompareView() {
  const ranked = [...MODELS].filter(m => m.id !== "gemini").sort((a, b) => b.score - a.score);
  return (
    <div className="cc-cmp">
      {ranked.map((m, i) => (
        <div key={m.id} className={"cc-cmp-card" + (i === 0 ? " win" : "")}>
          {i === 0 && <span className="cc-cmp-flag">Best · judged by Gemini</span>}
          <div className="cc-cmp-head"><b>{m.name}</b><span className="sc">{m.score}/100</span></div>
          <div className="cc-cmp-bar"><span style={{ width: m.score + "%" }} /></div>
          <div className="cc-cmp-tx">{m.desc} The judge scored this reply {m.score} of 100 on accuracy, clarity and completeness.</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- app ---------- */
function App() {
  const [theme, setTheme] = useState_("dark");
  const [lang, setLang] = useState_("EN");
  const [openLang, setOpenLang] = useState_(false);
  const [openAcct, setOpenAcct] = useState_(false);
  const [accSingle, setAccSingle] = useState_(true);
  const [accCompare, setAccCompare] = useState_(false);
  const [histSingle, setHistSingle] = useState_(true);
  const [histCompare, setHistCompare] = useState_(false);
  const [mode, setMode] = useState_("single"); // single | compare
  const [view, setView] = useState_("chat");    // chat | pick
  const [modelId, setModelId] = useState_("groq");
  const [activeHist, setActiveHist] = useState_("s1");

  const model = MODELS.find(m => m.id === modelId);

  const closeMenus = () => { setOpenLang(false); setOpenAcct(false); };

  return (
    <div className="cc-root" data-theme={theme} onClick={closeMenus}>
      {/* TOP BAR */}
      <div className="cc-top" onClick={e => e.stopPropagation()}>
        <div className="cc-iconbtn is-active" style={{ background: "linear-gradient(135deg,#7c5cf0,#9d7bf5)", color: "#fff", border: "none" }}>
          <EI.sparkle size={19} />
        </div>
        <div className="cc-top-title"><b>AI Gateway</b><span>Enterprise · v1.0</span></div>
        <div className="cc-spacer" />

        {/* theme toggle (moon / sun) */}
        <button className="cc-theme" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle theme">
          <span className="cc-theme-ic"><EI.moon size={16} /></span>
          <span className="cc-theme-ic"><EI.sun size={16} /></span>
          <span className="cc-theme-knob">{theme === "dark" ? <EI.moon size={15} /> : <EI.sun size={15} />}</span>
        </button>

        {/* language */}
        <div style={{ position: "relative" }}>
          <button className={"cc-langpill" + (openLang ? " is-open" : "")} onClick={() => { setOpenLang(o => !o); setOpenAcct(false); }}>
            <span className="cc-flag">{FLAGS[lang]}</span><b>{lang}</b><EI.chevD size={13} style={{ opacity: .6 }} />
          </button>
          {openLang && <LangMenu lang={lang} onPick={(c) => { setLang(c); setOpenLang(false); }} />}
        </div>

        <div className="cc-divider" />
        {/* settings + admin moved here */}
        <button className="cc-iconbtn" title="Settings"><EI.gear size={18} /></button>
        <button className="cc-iconbtn" title="Admin panel"><EI.shield size={18} /></button>
        <div className="cc-divider" />

        {/* account */}
        <div style={{ position: "relative" }}>
          <button className={"cc-userbtn" + (openAcct ? " is-open" : "")} onClick={() => { setOpenAcct(o => !o); setOpenLang(false); }}>
            <CCAvatar size={30} />
            <span className="cc-userbtn-tx"><b>Ihor Shevchenko</b><span>Admin</span></span>
            <EI.chevD size={15} style={{ color: "var(--e-tx3)" }} />
          </button>
          {openAcct && <AccountMenu />}
        </div>
      </div>

      {/* BODY */}
      <div className="cc-body">
        <aside className="cc-side">
          <div className="cc-side-scroll">
            <AccSection
              icon={<EI.models size={17} />} label="Single Models" sub="Chat with one model"
              open={accSingle} onToggle={() => setAccSingle(o => !o)}
              onNewChat={() => { setMode("single"); setView("pick"); }}
              history={SINGLE_HISTORY} histOpen={histSingle} onHistToggle={() => setHistSingle(o => !o)}
              activeHist={activeHist}
              onPickHist={(id) => { setActiveHist(id); setMode("single"); setView("chat"); }}
            />
            <AccSection
              icon={<EI.grid size={17} />} label="Compare" sub="Several models + judge"
              open={accCompare} onToggle={() => setAccCompare(o => !o)}
              onNewChat={() => { setMode("compare"); setView("chat"); }}
              history={COMPARE_HISTORY} histOpen={histCompare} onHistToggle={() => setHistCompare(o => !o)}
              activeHist={activeHist}
              onPickHist={(id) => { setActiveHist(id); setMode("compare"); setView("chat"); }}
            />
          </div>

          {/* creator credit (bottom-left) */}
          <div className="cc-creator">
            <div className="cc-creator-badge"><EI.code size={17} /></div>
            <div className="cc-creator-tx">
              <small>Created by</small>
              <b>Ihor Shevchenko</b>
              <span>© 2026 · All rights reserved</span>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="cc-main">
          <div className="cc-main-head">
            {mode === "single" ? (
              view === "pick" ? (
                <span className="cc-mode-tag">New single chat</span>
              ) : (
                <button className="cc-modelchip">
                  <span className="mdot" />{model.name}
                  <small>{model.model}</small>
                  <span className="sw"><EI.chevD size={14} /></span>
                </button>
              )
            ) : (
              <span className="cc-mode-tag">Compare · 3 models</span>
            )}
            <span className="cc-main-status"><span className="cc-dot" />Online</span>
          </div>
          <div className="cc-stage">
            {mode === "compare"
              ? <CompareView />
              : view === "pick"
                ? <PickerView onPick={(id) => { setModelId(id); setView("chat"); }} />
                : <ChatView model={model} />}
          </div>
        </main>
      </div>
    </div>
  );
}

const ccStyle = document.createElement("style");
ccStyle.textContent = CC_CSS;
document.head.appendChild(ccStyle);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
