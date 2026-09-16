export const discoverySources = { all: 'All sources', visit: 'Visit New Bern', downtown: 'Downtown New Bern', maps: 'OpenStreetMap', chamber: 'Chamber of Commerce' } as const;
export type DiscoverySource = keyof typeof discoverySources;
export const discoveryCategories = ['restaurants', 'retail', 'home', 'health', 'automotive', 'marina', 'real estate', 'personal services', 'lodging'] as const;
export const offers = { radio: 'Radio campaign', remote: 'Remote broadcast', sponsorship: 'Sponsorship' } as const;
export type Offer = keyof typeof offers;
export const stages = ['new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'closed', 'unsubscribed'] as const;
export type Stage = typeof stages[number];
export type Prospect = {
  discoverySource?: string; discoveryUrl?: string;
  id: string; business: string; contact: string; email: string; phone: string;
  website: string; source: string; category: string; city: string; offer: Offer;
  stage: Stage; notes: string; emailVerified: boolean; createdAt: string; updatedAt: string;
  nextFollowUp: string; value: number; unsubscribeToken: string;
};
export type Email = {
  id: string; prospectId: string; to: string; subject: string; body: string;
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'failed' | 'uncertain' | 'cancelled';
  createdAt: string; scheduledAt: string; attemptedAt?: string; sentAt?: string;
  providerId?: string; error?: string;
};
export type Template = { subject: string; body: string };
export type Settings = {
  enabled: boolean; autoDiscover: boolean; autoQueue: boolean; dailyLimit: number;
  category: string; discoverySource: DiscoverySource; defaultOffer: Offer; from: string; replyTo: string;
  templates: Record<Offer, Template>;
};
export type State = {
  revision: number; prospects: Prospect[]; emails: Email[]; settings: Settings;
  suppressed: string[]; researched: string[];
  lastRun?: string; lastResult?: string; lastDiscovery?: string;
};
export type Dashboard = State & { connections: { email: boolean; scheduler: boolean }; todayCount: number };
export const defaults: Settings = {
  enabled: false, autoDiscover: false, autoQueue: false, dailyLimit: 10,
  category: 'restaurants', discoverySource: 'all', defaultOffer: 'radio',
  from: 'Kyle at Captain 97.1 <kyle@captain97.com>', replyTo: 'kyle@captain97.com',
  templates: {
    radio: {
      subject: 'A local radio campaign for {{business}}',
      body: "Hi {{contact}},\n\nI'm Kyle, owner of Captain 97.1 here in New Bern. We play yacht rock and coastal favorites, with local voices connecting our community.\n\nI'd love to talk about a 90-day messaging campaign for {{business}}. We can help write and produce your message, or welcome you into the studio to record it yourself.\n\nWould you be open to a quick conversation about your goals and an affordable campaign that fits? I'm also happy to stop by.\n\nKyle Kratoville\nOwner / Station Manager\nCaptain 97.1 — Carolina's Dock Rock\ncaptain97.com",
    },
    remote: {
      subject: 'Bring Captain 97.1 to {{business}}',
      body: "Hi {{contact}},\n\nI'm Kyle with Captain 97.1 in New Bern. I wanted to introduce ourselves as a local partner for {{business}}'s next event.\n\nIf you have an opening, anniversary, community event, or special occasion coming up, we can discuss bringing Captain 97.1 out for a remote broadcast and building a campaign around it.\n\nDo you have anything on the calendar we could talk about? I'd be happy to stop by and hear what you're planning.\n\nKyle Kratoville\nOwner / Station Manager\nCaptain 97.1 — Carolina's Dock Rock\ncaptain97.com",
    },
    sponsorship: {
      subject: '{{business}} + Captain 97.1',
      body: "Hi {{contact}},\n\nI'm Kyle, owner of Captain 97.1 here in New Bern. I'm reaching out about a local sponsorship opportunity for {{business}}.\n\nWe can explore a sponsorship around station programming, local updates, or a community event, with a plan tailored to your business and budget. It's a way to support local radio and keep your name connected with our community.\n\nWould you like me to put together a few ideas?\n\nKyle Kratoville\nOwner / Station Manager\nCaptain 97.1 — Carolina's Dock Rock\ncaptain97.com",
    },
  },
};
export function renderTemplate(template: Template, p: Prospect): Template {
  const replace = (s: string) => s.replace(/\{\{business\}\}/g, () => p.business)
    .replace(/\{\{contact\}\}/g, () => p.contact || `${p.business} team`)
    .replace(/\{\{city\}\}/g, () => p.city || 'New Bern');
  return { subject: replace(template.subject), body: replace(template.body) };
}
export function easternDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function sendingWindow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  const day = parts.find(p => p.type === 'weekday')?.value;
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  return day !== 'Sat' && day !== 'Sun' && hour >= 9 && hour < 17;
}
export function emailValid(s: string) { return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(s) && s.length <= 254; }
export function countedToday(state: State) {
  const day = easternDay();
  return state.emails.filter(e => e.attemptedAt && easternDay(new Date(e.attemptedAt)) === day).length;
}
export function eligible(p: Prospect, state: State) {
  return emailValid(p.email) && p.emailVerified && Boolean(p.source) && !state.suppressed.includes(p.email) && !['unsubscribed', 'closed', 'won'].includes(p.stage);
}
