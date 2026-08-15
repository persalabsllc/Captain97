'use client';

import { useEffect, useMemo, useState } from 'react';
import { defaultProgramming, getCurrentAndNextShow } from '@/lib/schedule';
import BrandMark from './BrandMark';
import Icon from './Icon';
import { useNowPlaying } from './NowPlayingProvider';
import { ListenButton, useStationPlayer } from './StationPlayer';

export default function OnAirNow() {
  const [now, setNow] = useState<Date | null>(null);
  const { isPlaying } = useStationPlayer();
  const { snapshot, stale } = useNowPlaying();

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const scheduleState = useMemo(() => now ? getCurrentAndNextShow(now) : null, [now]);
  const current = scheduleState?.current.show ?? defaultProgramming;
  const next = scheduleState?.next;
  const currentTrack = stale ? null : snapshot?.current;
  const nextTrack = stale ? null : snapshot?.upNext[0];

  return (
    <article className="on-air-card glow-frame" aria-label="Current Captain 97 programming">
      <div className="on-air-card-top">
        <span className="on-air-live live-label"><i className="status-dot live-dot" aria-hidden="true" />On air now</span>
        <span>WXNR-LP</span>
      </div>

      <div className="on-air-visual on-air-art">
        <div className="on-air-rings"><span /><span /><span /></div>
        <BrandMark />
        <div className="on-air-shimmer" />
      </div>

      <div className="on-air-program on-air-meta">
        <small className="on-air-kicker">{scheduleState ? `${scheduleState.clock.weekday} · ${scheduleState.clock.timeLabel} ET` : 'Live from New Bern'}</small>
        <strong>{current.name}</strong>
        <span>{current.host ? `Hosted by ${current.host}` : current.description}</span>
        {currentTrack ? (
          <span className="on-air-show-next">Next show: {next?.show.name ?? 'Captain 97.1'} · {next?.label ?? 'Schedule loading…'}</span>
        ) : null}
        {currentTrack ? (
          <div className="on-air-track">
            <small>Now playing</small>
            <strong>{currentTrack.title || 'Captain 97.1'}</strong>
            <span>{currentTrack.artist || "Carolina's Dock Rock"}</span>
            <span className="on-air-next">
              Coming up: {nextTrack?.title || 'More Dock Rock'}{nextTrack?.artist ? ` · ${nextTrack.artist}` : ''}
            </span>
          </div>
        ) : (
          <span className="on-air-next">Up next: {next?.show.name ?? 'Captain 97.1'} · {next?.label ?? 'Schedule loading…'}</span>
        )}
      </div>

      <ListenButton className="on-air-play">
        <Icon name={isPlaying ? 'pause' : 'play'} size={21} />
      </ListenButton>
    </article>
  );
}
