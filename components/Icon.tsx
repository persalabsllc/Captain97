import type { SVGProps } from 'react';

export type IconName =
  | 'anchor'
  | 'arrow-right'
  | 'briefcase'
  | 'calendar'
  | 'check'
  | 'close'
  | 'external-link'
  | 'facebook'
  | 'heart'
  | 'inbox'
  | 'instagram'
  | 'map-pin'
  | 'mail'
  | 'menu'
  | 'message'
  | 'microphone'
  | 'pause'
  | 'phone'
  | 'play'
  | 'radio'
  | 'search'
  | 'send'
  | 'sun'
  | 'lock'
  | 'logout'
  | 'volume'
  | 'volume-x';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName;
  size?: number;
  label?: string;
};

function IconPaths({ name }: { name: IconName }) {
  switch (name) {
    case 'anchor':
      return <><circle cx="12" cy="5" r="2.25" /><path d="M12 7.25V21M5 11H2.75A9.25 9.25 0 0 0 12 20.25 9.25 9.25 0 0 0 21.25 11H19M8.5 11h7" /><path d="m8 17-4 2m12-2 4 2" /></>;
    case 'arrow-right':
      return <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>;
    case 'briefcase':
      return <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>;
    case 'calendar':
      return <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>;
    case 'check':
      return <path d="m5 12 4 4L19 6" />;
    case 'close':
      return <><path d="m6 6 12 12M18 6 6 18" /></>;
    case 'external-link':
      return <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>;
    case 'facebook':
      return <path d="M14 8h3V4.5c-.7-.1-1.8-.25-3.1-.25-3.05 0-5.15 1.85-5.15 5.3V12H5.5v4h3.25v7H13v-7h3.35l.55-4H13V9.9C13 8.75 13.3 8 14 8Z" fill="currentColor" stroke="none" />;
    case 'heart':
      return <path d="M20.8 4.6a5.4 5.4 0 0 0-7.65 0L12 5.75 10.85 4.6a5.41 5.41 0 0 0-7.65 7.65L12 21l8.8-8.75a5.4 5.4 0 0 0 0-7.65Z" />;
    case 'inbox':
      return <><path d="M4 4h16l2 9v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z" /><path d="M2 13h5l2 3h6l2-3h5" /></>;
    case 'instagram':
      return <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none" /></>;
    case 'map-pin':
      return <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>;
    case 'mail':
      return <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>;
    case 'menu':
      return <><path d="M4 7h16M4 12h16M4 17h16" /></>;
    case 'message':
      return <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />;
    case 'microphone':
      return <><rect x="8" y="3" width="8" height="13" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></>;
    case 'pause':
      return <><path d="M8 5v14M16 5v14" /></>;
    case 'phone':
      return <path d="M21 16.5v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.05 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.15 3.8 2 2 0 0 1 3.15 1.6h3a2 2 0 0 1 2 1.7c.13 1 .37 2 .7 2.95a2 2 0 0 1-.45 2.1L7.15 9.6a16 16 0 0 0 6 6l1.25-1.25a2 2 0 0 1 2.1-.45c.95.33 1.95.57 2.95.7A2 2 0 0 1 21 16.5Z" />;
    case 'play':
      return <path d="m8 5 11 7-11 7Z" />;
    case 'radio':
      return <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="m7 7 10-4M7 11h6M7 15h4" /><circle cx="17" cy="14" r="2.5" /></>;
    case 'search':
      return <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>;
    case 'send':
      return <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>;
    case 'sun':
      return <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>;
    case 'lock':
      return <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>;
    case 'logout':
      return <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></>;
    case 'volume':
      return <><path d="M11 5 6 9H3v6h3l5 4Z" /><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></>;
    case 'volume-x':
      return <><path d="M11 5 6 9H3v6h3l5 4Z" /><path d="m16 10 5 5M21 10l-5 5" /></>;
  }
}

export default function Icon({ name, size = 20, label, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...props}
    >
      <IconPaths name={name} />
    </svg>
  );
}
