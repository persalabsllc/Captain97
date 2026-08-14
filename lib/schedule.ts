import { siteConfig } from './site';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Program = {
  readonly id: string;
  readonly name: string;
  readonly host?: string;
  readonly time: string;
  readonly description?: string;
  readonly start: number;
  readonly end: number;
};

export type ScheduleGroup = {
  readonly dayLabel: string;
  readonly days: readonly DayOfWeek[];
  readonly shows: readonly Program[];
};

export type ScheduledOccurrence = Program & {
  readonly day: DayOfWeek;
};

export type EasternClock = {
  readonly day: DayOfWeek;
  readonly weekday: string;
  readonly minutes: number;
  readonly timeLabel: string;
};

export type CurrentProgram = {
  readonly show: Program;
  readonly occurrence?: ScheduledOccurrence;
  readonly isDefault: boolean;
};

export type UpcomingProgram = {
  readonly show: Program;
  readonly day: DayOfWeek;
  readonly start: number;
  readonly minutesUntil: number;
  readonly isDefault: boolean;
  readonly label: string;
};

const weekdayShows = [
  {
    id: 'captains-sunrise-show',
    name: 'Captains Sunrise Show',
    time: '6–10 AM',
    start: 6 * 60,
    end: 10 * 60,
    description: 'Start the day with Captain 97 and a smooth coastal soundtrack for New Bern mornings.',
  },
  {
    id: 'kyle-on-the-dial',
    name: 'Kyle on the Dial',
    host: 'Kyle',
    time: '10 AM–2 PM',
    start: 10 * 60,
    end: 14 * 60,
    description: 'Midday Dock Rock, local personality, and the soundtrack to your workday.',
  },
  {
    id: 'meg-unfiltered',
    name: 'Meg Unfiltered',
    host: 'Meg',
    time: '2–7 PM',
    start: 14 * 60,
    end: 19 * 60,
    description: 'Dock rock, personality, and an unfiltered afternoon soundtrack for the ride home.',
  },
  {
    id: 'ray-michaels-show',
    name: 'The Ray Michaels Show',
    host: 'Ray Michaels',
    time: '7 PM–Midnight',
    start: 19 * 60,
    end: 24 * 60,
    description: 'Smooth evenings, local personality, and coastal favorites with Ray Michaels.',
  },
] as const satisfies readonly Program[];

const saturdayShows = [
  {
    id: 'kyle-on-the-dial-saturday',
    name: 'Kyle on the Dial',
    host: 'Kyle',
    time: '10 AM–2 PM',
    start: 10 * 60,
    end: 14 * 60,
    description: 'A weekend edition of Kyle on the Dial with four hours of Carolina Dock Rock.',
  },
  {
    id: 'captain-97-saturday',
    name: 'Captain 97',
    time: '2–7 PM',
    start: 14 * 60,
    end: 19 * 60,
    description: "Carolina's Dock Rock all afternoon from New Bern.",
  },
] as const satisfies readonly Program[];

const sundayShows = [
  {
    id: 'midday-with-mayday',
    name: 'Midday with Mayday',
    host: 'Mayday',
    time: '10 AM–2 PM',
    start: 10 * 60,
    end: 14 * 60,
    description: 'A laid-back Sunday midday soundtrack with Mayday.',
  },
  {
    id: 'set-sail-sunday-show',
    name: 'Set Sail Sunday Show',
    time: '2–7 PM',
    start: 14 * 60,
    end: 19 * 60,
    description: "Set sail into Sunday afternoon with Captain 97's signature coastal sound.",
  },
] as const satisfies readonly Program[];

/** The canonical, presentation-ready station schedule. All times are Eastern. */
export const scheduleGroups = [
  { dayLabel: 'Monday–Friday', days: [1, 2, 3, 4, 5], shows: weekdayShows },
  { dayLabel: 'Saturday', days: [6], shows: saturdayShows },
  { dayLabel: 'Sunday', days: [0], shows: sundayShows },
] as const satisfies readonly ScheduleGroup[];

export const defaultProgramming: Program = {
  id: 'captain-97-default',
  name: 'Captain 97.1',
  time: 'All other hours',
  start: 0,
  end: 24 * 60,
  description: "Smooth favorites, coastal classics, and Carolina's Dock Rock.",
};

export const weeklySchedule: readonly ScheduledOccurrence[] = scheduleGroups
  .flatMap((group) =>
    group.days.flatMap((day) => group.shows.map((show) => ({ ...show, day }))),
  )
  .sort((a, b) => a.day * 1440 + a.start - (b.day * 1440 + b.start));

const weekdayNumbers: Record<string, DayOfWeek> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function getEasternClock(date: Date = new Date()): EasternClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: siteConfig.timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return {
    day: weekdayNumbers[weekday] ?? 0,
    weekday: dayNames[weekdayNumbers[weekday] ?? 0],
    minutes: hour * 60 + minute,
    timeLabel: new Intl.DateTimeFormat('en-US', {
      timeZone: siteConfig.timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  };
}

export function formatScheduleTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  if (normalized === 0) return 'Midnight';
  if (normalized === 12 * 60) return 'Noon';
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const displayHour = hour % 12 || 12;
  return `${displayHour}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function getCurrentShow(date: Date = new Date()): CurrentProgram {
  const clock = getEasternClock(date);
  const occurrence = weeklySchedule.find(
    (show) => show.day === clock.day && clock.minutes >= show.start && clock.minutes < show.end,
  );

  return occurrence
    ? { show: occurrence, occurrence, isDefault: false }
    : { show: defaultProgramming, isDefault: true };
}

function findNextScheduled(day: DayOfWeek, minutes: number, ignoreName?: string) {
  const nowInWeek = day * 1440 + minutes;
  const candidates = weeklySchedule.flatMap((show) => {
    const startInWeek = show.day * 1440 + show.start;
    const futureStart = startInWeek > nowInWeek ? startInWeek : startInWeek + 7 * 1440;
    return show.name === ignoreName ? [] : [{ show, futureStart }];
  });

  return candidates.sort((a, b) => a.futureStart - b.futureStart)[0];
}

export function getNextShow(date: Date = new Date()): UpcomingProgram {
  const clock = getEasternClock(date);
  const current = getCurrentShow(date);
  const nowInWeek = clock.day * 1440 + clock.minutes;

  if (current.occurrence && current.show.name !== defaultProgramming.name) {
    const endInWeek = current.occurrence.day * 1440 + current.occurrence.end;
    const adjacent = weeklySchedule.find(
      (show) => show.day * 1440 + show.start === endInWeek,
    );

    if (adjacent) {
      return {
        show: adjacent,
        day: adjacent.day,
        start: adjacent.start,
        minutesUntil: endInWeek - nowInWeek,
        isDefault: false,
        label: `Today at ${formatScheduleTime(adjacent.start)}`,
      };
    }

    const nextDay = (current.occurrence.end === 1440
      ? ((current.occurrence.day + 1) % 7)
      : current.occurrence.day) as DayOfWeek;
    const nextStart = current.occurrence.end === 1440 ? 0 : current.occurrence.end;
    return {
      show: defaultProgramming,
      day: nextDay,
      start: nextStart,
      minutesUntil: endInWeek - nowInWeek,
      isDefault: true,
      label: `${nextDay === clock.day ? 'Today' : dayNames[nextDay]} at ${formatScheduleTime(nextStart)}`,
    };
  }

  const next = findNextScheduled(clock.day, clock.minutes, current.show.name);
  if (!next) {
    return {
      show: defaultProgramming,
      day: clock.day,
      start: clock.minutes,
      minutesUntil: 0,
      isDefault: true,
      label: 'On air now',
    };
  }

  const day = (Math.floor(next.futureStart / 1440) % 7) as DayOfWeek;
  const dayOffset = Math.floor(next.futureStart / 1440) - clock.day;
  const when = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : dayNames[day];
  return {
    show: next.show,
    day,
    start: next.show.start,
    minutesUntil: next.futureStart - nowInWeek,
    isDefault: false,
    label: `${when} at ${formatScheduleTime(next.show.start)}`,
  };
}

export function getCurrentAndNextShow(date: Date = new Date()) {
  return {
    clock: getEasternClock(date),
    current: getCurrentShow(date),
    next: getNextShow(date),
  } as const;
}
