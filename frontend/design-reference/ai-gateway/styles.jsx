// styles.jsx — defines window.APP_CSS
window.APP_CSS = `
.app { display: flex; height: 100vh; width: 100vw; }

/* ============ SIDEBAR (unified slate) ============ */
.sidebar {
  width: 290px; flex-shrink: 0; background: var(--sidebar);
  border-right: 1px solid var(--border);
  padding: 16px 14px; display: flex; flex-direction: column; gap: 10px;
}
.acct {
  display: flex; align-items: center; gap: 11px;
  background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; padding: 10px 12px;
}
.acct-av {
  width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
  display: grid; place-items: center; color: var(--text-2);
  background: rgba(148,163,184,0.10); border: 1px solid var(--border);
}
.acct-name { font-weight: 600; font-size: 14px; color: var(--text); }

.proj {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; padding: 11px 13px; font-size: 13.5px; font-weight: 600;
  color: var(--text); transition: border-color .15s, background .15s;
}
.proj:hover { border-color: var(--border-strong); background: var(--panel-2); }
.proj-chev { color: var(--text-3); }

/* sidebar items */
.sb-item {
  position: relative; display: flex; align-items: center; gap: 11px;
  width: 100%; padding: 11px 13px; border-radius: 11px; font-size: 13.5px;
  font-weight: 600; text-align: left; transition: background .15s, color .15s, box-shadow .15s;
}
.sb-bar { position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 0; border-radius: 0 3px 3px 0; background: var(--accent); transition: height .18s; }
.sb-ic { display: grid; place-items: center; flex-shrink: 0; }
.sb-label { flex: 1; }

.sb-ghost { color: var(--text-2); }
.sb-ghost:hover { background: rgba(148,163,184,0.07); color: var(--text); }

/* active variants */
.sb-active--bar { background: rgba(var(--accent-rgb),0.12); color: #fff; }
.sb-active--bar .sb-bar { height: 60%; }
.sb-active--bar .sb-ic { color: var(--accent); }

.sb-active--solid { background: var(--accent); color: #fff;
  box-shadow: 0 6px 18px -6px rgba(var(--accent-rgb),0.65); }
.sb-active--solid .sb-ic { color: #fff; }

.sb-active--glow { background: transparent; color: var(--accent);
  text-shadow: 0 0 16px rgba(var(--accent-rgb),0.55); }
.sb-active--glow .sb-ic { color: var(--accent); }

.sb-active--flat { background: rgba(148,163,184,0.13); color: #fff; }
.sb-active--flat .sb-ic { color: var(--text); }

.sb-cap { font-size: 10.5px; letter-spacing: 0.13em; text-transform: uppercase;
  color: var(--text-3); font-weight: 700; padding: 8px 4px 2px; }

.newchat {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 11px; border-radius: 11px; font-size: 13.5px; font-weight: 600;
  color: var(--text); background: rgba(148,163,184,0.05);
  border: 1px solid var(--border); transition: background .15s, border-color .15s;
}
.newchat:hover { background: rgba(148,163,184,0.10); border-color: var(--border-strong); }

.syslog { margin-top: auto; background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; padding: 12px 13px; display: flex; flex-direction: column; gap: 9px; }
.syslog-head { display: flex; align-items: center; justify-content: space-between; }
.syslog-title { font-size: 10.5px; letter-spacing: 0.13em; text-transform: uppercase;
  font-weight: 700; color: var(--text-3); }
.syslog-rows { display: flex; flex-direction: column; gap: 7px; }
.syslog-row { display: flex; align-items: center; justify-content: space-between;
  font-size: 12.5px; color: var(--text-2); }
.stat { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); }
.dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.dot-on { background: #2fd27a; box-shadow: 0 0 8px rgba(47,210,122,0.7); }
.muted2 { color: var(--text-2); }

/* ============ MAIN ============ */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column;
  padding: 16px 18px; gap: 14px; }

.topbar {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
  padding: 14px 20px; box-shadow: inset 2px 0 0 -1px rgba(var(--accent-rgb),0.5);
}
.topbar-l { display: flex; align-items: center; gap: 11px; font-size: 14.5px; }
.topbar-info { color: var(--text-3); }
.topbar-l b { font-weight: 700; }
.topbar-sub { color: var(--text-2); font-style: normal; font-weight: 500; }
.topbar-r { display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--text-2); }

.stage { position: relative; flex: 1; min-height: 0; display: flex; }

.chat { flex: 1; min-width: 0; display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
  padding: 18px 20px; gap: 14px; }

.chat-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.banner { display: flex; align-items: flex-start; gap: 10px; max-width: 420px;
  background: rgba(56,120,200,0.10); border: 1px solid rgba(96,150,230,0.28);
  border-radius: 12px; padding: 11px 12px; }
.banner-ic { color: #6aa3f0; flex-shrink: 0; margin-top: 1px; }
.banner-body { font-size: 13px; line-height: 1.45; color: var(--text-2); }
.banner-body b { color: #9ec3f5; font-weight: 600; }
.banner-x { color: var(--text-3); flex-shrink: 0; margin-top: 1px; transition: color .15s; }
.banner-x:hover { color: var(--text); }

.show-all { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;
  padding: 10px 15px; border-radius: 11px; font-size: 13px; font-weight: 600;
  color: var(--accent); background: rgba(var(--accent-rgb),0.10);
  border: 1px solid rgba(var(--accent-rgb),0.35); transition: background .15s; }
.show-all:hover { background: rgba(var(--accent-rgb),0.18); }

.msgs { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column;
  gap: 22px; padding: 6px 2px; }
.msg { display: flex; gap: 12px; align-items: flex-start; }
.msg-user { justify-content: flex-end; }
.msg-ai { justify-content: flex-start; }
.bubble { border-radius: 16px; padding: 13px 16px; font-size: 14.5px; line-height: 1.55;
  position: relative; }
.bubble p { text-wrap: pretty; }
.bubble .time { display: block; text-align: right; font-size: 11px; color: var(--text-3); margin-top: 7px; }
.bubble-user { background: var(--panel-2); border: 1px solid var(--border);
  border-bottom-right-radius: 6px; max-width: 60%; }
.bubble-ai { background: rgba(var(--accent-rgb),0.09); border: 1px solid rgba(var(--accent-rgb),0.22);
  border-bottom-left-radius: 6px; max-width: 66%; }
.u-av { width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0; display: grid;
  place-items: center; color: var(--text-2); background: rgba(148,163,184,0.10); border: 1px solid var(--border); }
.ai-av { width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0; display: grid;
  place-items: center; color: var(--accent); background: rgba(var(--accent-rgb),0.14);
  border: 1px solid rgba(var(--accent-rgb),0.30); }

.composer { display: flex; gap: 11px; }
.composer-input { flex: 1; background: var(--panel-2); border: 1px solid var(--border);
  border-radius: 13px; padding: 15px 17px; font-size: 14px; color: var(--text); outline: none;
  transition: border-color .15s; }
.composer-input::placeholder { color: var(--text-3); }
.composer-input:focus { border-color: rgba(var(--accent-rgb),0.5); }
.composer-send { width: 54px; flex-shrink: 0; border-radius: 13px; background: var(--accent);
  color: #fff; display: grid; place-items: center;
  box-shadow: 0 8px 20px -8px rgba(var(--accent-rgb),0.7); transition: filter .15s; }
.composer-send:hover { filter: brightness(1.1); }

/* ============ MODAL ============ */
.modal-wrap { position: absolute; inset: 0; z-index: 30; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(5,6,10,0.55);
  backdrop-filter: blur(3px); animation: fade .2s ease; }
.modal { position: absolute; inset: 0; background: var(--panel);
  border: 1px solid var(--border-strong); border-radius: 14px; overflow-y: auto;
  display: flex; flex-direction: column; padding: 20px 22px; gap: 18px;
  box-shadow: 0 30px 80px -20px rgba(0,0,0,0.7); animation: pop .22s cubic-bezier(.2,.8,.2,1); }
@keyframes fade { from { opacity: 0; } }
@keyframes pop { from { opacity: 0; transform: scale(.985); } }
.modal-head { display: flex; align-items: center; justify-content: space-between; }
.modal-title { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; }
.modal-title svg { color: var(--accent); }
.modal-x { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center;
  color: var(--text-2); transition: background .15s, color .15s; }
.modal-x:hover { background: rgba(148,163,184,0.12); color: var(--text); }

.modal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: stretch; }

.rcard { position: relative; display: flex; flex-direction: column; gap: 14px;
  background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
.rcard-win { border-color: rgba(var(--accent-rgb),0.45);
  box-shadow: 0 0 0 1px rgba(var(--accent-rgb),0.25), 0 16px 40px -20px rgba(var(--accent-rgb),0.5); }
.rcard-flag { position: absolute; top: -9px; left: 16px; font-size: 10px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; color: #fff; background: var(--accent);
  padding: 3px 9px; border-radius: 6px; }
.rcard-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.rcard-name { font-size: 16px; font-weight: 700; letter-spacing: 0.02em; }
.rcard-model { font-size: 11.5px; color: var(--text-3); margin-top: 3px; }
.stats { background: rgba(148,163,184,0.06); border: 1px solid var(--border); border-radius: 10px;
  padding: 8px 11px; display: flex; flex-direction: column; gap: 3px; min-width: 116px; }
.stats-row { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: var(--text-2); }
.stats-row b { color: var(--text); font-weight: 600; }
.stats-row i { color: var(--text-3); font-style: normal; }

.score-bar { height: 5px; border-radius: 99px; background: rgba(148,163,184,0.12); overflow: hidden; }
.score-bar span { display: block; height: 100%; border-radius: 99px;
  background: linear-gradient(90deg, rgba(var(--accent-rgb),0.6), var(--accent)); }

.rcard-text { font-size: 13.5px; line-height: 1.6; color: var(--text-2); flex: 1; text-wrap: pretty; }

.cta { display: flex; align-items: center; justify-content: center; gap: 9px;
  width: 100%; padding: 12px; border-radius: 11px; font-size: 13.5px; font-weight: 600;
  transition: filter .15s, background .15s; }
.cta-win { background: rgba(var(--accent-rgb),0.16); color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb),0.45); }
.cta-confirm { background: rgba(47,210,122,0.10); color: #46d98c;
  border: 1px solid rgba(47,210,122,0.35); }
.cta-confirm:hover { background: rgba(47,210,122,0.18); }
.cta-change { background: rgba(148,163,184,0.06); color: var(--text);
  border: 1px solid var(--border-strong); }
.cta-change:hover { background: rgba(148,163,184,0.13); }

@media (max-width: 1180px) {
  .modal-grid { grid-template-columns: 1fr; overflow-y: auto; }
}
`;
