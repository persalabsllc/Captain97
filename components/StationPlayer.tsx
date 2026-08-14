'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { siteConfig } from '@/lib/site';
import Icon from './Icon';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type StationPlayerContextValue = {
  status: PlayerStatus;
  isPlaying: boolean;
  isMuted: boolean;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  toggleMute: () => void;
};

const StationPlayerContext = createContext<StationPlayerContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setStatus('loading');
    try {
      await audio.play();
    } catch {
      setStatus('error');
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(async () => {
    if (audioRef.current?.paused === false) pause();
    else await play();
  }, [pause, play]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  }, []);

  const value = useMemo<StationPlayerContextValue>(() => ({
    status,
    isPlaying: status === 'playing',
    isMuted,
    play,
    pause,
    toggle,
    toggleMute,
  }), [isMuted, pause, play, status, toggle, toggleMute]);

  return (
    <StationPlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        className="station-audio"
        src={siteConfig.streamUrl}
        preload="none"
        onLoadStart={() => setStatus('loading')}
        onPlaying={() => setStatus('playing')}
        onPause={() => setStatus((current) => current === 'idle' ? 'idle' : 'paused')}
        onWaiting={() => setStatus('loading')}
        onError={() => setStatus('error')}
      >
        Your browser does not support live audio playback.
      </audio>
    </StationPlayerContext.Provider>
  );
}

export function useStationPlayer() {
  const context = useContext(StationPlayerContext);
  if (!context) throw new Error('useStationPlayer must be used within AudioProvider.');
  return context;
}

export type ListenButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

export function ListenButton({
  children,
  className = '',
  type = 'button',
  onClick,
  'aria-label': ariaLabel,
  ...props
}: ListenButtonProps) {
  const { isPlaying, status, toggle } = useStationPlayer();
  const defaultLabel = isPlaying ? 'Pause live radio' : status === 'loading' ? 'Connecting…' : 'Listen live';

  return (
    <button
      type={type}
      className={`listen-button${className ? ` ${className}` : ''}`}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) void toggle();
      }}
      aria-label={ariaLabel ?? defaultLabel}
      aria-pressed={isPlaying}
      data-player-status={status}
      {...props}
    >
      {children ?? <><Icon name={isPlaying ? 'pause' : 'play'} size={18} />{defaultLabel}</>}
    </button>
  );
}

const statusCopy: Record<PlayerStatus, string> = {
  idle: 'Ready to stream',
  loading: 'Connecting live…',
  playing: 'Live stream playing',
  paused: 'Stream paused',
  error: 'Stream unavailable',
};

export function PlayerDock() {
  const { isPlaying, status, toggle } = useStationPlayer();

  return (
    <section id="listen" className="player-dock" aria-label="Captain 97 live player" data-player-status={status}>
      <div className="player-station-copy player-now">
        <span className="status-dot live-dot" aria-hidden="true" />
        <span className="player-live-line player-kicker">LIVE · WXNR-LP</span>
        <strong>Captain 97.1</strong>
      </div>

      <div className="player-dock-actions player-controls">
        <button
          type="button"
          className="player-main-control player-toggle"
          onClick={() => void toggle()}
          aria-label={isPlaying ? 'Pause Captain 97 live stream' : 'Play Captain 97 live stream'}
          aria-pressed={isPlaying}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={22} />
        </button>
        <span className="player-status" aria-live="polite">{statusCopy[status]}</span>
      </div>

      <a className="player-live365-link player-fallback" href={siteConfig.live365Url} target="_blank" rel="noreferrer">
        Live365 <Icon name="external-link" size={14} />
      </a>
    </section>
  );
}

/** Convenience wrapper for layouts that want the provider and dock in one component. */
export function StationPlayerProvider({ children }: { children: ReactNode }) {
  return <AudioProvider>{children}<PlayerDock /></AudioProvider>;
}

export default StationPlayerProvider;
