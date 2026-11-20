import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export const IconGlobe = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
  </svg>
);
export const IconChat = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);
export const IconBell = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />
  </svg>
);
export const IconUsers = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.6 3 5.2" />
  </svg>
);
export const IconMic = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
export const IconArrowUp = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
export const IconBars = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 18V9M10 18V6M15 18v-8M20 18V4" />
  </svg>
);
export const IconTelegram = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M21 4 3 11l6 2 2 6 3-4 5 4z" />
  </svg>
);
export const IconNote = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" />
  </svg>
);
export const IconCalendar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </svg>
);
export const IconSearch = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4-4" />
  </svg>
);
export const IconChevron = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconBack = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const IconEdit = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
  </svg>
);
export const IconX = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconSync = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M20 11a8 8 0 0 0-14.5-4.5M4 4v3h3M4 13a8 8 0 0 0 14.5 4.5M20 20v-3h-3" />
  </svg>
);
export const IconSpark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
);
export const IconBrain = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="6" cy="7" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <circle cx="12" cy="13" r="2.4" />
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="18" r="2.2" />
    <path d="M7.8 8.3 10.3 11.5M16.3 7.4l-2.6 4M10.2 14.4l-2.6 2.4M13.8 14.4l2.6 2.4M8 7h7.8" />
  </svg>
);
export const IconPlug = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />
  </svg>
);
export const IconRoute = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="6" r="2" />
    <path d="M7 18h7a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h7" />
  </svg>
);
export const IconWave = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 14c2-4 4-4 6 0s4 4 6 0 3-3 4-2" />
  </svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);
