import 'server-only';
import { getChatRedis } from './chat-store';
import type { StoredMonitoringTelemetry } from './monitoring';

const deploymentScope = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development')
  .replace(/[^a-z0-9-]/gi, '')
  .toLowerCase()
  .slice(0, 32) || 'development';

const MONITORING_TELEMETRY_KEY = `captain97:monitoring:v1:${deploymentScope}:telemetry`;
const TELEMETRY_HISTORY_SECONDS = 7 * 24 * 60 * 60;

export class MonitoringTelemetryReplayError extends Error {
  constructor() {
    super('Telemetry is older than or equal to the latest station-agent update.');
    this.name = 'MonitoringTelemetryReplayError';
  }
}

export async function saveMonitoringTelemetry(telemetry: StoredMonitoringTelemetry) {
  const saved = await getChatRedis().eval<string[], number>(
    [
      'local raw = redis.call("GET", KEYS[1])',
      'if raw then',
      '  local current = cjson.decode(raw)',
      '  if current.agentAt and current.agentAt >= ARGV[1] then return 0 end',
      'end',
      'redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])',
      'return 1',
    ].join('\n'),
    [MONITORING_TELEMETRY_KEY],
    [telemetry.agentAt, JSON.stringify(telemetry), String(TELEMETRY_HISTORY_SECONDS)],
  );
  if (saved !== 1) throw new MonitoringTelemetryReplayError();
}

export async function readMonitoringTelemetry() {
  return getChatRedis().get<StoredMonitoringTelemetry>(MONITORING_TELEMETRY_KEY);
}
