'use client';

import { useEffect, useMemo, useState } from 'react';

type Show = {
  name: string;
  host?: string;
  day: number; // 0 = Sunday
  start: number; // minutes after midnight
  end: number;
  image?: string;
  accent?: string;
};

const schedule: Show[] = [
  {
    name: 'Midday with Mayday',
    host: 'Mayday',
    day: 0,
    start: 10 * 60,
    end: 14 * 60,
    accent: 'Sunday · 10 AM–2 PM',
  },
  {
    name: 'Set Sail Sunday Show',
    day: 0,
    start: 14 * 60,
    end: 19 * 60,
    accent: 'Sunday · 2–7 PM',
  },
];

function easternParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: dayMap[weekday] ?? 0, minutes: hour * 60 + minute };
}

export default function OnAirNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const current = useMemo(() => {
    const eastern = easternParts(now);
    return schedule.find(
      (show) => show.day === eastern.day && eastern.minutes >= show.start && eastern.minutes < show.end,
    );
  }, [now]);

  return (
    <div className="radio-card on-air-module">
      <div className="radio-card-top">
        <span className="live-badge">● ON AIR NOW</span>
        <span>WXNR-LP</span>
      </div>

      <div className={`dj-visual${current?.image ? ' has-photo' : ''}`}>
        {current?.image ? (
          <img src={current.image} alt={current.host ? `${current.host} on Captain 97` : current.name} />
        ) : (
          <img src="/captain97-logo.webp" alt="Captain 97" className="dj-fallback-logo" />
        )}
        <div className="dj-visual-shade" />
        <div className="dj-visual-copy">
          <small>{current ? 'CURRENT SHOW' : 'CAROLINA\'S DOCK ROCK'}</small>
          <strong>{current?.name ?? 'Captain 97.1'}</strong>
          <span>{current?.accent ?? 'Live from New Bern'}</span>
        </div>
      </div>

      <div className="now-playing-preview on-air-details">
        <small>ON AIR</small>
        <strong>{current?.host ? `${current.host} · ${current.name}` : current?.name ?? 'Captain 97.1'}</strong>
        <span>{current?.accent ?? 'Smooth favorites and coastal classics'}</span>
      </div>
      <a href="#listen" className="big-play" aria-label="Listen to Captain 97 live">▶</a>
    </div>
  );
}
