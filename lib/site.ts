export type NavigationItem = {
  readonly label: string;
  readonly href: string;
};

export type SocialLink = {
  readonly label: string;
  readonly href: string;
};

export type SiteConfig = {
  readonly name: string;
  readonly shortName: string;
  readonly callSign: string;
  readonly frequency: string;
  readonly tagline: string;
  readonly description: string;
  readonly location: string;
  readonly timeZone: string;
  readonly url: string;
  /** Convenience alias used by Next.js metadata. */
  readonly siteUrl: string;
  readonly phone: {
    readonly display: string;
    readonly href: string;
  };
  readonly address: {
    readonly street: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
    readonly lines: readonly string[];
    readonly mapUrl: string;
  };
  readonly email?: {
    readonly display: string;
    readonly href: string;
  };
  readonly live365: {
    readonly stationId: string;
    readonly streamUrl: string;
    readonly stationUrl: string;
  };
  /** Convenience aliases for calls-to-action and the audio element. */
  readonly live365Url: string;
  readonly streamUrl: string;
  readonly socials: readonly SocialLink[];
};

export const navigation = [
  { label: 'On Air', href: '/on-air' },
  { label: "Captain's Calendar", href: '/captains-calendar' },
  { label: 'Underwriting', href: '/underwriting' },
  { label: 'Donate', href: '/donate' },
  { label: 'Contact', href: '/contact' },
] as const satisfies readonly NavigationItem[];

export const siteConfig: SiteConfig = {
  name: 'Captain 97.1',
  shortName: 'Captain 97',
  callSign: 'WXNR-LP',
  frequency: '97.1 FM',
  tagline: "Carolina's Dock Rock",
  description:
    "Smooth classics, coastal favorites, and Carolina's Dock Rock—broadcast locally from New Bern, North Carolina.",
  location: 'New Bern, North Carolina',
  timeZone: 'America/New_York',
  url: 'https://captain97.com',
  siteUrl: 'https://captain97.com',
  phone: {
    display: '252-675-6100',
    href: 'tel:+12526756100',
  },
  address: {
    street: '1423 South Glenburnie Road, Suite C',
    city: 'New Bern',
    region: 'NC',
    postalCode: '28562',
    lines: ['1423 South Glenburnie Road, Suite C', 'New Bern, NC 28562'],
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=1423+South+Glenburnie+Road+Suite+C+New+Bern+NC+28562',
  },
  live365: {
    stationId: 'a57695',
    streamUrl: 'https://streaming.live365.com/a57695',
    stationUrl: 'https://live365.com/station/Captain-97-a57695',
  },
  live365Url: 'https://live365.com/station/Captain-97-a57695',
  streamUrl: 'https://streaming.live365.com/a57695',
  socials: [
    {
      label: 'Facebook',
      href: 'https://www.facebook.com/p/Captain-97-61566324394330/',
    },
    {
      label: 'Instagram',
      href: 'https://www.instagram.com/captain97radio/',
    },
    {
      label: 'Live365',
      href: 'https://live365.com/station/Captain-97-a57695',
    },
  ],
};

export const stationConfig = siteConfig;
