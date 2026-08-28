import 'server-only';
import { siteConfig } from './site';
import type {
  MonitoringAudioSource,
  MonitoringAutomationAction,
  MonitoringAutomationId,
  MonitoringConnectionState,
  MonitoringControl,
  MonitoringControlId,
  MonitoringSourceId,
  StoredMonitoringTelemetry,
} from './monitoring';

const sourceDetails: Record<MonitoringSourceId, {
  label: string;
  shortLabel: string;
  description: string;
}> = {
  stl: {
    label: 'Studio Transmitter Link',
    shortLabel: 'Barix STL',
    description: 'The Barix program-audio relay feeding the transmitter site.',
  },
  offair: {
    label: 'Off-Air Receiver',
    shortLabel: 'Off-Air',
    description: 'The decoded 97.1 FM signal received over the air.',
  },
  stream: {
    label: 'Online Stream',
    shortLabel: 'Stream',
    description: 'The public Captain 97 Live365 stream heard by online listeners.',
  },
};

const credentialParameterPattern = /(auth|credential|key|password|secret|signature|token)/i;

function safeConfiguredUrl(raw: string | undefined, allowAudioQuery = false) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const isLocalDevelopment = process.env.NODE_ENV === 'development'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if (url.protocol !== 'https:' && !(isLocalDevelopment && url.protocol === 'http:')) return null;
    if (url.username || url.password) return null;
    if (
      allowAudioQuery
      && Array.from(url.searchParams.keys()).some((key) => credentialParameterPattern.test(key))
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function telemetryStaleAfterMs() {
  const configured = Number.parseInt(process.env.MONITORING_STALE_AFTER_SECONDS ?? '', 10);
  const seconds = Number.isFinite(configured)
    ? Math.min(300, Math.max(10, configured))
    : 30;
  return seconds * 1_000;
}

export function isMonitoringTelemetryStale(telemetry: StoredMonitoringTelemetry | null) {
  if (!telemetry) return true;
  const receivedAt = Date.parse(telemetry.receivedAt);
  return !Number.isFinite(receivedAt) || Date.now() - receivedAt > telemetryStaleAfterMs();
}

function configuredAudioUrl(id: MonitoringSourceId) {
  if (id === 'stl') return safeConfiguredUrl(process.env.MONITORING_STL_AUDIO_URL, true);
  if (id === 'offair') return safeConfiguredUrl(process.env.MONITORING_OFFAIR_AUDIO_URL, true);
  return safeConfiguredUrl(process.env.MONITORING_STREAM_AUDIO_URL, true) ?? siteConfig.streamUrl;
}

function sourceState(
  configured: boolean,
  telemetry: StoredMonitoringTelemetry | null,
  telemetryStale: boolean,
  id: MonitoringSourceId,
): { state: MonitoringConnectionState; stateMessage: string } {
  const reading = telemetry?.sources[id];
  if (!reading) {
    if (!configured) return {
      state: 'not_configured',
      stateMessage: 'Audio feed not connected yet.',
    };
    return {
      state: 'ready',
      stateMessage: id === 'stream' ? 'Select Monitor to verify the live stream.' : 'Feed is configured; select Monitor to test it.',
    };
  }
  if (telemetryStale) return {
    state: 'stale',
    stateMessage: 'Last station-agent reading is stale.',
  };
  if (!reading.connected) return {
    state: 'offline',
    stateMessage: 'The station agent reports this source offline.',
  };
  if (reading.silence) return {
    state: 'degraded',
    stateMessage: 'Connected, but silence is being detected.',
  };
  return {
    state: 'online',
    stateMessage: 'Connected with fresh audio telemetry.',
  };
}

export function monitoringAudioSources(
  telemetry: StoredMonitoringTelemetry | null,
  telemetryStale: boolean,
): readonly MonitoringAudioSource[] {
  return (Object.keys(sourceDetails) as MonitoringSourceId[]).map((id) => {
    const audioUrl = configuredAudioUrl(id);
    const reading = telemetry?.sources[id];
    const connection = sourceState(Boolean(audioUrl), telemetry, telemetryStale, id);
    return {
      id,
      ...sourceDetails[id],
      audioUrl,
      ...connection,
      leftDbfs: reading?.leftDbfs ?? null,
      rightDbfs: reading?.rightDbfs ?? null,
      silence: reading?.silence ?? null,
    };
  });
}

const controlDetails: Record<MonitoringControlId, {
  label: string;
  description: string;
}> = {
  news: {
    label: 'AI News Generation',
    description: 'Review, listen to, or manually generate the Captain 97 local news update.',
  },
  weather: {
    label: 'AI Weather Generation',
    description: 'Review, listen to, or manually generate the Captain 97 weather update.',
  },
  live365: {
    label: 'Live365 Analytics',
    description: 'Open Live365 to view its authenticated real-time listener analytics.',
  },
};

export function monitoringControlUrl(id: MonitoringControlId) {
  if (id !== 'live365') return null;
  const configured = safeConfiguredUrl(
    process.env.LIVE365_ANALYTICS_URL ?? 'https://dashboard.live365.com',
  );
  if (!configured) return null;
  const url = new URL(configured);
  if (url.hash || Array.from(url.searchParams.keys()).some((key) => credentialParameterPattern.test(key))) {
    return null;
  }
  const configuredHosts = (process.env.MONITORING_CONTROL_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const allowedHosts = new Set([
    'dashboard.live365.com',
    'dj.kd8hln.com',
    ...configuredHosts,
  ]);
  return allowedHosts.has(url.hostname.toLowerCase()) ? url.toString() : null;
}

const automationDetails: Record<MonitoringAutomationId, Record<MonitoringAutomationAction, () => string | undefined>> = {
  news: {
    audio: () => process.env.MONITORING_NEWS_LATEST_AUDIO_URL
      ?? 'https://dj.kd8hln.com/2026/news.mp3',
    archive: () => process.env.MONITORING_NEWS_ARCHIVE_URL
      ?? 'https://dj.kd8hln.com/2026/past_news/',
    latest: () => process.env.MONITORING_NEWS_ARCHIVE_URL
      ?? 'https://dj.kd8hln.com/2026/past_news/',
    generate: () => process.env.MONITORING_NEWS_GENERATE_URL,
  },
  weather: {
    audio: () => process.env.MONITORING_WEATHER_LATEST_AUDIO_URL
      ?? 'https://dj.kd8hln.com/2026/weather.mp3',
    archive: () => process.env.MONITORING_WEATHER_ARCHIVE_URL
      ?? 'https://dj.kd8hln.com/2026/past/',
    latest: () => process.env.MONITORING_WEATHER_ARCHIVE_URL
      ?? 'https://dj.kd8hln.com/2026/past/',
    generate: () => process.env.MONITORING_WEATHER_GENERATE_URL,
  },
};

export function isMonitoringAutomationId(value: string): value is MonitoringAutomationId {
  return Object.hasOwn(automationDetails, value);
}

export function isMonitoringAutomationAction(value: string): value is MonitoringAutomationAction {
  return value === 'audio' || value === 'archive' || value === 'latest' || value === 'generate';
}

export function monitoringAutomationUrl(
  id: MonitoringAutomationId,
  action: MonitoringAutomationAction,
) {
  const configured = safeConfiguredUrl(automationDetails[id][action](), true);
  if (!configured) return null;
  const url = new URL(configured);
  if (url.hash || url.search) return null;
  const configuredOrigins = (process.env.MONITORING_AUTOMATION_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => {
      try {
        return new URL(origin.trim()).origin.toLowerCase();
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  const allowedOrigins = new Set(['https://dj.kd8hln.com', ...configuredOrigins]);
  return allowedOrigins.has(url.origin.toLowerCase()) ? url.toString() : null;
}

export function monitoringControls(): readonly MonitoringControl[] {
  return (Object.keys(controlDetails) as MonitoringControlId[]).map((id) => {
    if (id !== 'live365') {
      const audio = monitoringAutomationUrl(id, 'audio');
      const archive = monitoringAutomationUrl(id, 'archive');
      const latest = monitoringAutomationUrl(id, 'latest');
      const generate = monitoringAutomationUrl(id, 'generate');
      const generationConfigured = Boolean(generate);
      const configured = Boolean(audio && archive && latest);
      return {
        id,
        label: controlDetails[id].label,
        description: controlDetails[id].description,
        configured,
        generationConfigured,
        href: archive ? `/api/monitoring/automation/${id}/archive` : null,
        latestAudioHref: audio ? `/api/monitoring/automation/${id}/audio` : null,
        latestInfoHref: latest ? `/api/monitoring/automation/${id}/latest` : null,
        archiveHref: archive ? `/api/monitoring/automation/${id}/archive` : null,
        generateHref: generationConfigured ? `/api/monitoring/automation/${id}/generate` : null,
      };
    }
    const configured = Boolean(monitoringControlUrl(id));
    return {
      id,
      label: controlDetails[id].label,
      description: controlDetails[id].description,
      configured,
      href: configured ? `/api/monitoring/control/${id}` : null,
    };
  });
}

export function isMonitoringControlId(value: string): value is MonitoringControlId {
  return Object.hasOwn(controlDetails, value);
}
