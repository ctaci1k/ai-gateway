// ent-icons.jsx — icon set for enterprise concepts
const EIco = ({ d, size = 18, sw = 1.7, fill = "none", ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>{d}</svg>
);

const EI = {
  user:    (p) => <EIco {...p} d={<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />,
  chevD:   (p) => <EIco {...p} d={<path d="M6 9l6 6 6-6"/>} />,
  chevR:   (p) => <EIco {...p} d={<path d="M9 6l6 6-6 6"/>} />,
  chat:    (p) => <EIco {...p} d={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>} />,
  plus:    (p) => <EIco {...p} d={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />,
  grid:    (p) => <EIco {...p} d={<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>} />,
  close:   (p) => <EIco {...p} d={<><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>} />,
  search:  (p) => <EIco {...p} d={<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></>} />,
  bell:    (p) => <EIco {...p} d={<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>} />,
  globe:   (p) => <EIco {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></>} />,
  gear:    (p) => <EIco {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></>} />,
  logout:  (p) => <EIco {...p} d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>} />,
  history: (p) => <EIco {...p} d={<><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 2"/></>} />,
  models:  (p) => <EIco {...p} d={<><path d="M12 2l3 3-3 3-3-3 3-3z"/><path d="M5 9l3 3-3 3-3-3 3-3z"/><path d="M19 9l3 3-3 3-3-3 3-3z"/><path d="M12 16l3 3-3 3-3-3 3-3z"/></>} />,
  palette: (p) => <EIco {...p} d={<><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none"/></>} />,
  shield:  (p) => <EIco {...p} d={<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>} />,
  sparkle: (p) => <EIco {...p} fill="currentColor" sw={0} d={<path d="M12 2.6c.62 4.6 2.18 6.18 6.8 6.8-4.62.62-6.18 2.18-6.8 6.8-.62-4.62-2.18-6.18-6.8-6.8 4.62-.62 6.18-2.2 6.8-6.8z"/>} />,
  send:    (p) => <EIco {...p} d={<><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>} />,
  check:   (p) => <EIco {...p} d={<path d="M20 6L9 17l-5-5"/>} />,
  menu:    (p) => <EIco {...p} d={<><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></>} />,
  panel:   (p) => <EIco {...p} d={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></>} />,
  dots:    (p) => <EIco {...p} d={<><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></>} />,
  star:    (p) => <EIco {...p} fill="currentColor" sw={0} d={<path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.07 1.1-6.47L2.6 9.95l6.5-.95L12 2.5z"/>} />,
  clock:   (p) => <EIco {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />,
  moon:    (p) => <EIco {...p} d={<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>} />,
  sun:     (p) => <EIco {...p} d={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>} />,
  code:    (p) => <EIco {...p} d={<><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></>} />,
};

window.EI = EI;
