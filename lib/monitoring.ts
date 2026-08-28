export const MONITORING_SOURCE_IDS = ['stl', 'offair', 'stream'] as const;

export type MonitoringSourceId = (typeof MONITORING_SOURCE_IDS)[number];

export type MonitoringConnectionState =
  | 'online'
  | 'connecting'
  | 'ready'
  | 'degraded'
  | 'offline'
  | 'stale'
  | 'not_configured'
  | 'unknown';

export type MonitoringSourceTelemetry = {
  readonly connected: boolean;
  readonly leftDbfs: number | null;
  readonly rightDbfs: number | null;
  readonly silence: boolean | null;
};

export type MonitoringTransmitterTelemetry = {
  readonly connected: boolean;
  readonly forwardPowerWatts: number | null;
  readonly reflectedPowerWatts: number | null;
  readonly modulationPercent: number | null;
  readonly programService: string | null;
  readonly radioText: string | null;
};

export type MonitoringListenerTelemetry = {
  readonly current: number;
};

export type StoredMonitoringTelemetry = {
  readonly version: 1;
  readonly receivedAt: string;
  readonly agentAt: string;
  readonly sources: Partial<Record<MonitoringSourceId, MonitoringSourceTelemetry>>;
  readonly transmitter: MonitoringTransmitterTelemetry | null;
  readonly listeners: MonitoringListenerTelemetry | null;
};

export type MonitoringAudioSource = {
  readonly id: MonitoringSourceId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly audioUrl: string | null;
  readonly state: MonitoringConnectionState;
  readonly stateMessage: string;
  readonly leftDbfs: number | null;
  readonly rightDbfs: number | null;
  readonly silence: boolean | null;
};

export type MonitoringControlId = 'news' | 'weather' | 'live365';

export type MonitoringControl = {
  readonly id: MonitoringControlId;
  readonly label: string;
  readonly description: string;
  readonly configured: boolean;
  readonly generationConfigured?: boolean;
  readonly href: string | null;
  readonly latestAudioHref?: string | null;
  readonly latestInfoHref?: string | null;
  readonly archiveHref?: string | null;
  readonly generateHref?: string | null;
};

export type MonitoringAutomationId = Exclude<MonitoringControlId, 'live365'>;

export type MonitoringAutomationAction = 'audio' | 'archive' | 'latest' | 'generate';

export type MonitoringDashboardResponse = {
  readonly generatedAt: string;
  readonly telemetryReceivedAt: string | null;
  readonly telemetryStale: boolean;
  readonly audioSources: readonly MonitoringAudioSource[];
  readonly transmitter: MonitoringTransmitterTelemetry | null;
  readonly listenerCount: number | null;
  readonly nowPlaying: {
    readonly current: {
      readonly artist: string;
      readonly title: string;
      readonly album?: string;
      readonly artworkUrl?: string;
    } | null;
    readonly upNext: readonly {
      readonly artist: string;
      readonly title: string;
    }[];
    readonly updatedAt: string | null;
    readonly stale: boolean;
  };
  readonly controls: readonly MonitoringControl[];
};

type ParseResult =
  | { readonly ok: true; readonly value: StoredMonitoringTelemetry }
  | { readonly ok: false; readonly message: string };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  integer = false,
) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < minimum || value > maximum) return undefined;
  if (integer && !Number.isSafeInteger(value)) return undefined;
  return value;
}

function optionalBoolean(value: unknown) {
  if (value === undefined || value === null) return null;
  return typeof value === 'boolean' ? value : undefined;
}

function telemetryText(value: unknown, maximumLength: number) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength) || null;
}

function parseSource(value: unknown): MonitoringSourceTelemetry | undefined {
  if (!isRecord(value) || typeof value.connected !== 'boolean') return undefined;
  const leftDbfs = optionalNumber(value.leftDbfs, -120, 12);
  const rightDbfs = optionalNumber(value.rightDbfs, -120, 12);
  const silence = optionalBoolean(value.silence);
  if (leftDbfs === undefined || rightDbfs === undefined || silence === undefined) return undefined;
  return { connected: value.connected, leftDbfs, rightDbfs, silence };
}

function parseTransmitter(value: unknown): MonitoringTransmitterTelemetry | undefined {
  if (!isRecord(value) || typeof value.connected !== 'boolean') return undefined;
  const forwardPowerWatts = optionalNumber(value.forwardPowerWatts, 0, 100_000);
  const reflectedPowerWatts = optionalNumber(value.reflectedPowerWatts, 0, 100_000);
  const modulationPercent = optionalNumber(value.modulationPercent, 0, 200);
  const programService = telemetryText(value.programService, 8);
  const radioText = telemetryText(value.radioText, 64);
  if (
    forwardPowerWatts === undefined
    || reflectedPowerWatts === undefined
    || modulationPercent === undefined
    || programService === undefined
    || radioText === undefined
  ) return undefined;
  return {
    connected: value.connected,
    forwardPowerWatts,
    reflectedPowerWatts,
    modulationPercent,
    programService,
    radioText,
  };
}

function parseListeners(value: unknown): MonitoringListenerTelemetry | undefined {
  if (!isRecord(value)) return undefined;
  const current = optionalNumber(value.current, 0, 1_000_000, true);
  return current === null || current === undefined ? undefined : { current };
}

export function parseMonitoringTelemetry(value: unknown): ParseResult {
  if (!isRecord(value) || value.version !== 1) {
    return { ok: false, message: 'Telemetry version 1 is required.' };
  }

  const sources: Partial<Record<MonitoringSourceId, MonitoringSourceTelemetry>> = {};
  if (!isRecord(value.sources)) {
    return { ok: false, message: 'An audio source snapshot object is required.' };
  }
  for (const id of MONITORING_SOURCE_IDS) {
    if (!Object.hasOwn(value.sources, id)) continue;
    const source = parseSource(value.sources[id]);
    if (!source) return { ok: false, message: `${id} audio telemetry must be valid when supplied.` };
    sources[id] = source;
  }

  let transmitter: MonitoringTransmitterTelemetry | null = null;
  if (!Object.hasOwn(value, 'transmitter')) {
    return { ok: false, message: 'A transmitter snapshot or explicit null is required.' };
  }
  if (value.transmitter !== null) {
    transmitter = parseTransmitter(value.transmitter) ?? null;
    if (!transmitter) return { ok: false, message: 'Transmitter telemetry is invalid.' };
  }

  let listeners: MonitoringListenerTelemetry | null = null;
  if (!Object.hasOwn(value, 'listeners')) {
    return { ok: false, message: 'A listener snapshot or explicit null is required.' };
  }
  if (value.listeners !== null) {
    listeners = parseListeners(value.listeners) ?? null;
    if (!listeners) return { ok: false, message: 'Listener telemetry is invalid.' };
  }

  if (typeof value.agentAt !== 'string' || !Number.isFinite(Date.parse(value.agentAt))) {
    return { ok: false, message: 'A valid agent timestamp is required.' };
  }
  const agentTimestamp = Date.parse(value.agentAt);
  if (Math.abs(Date.now() - agentTimestamp) > 5 * 60 * 1_000) {
    return { ok: false, message: 'The agent timestamp is outside the five-minute freshness window.' };
  }
  const agentAt = new Date(agentTimestamp).toISOString();

  return {
    ok: true,
    value: {
      version: 1,
      receivedAt: new Date().toISOString(),
      agentAt,
      sources,
      transmitter,
      listeners,
    },
  };
}
