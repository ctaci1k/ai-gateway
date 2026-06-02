// frontend/components/icons/Icons.tsx
//
// Line-icon set ported from design-reference/ai-gateway/icons.jsx.

import type { ReactNode, SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  sw?: number;
}

function Ico({
  children,
  size = 18,
  sw = 1.7,
  fill = "none",
  ...rest
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconUser = (p: IconProps) => (
  <Ico {...p}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Ico>
);

export const IconChevron = (p: IconProps) => (
  <Ico {...p}>
    <path d="M6 9l6 6 6-6" />
  </Ico>
);

export const IconMenu = (p: IconProps) => (
  <Ico {...p}>
    <path d="M3 6h18" />
    <path d="M3 12h18" />
    <path d="M3 18h18" />
  </Ico>
);

export const IconChat = (p: IconProps) => (
  <Ico {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Ico>
);

export const IconPlus = (p: IconProps) => (
  <Ico {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Ico>
);

export const IconGrid = (p: IconProps) => (
  <Ico {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Ico>
);

export const IconClose = (p: IconProps) => (
  <Ico {...p}>
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </Ico>
);

export const IconDoc = (p: IconProps) => (
  <Ico {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h8" />
  </Ico>
);

export const IconUpload = (p: IconProps) => (
  <Ico {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M12 4v12" />
  </Ico>
);

export const IconEdit = (p: IconProps) => (
  <Ico {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Ico>
);

export const IconInfo = (p: IconProps) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </Ico>
);

export const IconSend = (p: IconProps) => (
  <Ico {...p}>
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </Ico>
);

export const IconStar = (p: IconProps) => (
  <Ico {...p} fill="currentColor" sw={0}>
    <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.07 1.1-6.47L2.6 9.95l6.5-.95L12 2.5z" />
  </Ico>
);

export const IconCheck = (p: IconProps) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </Ico>
);

export const IconSwap = (p: IconProps) => (
  <Ico {...p}>
    <path d="M7 4L3 8l4 4" />
    <path d="M3 8h13a4 4 0 0 1 4 4" />
    <path d="M17 20l4-4-4-4" />
    <path d="M21 16H8a4 4 0 0 1-4-4" />
  </Ico>
);

export const IconSparkle = (p: IconProps) => (
  <Ico {...p} fill="currentColor" sw={0}>
    <path d="M12 2.6c.62 4.6 2.18 6.18 6.8 6.8-4.62.62-6.18 2.18-6.8 6.8-.62-4.62-2.18-6.18-6.8-6.8 4.62-.62 6.18-2.2 6.8-6.8z" />
  </Ico>
);

// --- Classic Console chrome icons (PH24, ported from ent-icons.jsx) ---

export const IconChevronRight = (p: IconProps) => (
  <Ico {...p}>
    <path d="M9 6l6 6-6 6" />
  </Ico>
);

export const IconGear = (p: IconProps) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </Ico>
);

export const IconShield = (p: IconProps) => (
  <Ico {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
  </Ico>
);

export const IconHistory = (p: IconProps) => (
  <Ico {...p}>
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l3 2" />
  </Ico>
);

export const IconModels = (p: IconProps) => (
  <Ico {...p}>
    <path d="M12 2l3 3-3 3-3-3 3-3z" />
    <path d="M5 9l3 3-3 3-3-3 3-3z" />
    <path d="M19 9l3 3-3 3-3-3 3-3z" />
    <path d="M12 16l3 3-3 3-3-3 3-3z" />
  </Ico>
);

export const IconLogout = (p: IconProps) => (
  <Ico {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Ico>
);

export const IconCode = (p: IconProps) => (
  <Ico {...p}>
    <path d="M16 18l6-6-6-6" />
    <path d="M8 6l-6 6 6 6" />
  </Ico>
);

export const IconUsers = (p: IconProps) => (
  <Ico {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Ico>
);

export const IconReport = (p: IconProps) => (
  <Ico {...p}>
    <path d="M3 3v18h18" />
    <rect x="7" y="11" width="3" height="6" rx="0.5" />
    <rect x="12" y="7" width="3" height="10" rx="0.5" />
    <rect x="17" y="13" width="3" height="4" rx="0.5" />
  </Ico>
);

export const IconDownload = (p: IconProps) => (
  <Ico {...p}>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </Ico>
);

export const IconMoon = (p: IconProps) => (
  <Ico {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Ico>
);

export const IconSun = (p: IconProps) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Ico>
);
