// icons.jsx — line icons matching the dark UI
const Ico = ({ d, size = 18, sw = 1.7, fill = "none", ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>{d}</svg>
);

const IconUser = (p) => <Ico {...p} d={<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />;
const IconChevron = (p) => <Ico {...p} d={<path d="M6 9l6 6 6-6"/>} />;
const IconChat = (p) => <Ico {...p} d={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>} />;
const IconPlus = (p) => <Ico {...p} d={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />;
const IconGrid = (p) => <Ico {...p} d={<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>} />;
const IconClose = (p) => <Ico {...p} d={<><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>} />;
const IconClock = (p) => <Ico {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
const IconInfo = (p) => <Ico {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></>} />;
const IconSend = (p) => <Ico {...p} d={<><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>} />;
const IconStar = (p) => <Ico {...p} fill="currentColor" sw={0} d={<path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.07 1.1-6.47L2.6 9.95l6.5-.95L12 2.5z"/>} />;
const IconCheck = (p) => <Ico {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></>} />;
const IconSwap = (p) => <Ico {...p} d={<><path d="M7 4L3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 4 4"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8a4 4 0 0 1-4-4"/></>} />;
const IconSparkle = (p) => <Ico {...p} fill="currentColor" sw={0} d={<path d="M12 2.6c.62 4.6 2.18 6.18 6.8 6.8-4.62.62-6.18 2.18-6.8 6.8-.62-4.62-2.18-6.18-6.8-6.8 4.62-.62 6.18-2.2 6.8-6.8z"/>} />;

Object.assign(window, { IconUser, IconChevron, IconChat, IconPlus, IconGrid, IconClose, IconClock, IconInfo, IconSend, IconStar, IconCheck, IconSwap, IconSparkle });
