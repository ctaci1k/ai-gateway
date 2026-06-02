// cc-styles.jsx — Classic Console layout + dark/light theming. window.CC_CSS
window.CC_CSS = `
/* theme tokens live on .cc-root so both themes work in one page */
.cc-root{
  --e-ac:#8b5cf6; --e-ac-rgb:139,92,246; --e-ok:#2fd27a;
  height:100vh; width:100vw; overflow:hidden;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
  color:var(--e-tx); background-color:var(--e-bg);
}
.cc-root[data-theme="dark"]{
  --e-bg:#0a0c12; --e-panel:#0f111a; --e-panel2:#13151f; --e-rail:#0b0d14;
  --e-card:#11131d; --e-border:rgba(148,163,184,0.12); --e-border2:rgba(148,163,184,0.20);
  --e-tx:#e8eaf2; --e-tx2:#9298ac; --e-tx3:#686e83; --e-soft:rgba(148,163,184,0.06);
  --e-softer:rgba(148,163,184,0.10);
}
.cc-root[data-theme="light"]{
  --e-bg:#eef0f5; --e-panel:#ffffff; --e-panel2:#f4f5f9; --e-rail:#f8f9fc;
  --e-card:#ffffff; --e-border:rgba(20,28,46,0.10); --e-border2:rgba(20,28,46,0.16);
  --e-tx:#1a1d2b; --e-tx2:#586079; --e-tx3:#9aa2b6; --e-soft:rgba(20,28,46,0.04);
  --e-softer:rgba(20,28,46,0.07);
}
.cc-root *{box-sizing:border-box;}
.cc-root .mono{font-family:'JetBrains Mono',monospace;}
.cc-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit;}

/* ---- top bar ---- */
.cc-top{display:flex;align-items:center;gap:14px;height:64px;padding:0 22px;flex-shrink:0;
  background-color:var(--e-panel);border-bottom:1px solid var(--e-border);position:relative;z-index:30;}
.cc-top-title{display:flex;flex-direction:column;line-height:1.15;margin-left:4px;}
.cc-top-title b{font-size:14.5px;font-weight:700;}
.cc-top-title span{font-size:11.5px;color:var(--e-tx3);}
.cc-spacer{flex:1;}

.cc-iconbtn{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;color:var(--e-tx2);
  background:var(--e-soft);border:1px solid var(--e-border);transition:.15s;}
.cc-iconbtn:hover{color:var(--e-tx);background:var(--e-softer);}
.cc-iconbtn.is-active{color:var(--e-ac);background:rgba(var(--e-ac-rgb),0.12);border-color:rgba(var(--e-ac-rgb),0.4);}

/* theme toggle */
.cc-theme{position:relative;width:64px;height:40px;border-radius:99px;background:var(--e-soft);
  border:1px solid var(--e-border);display:flex;align-items:center;padding:0 6px;transition:.2s;}
.cc-theme:hover{background:var(--e-softer);}
.cc-theme-knob{position:absolute;top:3px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;
  background:var(--e-ac);color:#fff;box-shadow:0 4px 12px -3px rgba(var(--e-ac-rgb),0.7);
  transition:left .28s cubic-bezier(.4,1.3,.5,1);}
.cc-root[data-theme="dark"] .cc-theme-knob{left:3px;}
.cc-root[data-theme="light"] .cc-theme-knob{left:29px;}
.cc-theme-ic{flex:1;display:grid;place-items:center;color:var(--e-tx3);}

.cc-divider{width:1px;height:26px;background:var(--e-border);}

.cc-langpill{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 12px;border-radius:11px;
  background:var(--e-soft);border:1px solid var(--e-border);color:var(--e-tx2);font-size:13px;font-weight:600;transition:.15s;}
.cc-langpill:hover{color:var(--e-tx);background:var(--e-softer);}
.cc-langpill .cc-flag{font-size:15px;} .cc-langpill b{color:var(--e-tx);font-weight:700;}
.cc-langpill.is-open{border-color:rgba(var(--e-ac-rgb),0.5);background:rgba(var(--e-ac-rgb),0.10);color:var(--e-tx);}

.cc-userbtn{display:flex;align-items:center;gap:10px;height:44px;padding:0 9px 0 6px;border-radius:12px;
  background:var(--e-soft);border:1px solid var(--e-border);transition:.15s;}
.cc-userbtn:hover{background:var(--e-softer);border-color:var(--e-border2);}
.cc-userbtn.is-open{border-color:rgba(var(--e-ac-rgb),0.5);background:rgba(var(--e-ac-rgb),0.10);}
.cc-userbtn-tx{display:flex;flex-direction:column;line-height:1.2;text-align:left;}
.cc-userbtn-tx b{font-size:13px;font-weight:700;} .cc-userbtn-tx span{font-size:11px;color:var(--e-tx3);}

/* avatar */
.cc-av{border-radius:50%;display:grid;place-items:center;flex-shrink:0;font-weight:700;color:#fff;
  background:linear-gradient(135deg,#7c5cf0,#9d7bf5);letter-spacing:.02em;}
.cc-av[data-ring="1"]{box-shadow:0 0 0 2px var(--e-panel),0 0 0 4px rgba(var(--e-ac-rgb),0.45);}

/* ---- dropdown menus ---- */
.cc-menu{position:absolute;top:calc(100% + 10px);right:0;z-index:50;background:var(--e-panel);
  border:1px solid var(--e-border2);border-radius:14px;padding:7px;
  box-shadow:0 24px 60px -18px rgba(0,0,0,0.45);display:flex;flex-direction:column;gap:2px;
  animation:cc-pop .16s ease;}
@keyframes cc-pop{from{opacity:0;transform:translateY(-6px);}}
.cc-menu-cap{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--e-tx3);font-weight:700;padding:7px 10px 4px;}
.cc-menu-item{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;font-size:13.5px;
  font-weight:600;color:var(--e-tx2);text-align:left;width:100%;transition:.12s;}
.cc-menu-item:hover{background:var(--e-softer);color:var(--e-tx);}
.cc-menu-item.is-sel{background:rgba(var(--e-ac-rgb),0.12);color:var(--e-tx);}
.cc-menu-item .lab{flex:1;}
.cc-menu-item .val{font-size:12px;color:var(--e-tx3);display:inline-flex;align-items:center;gap:4px;font-weight:600;}
.cc-menu-item .chk{color:var(--e-ac);}
.cc-menu-flag{font-size:16px;}
.cc-menu-danger{color:#f0738a;} .cc-menu-danger:hover{background:rgba(240,115,138,.10);color:#f0738a;}
.cc-menu-sep{height:1px;background:var(--e-border);margin:5px 2px;}
.cc-menu-lang{width:228px;}
.cc-menu-acct{width:266px;}
.cc-acct-head{display:flex;align-items:center;gap:12px;padding:10px;}
.cc-acct-id{display:flex;flex-direction:column;line-height:1.3;min-width:0;}
.cc-acct-id b{font-size:14px;font-weight:700;} .cc-acct-id span{font-size:12px;color:var(--e-tx3);overflow:hidden;text-overflow:ellipsis;}

/* ---- body ---- */
.cc-body{display:flex;height:calc(100vh - 64px);}

/* ---- sidebar ---- */
.cc-side{width:264px;flex-shrink:0;background-color:var(--e-rail);border-right:1px solid var(--e-border);
  display:flex;flex-direction:column;padding:14px 12px;}
.cc-side-scroll{flex:1;display:flex;flex-direction:column;gap:8px;overflow-y:auto;min-height:0;padding-right:2px;}

/* accordion */
.cc-acc{border:1px solid var(--e-border);border-radius:13px;background:var(--e-soft);overflow:hidden;transition:.2s;}
.cc-acc.is-open{background:var(--e-card);border-color:var(--e-border2);}
.cc-acc-head{display:flex;align-items:center;gap:11px;width:100%;padding:13px 13px;font-size:13.5px;font-weight:700;color:var(--e-tx);}
.cc-acc-head .ic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;
  background:var(--e-softer);color:var(--e-tx2);transition:.2s;}
.cc-acc.is-open .cc-acc-head .ic{background:rgba(var(--e-ac-rgb),0.16);color:var(--e-ac);}
.cc-acc-head .lab{flex:1;text-align:left;display:flex;flex-direction:column;line-height:1.2;}
.cc-acc-head .lab small{font-size:10.5px;font-weight:600;color:var(--e-tx3);}
.cc-acc-head .chev{color:var(--e-tx3);transition:transform .25s;}
.cc-acc.is-open .cc-acc-head .chev{transform:rotate(180deg);}
.cc-acc-body{padding:0 10px 11px;display:flex;flex-direction:column;gap:4px;}

.cc-newchat{display:flex;align-items:center;gap:9px;width:100%;padding:11px 12px;border-radius:10px;
  font-size:13px;font-weight:700;color:#fff;background:var(--e-ac);
  box-shadow:0 8px 18px -8px rgba(var(--e-ac-rgb),0.7);transition:.15s;}
.cc-newchat:hover{filter:brightness(1.08);}
.cc-newchat.ghost{color:var(--e-ac);background:rgba(var(--e-ac-rgb),0.12);box-shadow:none;border:1px solid rgba(var(--e-ac-rgb),0.3);}
.cc-newchat.ghost:hover{background:rgba(var(--e-ac-rgb),0.2);filter:none;}

/* nested history */
.cc-sub{margin-top:2px;}
.cc-sub-head{display:flex;align-items:center;gap:8px;width:100%;padding:9px 11px;border-radius:9px;
  font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--e-tx3);transition:.12s;}
.cc-sub-head:hover{color:var(--e-tx2);background:var(--e-soft);}
.cc-sub-head .chev{margin-left:auto;transition:transform .25s;}
.cc-sub.is-open .cc-sub-head .chev{transform:rotate(90deg);}
.cc-sub-body{display:flex;flex-direction:column;gap:1px;padding:2px 0 2px 6px;}
.cc-hrow{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;text-align:left;width:100%;
  color:var(--e-tx2);font-size:12.5px;font-weight:500;transition:.12s;}
.cc-hrow:hover{background:var(--e-soft);color:var(--e-tx);}
.cc-hrow.is-active{background:rgba(var(--e-ac-rgb),0.10);color:var(--e-tx);}
.cc-hrow .dotm{width:6px;height:6px;border-radius:50%;background:var(--e-tx3);flex-shrink:0;}
.cc-hrow.is-active .dotm{background:var(--e-ac);}
.cc-hrow .htx{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cc-hrow .htime{font-size:10.5px;color:var(--e-tx3);}

/* ---- creator card (bottom-left) ---- */
.cc-creator{margin-top:10px;flex-shrink:0;background:var(--e-card);border:1px solid var(--e-border);
  border-radius:13px;padding:12px 13px;display:flex;align-items:center;gap:11px;}
.cc-creator-badge{width:36px;height:36px;border-radius:10px;flex-shrink:0;display:grid;place-items:center;
  color:var(--e-ac);background:rgba(var(--e-ac-rgb),0.14);border:1px solid rgba(var(--e-ac-rgb),0.28);}
.cc-creator-tx{display:flex;flex-direction:column;line-height:1.3;min-width:0;}
.cc-creator-tx small{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--e-tx3);}
.cc-creator-tx b{font-size:13px;font-weight:700;color:var(--e-tx);}
.cc-creator-tx span{font-size:11px;color:var(--e-tx3);}

/* ---- main ---- */
.cc-main{flex:1;min-width:0;display:flex;flex-direction:column;background-color:var(--e-bg);}
.cc-main-head{display:flex;align-items:center;gap:13px;height:60px;padding:0 24px;flex-shrink:0;border-bottom:1px solid var(--e-border);}
.cc-modelchip{display:inline-flex;align-items:center;gap:9px;height:38px;padding:0 6px 0 12px;border-radius:11px;
  background:var(--e-soft);border:1px solid var(--e-border);font-size:13.5px;font-weight:700;}
.cc-modelchip .mdot{width:8px;height:8px;border-radius:50%;background:var(--e-ac);box-shadow:0 0 8px rgba(var(--e-ac-rgb),0.7);}
.cc-modelchip .sw{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;color:var(--e-tx3);background:var(--e-softer);}
.cc-modelchip small{font-size:11px;font-weight:500;color:var(--e-tx3);}
.cc-mode-tag{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;border-radius:7px;
  color:var(--e-ac);background:rgba(var(--e-ac-rgb),0.12);border:1px solid rgba(var(--e-ac-rgb),0.3);}
.cc-main-status{margin-left:auto;display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--e-tx2);}
.cc-dot{width:7px;height:7px;border-radius:50%;background:var(--e-ok);box-shadow:0 0 8px rgba(47,210,122,.7);}

.cc-stage{flex:1;min-height:0;display:flex;flex-direction:column;}

/* conversation */
.cc-convo{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:18px;padding:26px 26px 8px;justify-content:flex-end;}
.cc-msg{display:flex;gap:11px;align-items:flex-end;}
.cc-msg-u{justify-content:flex-end;}
.cc-bub{border-radius:15px;padding:12px 15px;font-size:14px;line-height:1.55;max-width:60%;}
.cc-bub-u{background:var(--e-panel2);border:1px solid var(--e-border);border-bottom-right-radius:5px;}
.cc-bub-a{background:rgba(var(--e-ac-rgb),0.09);border:1px solid rgba(var(--e-ac-rgb),0.22);border-bottom-left-radius:5px;}
.cc-root[data-theme="light"] .cc-bub-a{background:rgba(var(--e-ac-rgb),0.07);}
.cc-aiav{width:32px;height:32px;border-radius:9px;flex-shrink:0;display:grid;place-items:center;color:var(--e-ac);
  background:rgba(var(--e-ac-rgb),0.14);border:1px solid rgba(var(--e-ac-rgb),0.3);}
.cc-composer{margin:8px 22px 22px;display:flex;align-items:center;gap:11px;background:var(--e-panel2);
  border:1px solid var(--e-border);border-radius:14px;padding:6px 6px 6px 17px;}
.cc-composer input{flex:1;background:none;border:none;outline:none;color:var(--e-tx);font-size:14px;padding:11px 0;}
.cc-composer input::placeholder{color:var(--e-tx3);}
.cc-send{width:44px;height:44px;border-radius:11px;background:var(--e-ac);color:#fff;display:grid;place-items:center;flex-shrink:0;
  box-shadow:0 8px 18px -8px rgba(var(--e-ac-rgb),0.7);transition:.15s;}
.cc-send:hover{filter:brightness(1.08);}

/* model picker (new single chat) */
.cc-pick{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;}
.cc-pick-inner{width:100%;max-width:760px;}
.cc-pick h2{font-size:24px;font-weight:800;text-align:center;letter-spacing:-.01em;}
.cc-pick p{font-size:14.5px;color:var(--e-tx2);text-align:center;margin-top:8px;margin-bottom:28px;}
.cc-pick-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
.cc-mcard{text-align:left;background:var(--e-card);border:1px solid var(--e-border);border-radius:14px;padding:18px;
  display:flex;flex-direction:column;gap:7px;transition:.15s;position:relative;}
.cc-mcard:hover{border-color:rgba(var(--e-ac-rgb),0.5);background:var(--e-panel);transform:translateY(-2px);
  box-shadow:0 16px 36px -22px rgba(var(--e-ac-rgb),0.7);}
.cc-mcard.is-sel{border-color:rgba(var(--e-ac-rgb),0.6);box-shadow:0 0 0 1px rgba(var(--e-ac-rgb),0.4);}
.cc-mcard-top{display:flex;align-items:center;gap:11px;}
.cc-mcard-ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;color:#fff;flex-shrink:0;}
.cc-mcard b{font-size:15.5px;font-weight:700;}
.cc-mcard .mdl{font-size:11.5px;color:var(--e-tx3);}
.cc-mcard .desc{font-size:12.5px;color:var(--e-tx2);line-height:1.5;}
.cc-mcard .pickbtn{margin-top:4px;align-self:flex-start;font-size:12px;font-weight:700;color:var(--e-ac);
  display:inline-flex;align-items:center;gap:5px;}

/* compare view */
.cc-cmp{flex:1;min-height:0;overflow-y:auto;padding:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-content:start;}
.cc-cmp-card{background:var(--e-card);border:1px solid var(--e-border);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;position:relative;}
.cc-cmp-card.win{border-color:rgba(var(--e-ac-rgb),0.45);box-shadow:0 0 0 1px rgba(var(--e-ac-rgb),0.25);}
.cc-cmp-flag{position:absolute;top:-9px;left:14px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:#fff;background:var(--e-ac);padding:3px 9px;border-radius:6px;}
.cc-cmp-head{display:flex;align-items:center;justify-content:space-between;}
.cc-cmp-head b{font-size:14.5px;font-weight:700;}
.cc-cmp-head .sc{font-size:12px;font-weight:700;color:var(--e-ac);font-family:'JetBrains Mono',monospace;}
.cc-cmp-bar{height:5px;border-radius:99px;background:var(--e-softer);overflow:hidden;}
.cc-cmp-bar span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,rgba(var(--e-ac-rgb),0.6),var(--e-ac));}
.cc-cmp-tx{font-size:12.5px;line-height:1.55;color:var(--e-tx2);flex:1;}

/* scrollbars */
.cc-root ::-webkit-scrollbar{width:9px;height:9px;}
.cc-root ::-webkit-scrollbar-thumb{background:var(--e-softer);border-radius:99px;border:2px solid transparent;background-clip:padding-box;}
`;
