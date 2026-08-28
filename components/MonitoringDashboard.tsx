'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  MonitoringAudioSource,
  MonitoringAutomationId,
  MonitoringConnectionState,
  MonitoringDashboardResponse,
  MonitoringSourceId,
} from '@/lib/monitoring';
import BrandMark from './BrandMark';
import Icon from './Icon';

type AuthState = 'loading' | 'signed-out' | 'signed-in';
type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
type StereoLevels = { readonly left: number | null; readonly right: number | null };

type AudioGraph = {
  readonly context: AudioContext;
  readonly source: MediaElementAudioSourceNode;
  readonly splitter: ChannelSplitterNode;
  readonly left: AnalyserNode;
  readonly right: AnalyserNode;
};

const statusLabels: Record<MonitoringConnectionState, string> = {
  online: 'Online',
  connecting: 'Connecting',
  ready: 'Ready',
  degraded: 'Degraded',
  offline: 'Offline',
  stale: 'Stale',
  not_configured: 'Not connected',
  unknown: 'Unknown',
};

const emptyLevels: StereoLevels = { left: null, right: null };
const dashboardConnectionStaleAfterMs = 35_000;
const audioStartTimeoutMs = 12_000;

class AudioStartTimeoutError extends Error {}

async function playAudioWithTimeout(audio: HTMLAudioElement) {
  let timeout: number | undefined;
  try {
    await Promise.race([
      audio.play(),
      new Promise<never>((_resolve, reject) => {
        timeout = window.setTimeout(() => reject(new AudioStartTimeoutError()), audioStartTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

function formatAge(value: string | null, now: number) {
  if (!value) return 'No station-agent check-in';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Unknown update time';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (seconds < 5) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
}

function formatTrackAge(value: string | null, now: number) {
  if (!value) return 'No StationPlaylist update';
  return formatAge(value, now).replace('Updated', 'Metadata');
}

function meterWidth(value: number | null) {
  if (value === null) return 0;
  const clamped = Math.min(0, Math.max(-60, value));
  return ((clamped + 60) / 60) * 100;
}

function formatDb(value: number | null) {
  return value === null ? '—' : `${value.toFixed(1)} dBFS`;
}

function formatMetric(value: number | null | undefined, unit: string, maximumFractionDigits = 1) {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)} ${unit}`;
}

function audioRmsDb(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) sum += sample * sample;
  const rms = Math.sqrt(sum / Math.max(1, buffer.length));
  return Math.max(-90, Math.min(0, 20 * Math.log10(Math.max(rms, 0.000001))));
}

function authoritativeSourceState(
  source: MonitoringAudioSource,
  dashboardConnectionLost: boolean,
): MonitoringConnectionState {
  return dashboardConnectionLost ? 'stale' : source.state;
}

function StatusBadge({ state }: { state: MonitoringConnectionState }) {
  return (
    <span className={`monitor-status-badge is-${state}`}>
      <i aria-hidden="true" />
      {statusLabels[state]}
    </span>
  );
}

function MeterRow({ channel, value }: { channel: 'L' | 'R'; value: number | null }) {
  return (
    <div className="monitor-meter-row">
      <strong>{channel}</strong>
      <div
        className="monitor-meter-track"
        role="meter"
        aria-label={`${channel === 'L' ? 'Left' : 'Right'} audio level`}
        aria-valuemin={-60}
        aria-valuemax={0}
        aria-valuenow={value ?? undefined}
        aria-valuetext={formatDb(value)}
      >
        <span style={{ width: `${meterWidth(value)}%` }} />
      </div>
      <output>{value === null ? '—' : value.toFixed(1)}</output>
    </div>
  );
}

function AudioSourceCard({
  source,
  state,
  levels,
  active,
  playing,
  loading,
  busy,
  onMonitor,
}: {
  source: MonitoringAudioSource;
  state: MonitoringConnectionState;
  levels: StereoLevels;
  active: boolean;
  playing: boolean;
  loading: boolean;
  busy: boolean;
  onMonitor: () => void;
}) {
  const buttonLabel = active && loading
    ? 'Cancel monitor'
    : active && playing
      ? 'Pause monitor'
      : active
        ? 'Resume monitor'
        : 'Monitor source';
  return (
    <article className={`monitor-audio-card${active ? ' is-active' : ''}`}>
      <div className="monitor-audio-card-heading">
        <div>
          <span>{source.shortLabel}</span>
          <h3>{source.label}</h3>
        </div>
        <StatusBadge state={state} />
      </div>
      <p>{source.description}</p>
      <div className="monitor-stereo-meter">
        <MeterRow channel="L" value={levels.left} />
        <MeterRow channel="R" value={levels.right} />
        <div className="monitor-meter-scale" aria-hidden="true">
          <span>−60</span><span>−40</span><span>−20</span><span>−12</span><span>−6</span><span>0</span>
        </div>
      </div>
      <div className="monitor-audio-card-footer">
        <small>{active && playing ? `Live browser meter · ${source.stateMessage}` : source.stateMessage}</small>
        <button
          type="button"
          className="monitor-source-button"
          onClick={onMonitor}
          disabled={!source.audioUrl || busy}
          aria-pressed={active && playing}
        >
          <Icon name={active && loading ? 'close' : active && playing ? 'pause' : 'volume'} size={15} />
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}

export default function MonitoringDashboard() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [username, setUsername] = useState('studio');
  const [password, setPassword] = useState('');
  const [snapshot, setSnapshot] = useState<MonitoringDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [activeSourceId, setActiveSourceId] = useState<MonitoringSourceId | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [sourceSwitching, setSourceSwitching] = useState(false);
  const [liveLevels, setLiveLevels] = useState<StereoLevels>(emptyLevels);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [dashboardConnectionLost, setDashboardConnectionLost] = useState(false);
  const [generationPending, setGenerationPending] = useState<MonitoringAutomationId | null>(null);
  const [controlNotice, setControlNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const graphRef = useRef<AudioGraph | null>(null);
  const audioAttemptRef = useRef(0);
  const audioListenerCleanupRef = useRef<(() => void) | null>(null);
  const statusRequestRef = useRef<AbortController | null>(null);
  const statusWatchStartedAtRef = useRef<number | null>(null);
  const lastStatusSuccessRef = useRef<number | null>(null);

  const clearAudioListeners = useCallback(() => {
    const cleanup = audioListenerCleanupRef.current;
    audioListenerCleanupRef.current = null;
    if (cleanup) cleanup();
  }, []);

  const teardownAudio = useCallback(() => {
    audioAttemptRef.current += 1;
    clearAudioListeners();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      delete audio.dataset.sourceId;
      audio.load();
    }
    const graph = graphRef.current;
    graphRef.current = null;
    if (graph) {
      graph.source.disconnect();
      graph.splitter.disconnect();
      graph.left.disconnect();
      graph.right.disconnect();
      void graph.context.close();
    }
  }, [clearAudioListeners]);

  const bindAudioEvents = useCallback((
    audio: HTMLAudioElement,
    attempt: number,
    source: MonitoringAudioSource,
  ) => {
    clearAudioListeners();
    const isCurrent = () => audioAttemptRef.current === attempt;
    const onPlaying = () => {
      if (isCurrent()) setPlaybackState('playing');
    };
    const onWaiting = () => {
      if (isCurrent() && !audio.paused) setPlaybackState('loading');
    };
    const onPause = () => {
      if (isCurrent()) setPlaybackState('paused');
    };
    const onError = () => {
      if (!isCurrent()) return;
      setPlaybackState('error');
      setLiveLevels(emptyLevels);
      setError(`The ${source.shortLabel} feed stopped. Verify that the feed is online and permits browser audio metering.`);
    };
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onWaiting);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onPause);
    audio.addEventListener('error', onError);
    audioListenerCleanupRef.current = () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onWaiting);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onPause);
      audio.removeEventListener('error', onError);
    };
  }, [clearAudioListeners]);

  const handleUnauthorized = useCallback(() => {
    statusRequestRef.current?.abort();
    statusRequestRef.current = null;
    statusWatchStartedAtRef.current = null;
    lastStatusSuccessRef.current = null;
    teardownAudio();
    setAuthState('signed-out');
    setSnapshot(null);
    setActiveSourceId(null);
    setPlaybackState('idle');
    setSourceSwitching(false);
    setLiveLevels(emptyLevels);
    setDashboardConnectionLost(false);
  }, [teardownAudio]);

  const loadStatus = useCallback(async (silent = false) => {
    statusRequestRef.current?.abort();
    const controller = new AbortController();
    statusRequestRef.current = controller;
    try {
      const response = await fetch('/api/monitoring/status', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const result = await response.json() as MonitoringDashboardResponse & { message?: string };
      if (statusRequestRef.current !== controller) return;
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        if (!silent) setError(result.message ?? 'Engineering monitoring could not be loaded.');
        return;
      }
      setSnapshot(result);
      const receivedAt = Date.now();
      lastStatusSuccessRef.current = receivedAt;
      setDashboardConnectionLost(false);
      setNow(receivedAt);
      if (!silent) setError(null);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      if (!silent) setError('Engineering monitoring could not be reached. Check the connection and try again.');
    } finally {
      if (statusRequestRef.current === controller) statusRequestRef.current = null;
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    void fetch('/api/studio/session', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          setAuthState('signed-out');
          return;
        }
        statusWatchStartedAtRef.current = Date.now();
        lastStatusSuccessRef.current = null;
        setDashboardConnectionLost(false);
        setAuthState('signed-in');
        void loadStatus();
      })
      .catch(() => {
        setError('The private monitoring login could not be reached.');
        setAuthState('signed-out');
      });
  }, [loadStatus]);

  useEffect(() => {
    if (authState !== 'signed-in') return;
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
      statusRequestRef.current?.abort();
      statusRequestRef.current = null;
    };
    const start = () => {
      stop();
      void loadStatus(true);
      timer = window.setInterval(() => void loadStatus(true), 10_000);
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    visibilityChanged();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [authState, loadStatus]);

  useEffect(() => {
    if (authState !== 'signed-in') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const nextNow = Date.now();
      setNow(nextNow);
      const lastContact = lastStatusSuccessRef.current ?? statusWatchStartedAtRef.current;
      if (lastContact && nextNow - lastContact > dashboardConnectionStaleAfterMs) {
        setDashboardConnectionLost(true);
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [authState]);

  useEffect(() => () => {
    statusRequestRef.current?.abort();
    teardownAudio();
  }, [teardownAudio]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [muted, volume]);

  useEffect(() => {
    if (playbackState !== 'playing' || !graphRef.current) return;
    const graph = graphRef.current;
    const leftBuffer = new Float32Array(graph.left.fftSize);
    const rightBuffer = new Float32Array(graph.right.fftSize);
    let frame = 0;
    let lastUpdate = 0;
    const update = (timestamp: number) => {
      if (timestamp - lastUpdate >= 70 && document.visibilityState === 'visible') {
        lastUpdate = timestamp;
        setLiveLevels({
          left: audioRmsDb(graph.left, leftBuffer),
          right: audioRmsDb(graph.right, rightBuffer),
        });
      }
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [playbackState]);

  const initializeAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) throw new Error('Audio element unavailable.');
    if (!graphRef.current) {
      const AudioContextConstructor = window.AudioContext;
      const context = new AudioContextConstructor();
      const source = context.createMediaElementSource(audio);
      const splitter = context.createChannelSplitter(2);
      const left = context.createAnalyser();
      const right = context.createAnalyser();
      left.fftSize = 2048;
      right.fftSize = 2048;
      left.smoothingTimeConstant = 0.72;
      right.smoothingTimeConstant = 0.72;
      source.connect(splitter);
      splitter.connect(left, 0);
      splitter.connect(right, 1);
      source.connect(context.destination);
      graphRef.current = { context, source, splitter, left, right };
    }
    await graphRef.current.context.resume();
  }, []);

  const monitorSource = useCallback(async (source: MonitoringAudioSource) => {
    const audio = audioRef.current;
    if (!audio || !source.audioUrl) return;
    const attempt = audioAttemptRef.current + 1;
    audioAttemptRef.current = attempt;
    clearAudioListeners();
    setError(null);

    if (
      activeSourceId === source.id
      && playbackState === 'loading'
    ) {
      audio.pause();
      audio.removeAttribute('src');
      delete audio.dataset.sourceId;
      audio.load();
      setPlaybackState('paused');
      setSourceSwitching(false);
      setLiveLevels(emptyLevels);
      return;
    }

    if (
      activeSourceId === source.id
      && playbackState === 'playing'
    ) {
      audio.pause();
      setPlaybackState('paused');
      setLiveLevels(emptyLevels);
      return;
    }

    setSourceSwitching(true);
    try {
      setPlaybackState('loading');
      setLiveLevels(emptyLevels);
      const shouldReload = audio.dataset.sourceId !== source.id
        || playbackState === 'error'
        || Boolean(audio.error);
      if (shouldReload) {
        audio.pause();
        audio.src = source.audioUrl;
        audio.dataset.sourceId = source.id;
        setActiveSourceId(source.id);
        bindAudioEvents(audio, attempt, source);
        audio.load();
      } else {
        bindAudioEvents(audio, attempt, source);
      }
      await initializeAudioGraph();
      await playAudioWithTimeout(audio);
      if (audioAttemptRef.current === attempt) setPlaybackState('playing');
    } catch (playError) {
      if (audioAttemptRef.current !== attempt) return;
      clearAudioListeners();
      audio.pause();
      audio.removeAttribute('src');
      delete audio.dataset.sourceId;
      audio.load();
      setPlaybackState('error');
      setError(playError instanceof AudioStartTimeoutError
        ? `The ${source.shortLabel} feed did not start within 12 seconds. Verify the feed, then try again.`
        : `The ${source.shortLabel} feed could not start. Verify that the feed is online and permits browser audio metering.`);
    } finally {
      if (audioAttemptRef.current === attempt) setSourceSwitching(false);
    }
  }, [activeSourceId, bindAudioEvents, clearAudioListeners, initializeAudioGraph, playbackState]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/studio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        setError(result.message ?? 'Sign-in failed.');
        return;
      }
      setPassword('');
      statusWatchStartedAtRef.current = Date.now();
      lastStatusSuccessRef.current = null;
      setDashboardConnectionLost(false);
      setAuthState('signed-in');
      await loadStatus();
    } catch {
      setError('Sign-in could not be completed. Check the connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/studio/session', { method: 'DELETE' });
      if (!response.ok) throw new Error('Sign-out failed.');
      handleUnauthorized();
    } catch {
      setError('Sign-out could not be completed. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function runGeneration(
    id: MonitoringAutomationId,
    href: string,
    label: string,
  ) {
    const confirmed = window.confirm(
      `Generate a new ${label.toLowerCase()} update now? This creates a new file, but it will not replace what is currently scheduled on air.`,
    );
    if (!confirmed) return;

    setGenerationPending(id);
    setControlNotice(null);
    setError(null);
    try {
      const response = await fetch(href, { method: 'POST' });
      const result = await response.json() as { message?: string };
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        setError(result.message ?? `${label} generation could not be started.`);
        return;
      }
      setControlNotice(result.message ?? `${label} generation completed.`);
    } catch {
      setError(`${label} generation could not be reached. Check the latest script before trying again.`);
    } finally {
      setGenerationPending(null);
    }
  }

  const transmitterState: MonitoringConnectionState = dashboardConnectionLost
    ? 'stale'
    : !snapshot?.transmitter
    ? 'not_configured'
    : snapshot.telemetryStale
      ? 'stale'
      : snapshot.transmitter.connected ? 'online' : 'offline';

  const overall = useMemo(() => {
    if (dashboardConnectionLost) return { state: 'stale' as const, label: 'Dashboard data connection lost' };
    if (!snapshot) return { state: 'unknown' as const, label: 'Loading system status' };
    const sourceStates = snapshot.audioSources.map((source) => source.state);
    if (sourceStates.includes('offline') || transmitterState === 'offline') {
      return { state: 'offline' as const, label: 'Attention required' };
    }
    if (sourceStates.includes('degraded')) {
      return { state: 'degraded' as const, label: 'Audio chain degraded' };
    }
    if (snapshot.telemetryReceivedAt && snapshot.telemetryStale) {
      return { state: 'stale' as const, label: 'Station telemetry is stale' };
    }
    if (sourceStates.includes('connecting')) {
      return { state: 'connecting' as const, label: 'Connecting monitor audio' };
    }
    const missing = sourceStates.includes('not_configured') || transmitterState === 'not_configured';
    if (missing) return { state: 'ready' as const, label: 'Monitoring setup in progress' };
    if (sourceStates.includes('ready') || sourceStates.includes('unknown')) {
      return { state: 'ready' as const, label: 'Ready for source check' };
    }
    return { state: 'online' as const, label: 'Systems reporting' };
  }, [dashboardConnectionLost, snapshot, transmitterState]);

  const setupItems = useMemo(() => {
    if (!snapshot) return [];
    const items: string[] = [];
    if (!snapshot.audioSources.find((source) => source.id === 'stl')?.audioUrl) items.push('STL audio feed');
    if (!snapshot.audioSources.find((source) => source.id === 'offair')?.audioUrl) items.push('off-air receiver feed');
    if (!snapshot.transmitter) items.push('transmitter telemetry');
    if (snapshot.listenerCount === null) items.push('Live365 listener count');
    const missingControls = snapshot.controls
      .filter((control) => control.id !== 'live365' && !control.configured)
      .map((control) => control.label.replace('AI ', ''));
    items.push(...missingControls);
    const unprotectedGenerators = snapshot.controls
      .filter((control) => control.id !== 'live365' && !control.generationConfigured)
      .map((control) => `${control.id} generation protection`);
    items.push(...unprotectedGenerators);
    return items;
  }, [snapshot]);

  if (authState === 'loading') {
    return (
      <main id="main-content" className="monitoring-page monitoring-loading-page">
        <div className="studio-loader" aria-label="Checking private monitoring session" />
        <p>Opening engineering monitoring…</p>
      </main>
    );
  }

  if (authState === 'signed-out') {
    return (
      <main id="main-content" className="monitoring-page studio-login-page monitoring-login-page">
        <section className="studio-login-card" aria-labelledby="monitoring-login-title">
          <BrandMark tone="light" href="/" preload />
          <div className="studio-login-lock"><Icon name="radio" size={23} /></div>
          <span className="studio-kicker">Private engineering access</span>
          <h1 id="monitoring-login-title">Station monitoring</h1>
          <p>Sign in with the shared Captain 97 studio account.</p>
          <form onSubmit={signIn}>
            <label>
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              <Icon name="lock" size={16} />
              {pending ? 'Signing in…' : 'Open monitoring'}
            </button>
          </form>
          {error ? <p className="studio-error" role="alert">{error}</p> : null}
        </section>
      </main>
    );
  }

  const activeSource = snapshot?.audioSources.find((source) => source.id === activeSourceId) ?? null;
  const nowPlaying = snapshot?.nowPlaying;
  const live365Control = snapshot?.controls.find((control) => control.id === 'live365');

  return (
    <main id="main-content" className="monitoring-page monitoring-dashboard">
      <audio ref={audioRef} className="station-audio" crossOrigin="anonymous" preload="none" />

      <header className="monitoring-topbar">
        <div className="monitoring-brand-group">
          <BrandMark tone="light" href="/monitoring" preload />
          <div>
            <span>WXNR-LP · 97.1 FM</span>
            <strong>Engineering Monitor</strong>
          </div>
        </div>
        <div className="monitoring-topbar-actions">
          <div className="monitoring-freshness">
            <StatusBadge state={overall.state} />
            <span>{dashboardConnectionLost
              ? 'Dashboard API unreachable'
              : snapshot ? formatAge(snapshot.telemetryReceivedAt, now) : 'Loading telemetry'}</span>
          </div>
          <button type="button" onClick={() => void loadStatus()} disabled={pending}>Refresh</button>
          <button type="button" onClick={() => void signOut()} disabled={pending}>
            <Icon name="logout" size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <div className="monitoring-content">
        <section className="monitoring-overview" aria-labelledby="monitoring-overview-title">
          <div className="monitoring-overview-copy">
            <span>System status</span>
            <h1 id="monitoring-overview-title">{overall.label}</h1>
            <p>Live confidence monitoring for the Captain 97 audio chain, transmitter, metadata, and automation.</p>
          </div>
          <div className="monitoring-status-grid">
            {snapshot?.audioSources.map((source) => {
              const state = authoritativeSourceState(source, dashboardConnectionLost);
              return (
                <div className="monitoring-status-item" key={source.id}>
                  <StatusBadge state={state} />
                  <strong>{source.shortLabel}</strong>
                  <small>{activeSourceId === source.id && playbackState === 'playing'
                    ? `Browser monitoring · ${source.stateMessage}`
                    : dashboardConnectionLost ? 'Dashboard data connection lost.' : source.stateMessage}</small>
                </div>
              );
            })}
            <div className="monitoring-status-item">
              <StatusBadge state={transmitterState} />
              <strong>Transmitter</strong>
              <small>{dashboardConnectionLost
                ? 'Dashboard data connection lost.'
                  : snapshot?.transmitter
                  ? snapshot.telemetryStale
                    ? 'Last transmitter reading is stale.'
                    : (snapshot.transmitter.connected ? 'Telemetry connected' : 'Reported offline')
                  : 'Telemetry not connected yet'}</small>
            </div>
          </div>
        </section>

        {error ? <div className="monitoring-alert" role="alert">{error}</div> : null}
        {dashboardConnectionLost ? (
          <div className="monitoring-alert" role="alert">
            The dashboard has not received a successful status update in more than 35 seconds. Last-known readings are marked stale until the connection returns.
          </div>
        ) : null}

        <div className="monitoring-main-grid">
          <section className="monitor-panel monitor-audio-panel" aria-labelledby="audio-chain-title">
            <div className="monitor-panel-heading">
              <div>
                <span>Confidence monitoring</span>
                <h2 id="audio-chain-title">Audio chain</h2>
              </div>
              <p>Choose one source to hear it. All three meter positions remain visible.</p>
            </div>
            <div className="monitor-audio-grid">
              {snapshot?.audioSources.map((source) => {
                const active = source.id === activeSourceId;
                const levels = active && playbackState === 'playing'
                  ? liveLevels
                  : { left: source.leftDbfs, right: source.rightDbfs };
                return (
                  <AudioSourceCard
                    key={source.id}
                    source={source}
                    state={authoritativeSourceState(source, dashboardConnectionLost)}
                    levels={levels}
                    active={active}
                    playing={active && playbackState === 'playing'}
                    loading={active && playbackState === 'loading'}
                    busy={sourceSwitching && !(active && playbackState === 'loading')}
                    onMonitor={() => void monitorSource(source)}
                  />
                );
              })}
            </div>
            <div className="monitor-console-strip">
              <div className="monitor-console-source">
                <Icon name={playbackState === 'playing' ? 'volume' : 'volume-x'} size={19} />
                <div>
                  <span>Monitor output</span>
                  <strong>{activeSource?.label ?? 'No source selected'}</strong>
                </div>
              </div>
              <div className="monitor-console-controls">
                <button
                  type="button"
                  onClick={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    audio.muted = !audio.muted;
                    setMuted(audio.muted);
                  }}
                  disabled={!activeSource}
                  aria-label={muted ? 'Unmute monitor audio' : 'Mute monitor audio'}
                >
                  <Icon name={muted ? 'volume-x' : 'volume'} size={17} />
                </button>
                <label>
                  <span>Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    disabled={!activeSource}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setVolume(next);
                      if (audioRef.current) audioRef.current.volume = next;
                    }}
                  />
                </label>
                <span className="monitor-console-state">{playbackState === 'playing' ? 'LIVE AUDIO' : playbackState.toUpperCase()}</span>
              </div>
            </div>
          </section>

          <section className="monitor-panel monitor-now-playing" aria-labelledby="now-playing-title">
            <div className="monitor-panel-heading compact">
              <div>
                <span>StationPlaylist</span>
                <h2 id="now-playing-title">Live now</h2>
              </div>
              <StatusBadge state={dashboardConnectionLost || nowPlaying?.stale ? 'stale' : nowPlaying?.current ? 'online' : 'unknown'} />
            </div>
            <div className="monitor-track-card">
              <div className="monitor-album-art">
                <Icon name="radio" size={38} />
              </div>
              <span>Now playing</span>
              <h3>{nowPlaying?.current?.title || 'Awaiting track metadata'}</h3>
              <p>{nowPlaying?.current?.artist || 'Captain 97.1'}</p>
              <small>{formatTrackAge(nowPlaying?.updatedAt ?? null, now)}</small>
            </div>
            <div className="monitor-up-next">
              <span>Coming up</span>
              {nowPlaying?.upNext.length ? nowPlaying.upNext.slice(0, 2).map((track, index) => (
                <div key={`${track.artist}-${track.title}-${index}`}>
                  <b>{index + 1}</b>
                  <p><strong>{track.title}</strong><small>{track.artist}</small></p>
                </div>
              )) : <p className="monitor-empty-copy">No upcoming songs reported.</p>}
            </div>
            <div className="monitor-listener-kpi">
              <span>Online listeners</span>
              <strong>{snapshot?.listenerCount ?? '—'}</strong>
              <small>{snapshot?.listenerCount === null || snapshot?.listenerCount === undefined
                ? 'Live365 does not expose a supported public count API.'
                : dashboardConnectionLost || snapshot.telemetryStale
                  ? 'Last reported count · data stale'
                  : 'Current reported sessions'}</small>
              {live365Control?.href ? (
                <a href={live365Control.href} target="_blank" rel="noopener noreferrer">
                  Open Live365 Analytics <Icon name="external-link" size={13} />
                </a>
              ) : null}
            </div>
          </section>

          <section className="monitor-panel monitor-transmitter" aria-labelledby="transmitter-title">
            <div className="monitor-panel-heading">
              <div>
                <span>RF plant</span>
                <h2 id="transmitter-title">Transmitter</h2>
              </div>
              <div className="monitor-heading-status">
                <StatusBadge state={transmitterState} />
                <small>{dashboardConnectionLost
                  ? 'Dashboard data unavailable'
                  : snapshot ? formatAge(snapshot.telemetryReceivedAt, now) : 'Loading'}</small>
              </div>
            </div>
            <div className="monitor-metric-grid">
              <article>
                <span>Forward power</span>
                <strong>{formatMetric(snapshot?.transmitter?.forwardPowerWatts, 'W')}</strong>
                <small>Transmitter output</small>
              </article>
              <article>
                <span>Reverse power</span>
                <strong>{formatMetric(snapshot?.transmitter?.reflectedPowerWatts, 'W')}</strong>
                <small>Reflected from antenna system</small>
              </article>
              <article>
                <span>Total modulation</span>
                <strong>{formatMetric(snapshot?.transmitter?.modulationPercent, '%')}</strong>
                <small>Off-air modulation monitor</small>
              </article>
            </div>
            <div className="monitor-rds-readout">
              <div>
                <span>RDS Program Service</span>
                <strong>{snapshot?.transmitter?.programService || '—'}</strong>
              </div>
              <div>
                <span>RDS RadioText</span>
                <strong>{snapshot?.transmitter?.radioText || 'No decoded RDS data'}</strong>
              </div>
            </div>
            {!snapshot?.transmitter ? (
              <p className="monitor-panel-note">Connect the transmitter or modulation monitor to the station agent to populate these verified readings. Missing values are intentionally shown as dashes—not zero.</p>
            ) : null}
          </section>

          <section className="monitor-panel monitor-automation" aria-labelledby="automation-title">
            <div className="monitor-panel-heading compact">
              <div>
                <span>On-air automation</span>
                <h2 id="automation-title">AI operations</h2>
              </div>
            </div>
            <div className="monitor-control-list">
              {snapshot?.controls.filter((control) => control.id !== 'live365').map((control) => (
                control.configured ? (
                  <article key={control.id} className="monitor-control-card">
                    <div className="monitor-control-summary">
                      <div className={`monitor-control-icon is-${control.id}`}>
                        <Icon name={control.id === 'weather' ? 'sun' : 'microphone'} size={20} />
                      </div>
                      <div>
                        <strong>{control.label}</strong>
                        <span>{control.description}</span>
                      </div>
                    </div>
                    <div className="monitor-control-actions">
                      {control.latestAudioHref ? (
                        <a href={control.latestAudioHref} target="_blank" rel="noopener noreferrer">
                          <Icon name="play" size={13} /> Listen latest
                        </a>
                      ) : null}
                      {control.latestInfoHref ? (
                        <a href={control.latestInfoHref} target="_blank" rel="noopener noreferrer">
                          Latest script <Icon name="external-link" size={12} />
                        </a>
                      ) : null}
                      {control.archiveHref ? (
                        <a href={control.archiveHref} target="_blank" rel="noopener noreferrer">
                          Archive <Icon name="external-link" size={12} />
                        </a>
                      ) : null}
                      {control.generateHref ? (
                        <button
                          type="button"
                          disabled={generationPending !== null}
                          onClick={() => void runGeneration(
                            control.id as MonitoringAutomationId,
                            control.generateHref!,
                            control.id === 'news' ? 'News' : 'Weather',
                          )}
                        >
                          {generationPending === control.id ? 'Generating…' : 'Generate new'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="is-unavailable"
                          disabled
                          title="The upstream generator must require a private server credential before this control can be enabled."
                        >
                          Secure trigger pending
                        </button>
                      )}
                    </div>
                  </article>
                ) : (
                  <div className="is-disabled" key={control.id}>
                    <div className={`monitor-control-icon is-${control.id}`}>
                      <Icon name={control.id === 'weather' ? 'sun' : 'microphone'} size={20} />
                    </div>
                    <div>
                      <strong>{control.label}</strong>
                      <span>Control link awaiting configuration.</span>
                    </div>
                    <StatusBadge state="not_configured" />
                  </div>
                )
              ))}
            </div>
            {controlNotice ? <p className="monitor-control-notice" role="status">{controlNotice}</p> : null}
            <p className="monitor-automation-note">Manual generation enables after the upstream triggers require a private server credential. Once enabled, it creates a candidate file without replacing the update currently scheduled on air and enforces a five-minute cooldown.</p>
          </section>
        </div>

        {setupItems.length ? (
          <section className="monitoring-setup-note">
            <div><Icon name="radio" size={22} /></div>
            <p>
              <strong>Remaining connections</strong>
              <span>The dashboard is ready for {setupItems.join(', ')}. Once those sources report, these same cards will switch from setup states to live readings automatically.</span>
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
