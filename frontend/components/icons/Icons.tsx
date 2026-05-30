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
