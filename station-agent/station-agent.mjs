import dgram from 'node:dgram';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const NAUTEL_VS_BASE = '1.3.6.1.4.1.28142.1.300';

export const NAUTEL_VS52_OIDS = Object.freeze({
  rfState: `${NAUTEL_VS_BASE}.256.35.0`,
  forwardPower: `${NAUTEL_VS_BASE}.256.256.0`,
  reflectedPower: `${NAUTEL_VS_BASE}.256.257.0`,
  peakModulation: `${NAUTEL_VS_BASE}.1025.291.0`,
});

const defaultConfig = Object.freeze({
  transmitterHost: '192.168.1.11',
  snmpPort: 161,
  snmpTimeoutMs: 2_000,
  pollIntervalSeconds: 10,
  ingestUrl: 'https://www.captain97.com/api/monitoring/ingest',
  rds: { enabled: true, port: 7005, timeoutMs: 2_000 },
  logPath: 'C:\\ProgramData\\Captain97\\StationAgent\\station-agent.log',
});

function encodeLength(length) {
  if (!Number.isSafeInteger(length) || length < 0) throw new Error('Invalid BER length.');
  if (length < 0x80) return Buffer.from([length]);
  const bytes = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag, value) {
  return Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value]);
}

function encodeInteger(value) {
  if (!Number.isSafeInteger(value)) throw new Error('SNMP integer must be a safe integer.');
  if (value === 0) return tlv(0x02, Buffer.from([0]));
  if (value < 0) throw new Error('Negative outbound SNMP integers are not supported.');
  const bytes = [];
  let remaining = value;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  if (bytes[0] & 0x80) bytes.unshift(0);
  return tlv(0x02, Buffer.from(bytes));
}

function encodeOidPart(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid OID part.');
  const bytes = [value & 0x7f];
  let remaining = Math.floor(value / 128);
  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  return bytes;
}

function encodeOid(oid) {
  const parts = oid.replace(/^\./, '').split('.').map(Number);
  if (parts.length < 2 || parts[0] > 2 || parts[0] < 0 || parts[1] < 0) {
    throw new Error(`Invalid OID: ${oid}`);
  }
  const bytes = [...encodeOidPart(parts[0] * 40 + parts[1])];
  for (const part of parts.slice(2)) bytes.push(...encodeOidPart(part));
  return tlv(0x06, Buffer.from(bytes));
}

function sequence(...items) {
  return tlv(0x30, Buffer.concat(items));
}

export function encodeSnmpGetRequest(community, oid, requestId) {
  const variableBinding = sequence(encodeOid(oid), tlv(0x05, Buffer.alloc(0)));
  const pdu = tlv(0xa0, Buffer.concat([
    encodeInteger(requestId),
    encodeInteger(0),
    encodeInteger(0),
    sequence(variableBinding),
  ]));
  return sequence(
    encodeInteger(1),
    tlv(0x04, Buffer.from(community, 'utf8')),
    pdu,
  );
}

function readTlv(buffer, offset) {
  if (offset + 2 > buffer.length) throw new Error('Truncated BER value.');
  const tag = buffer[offset];
  let length = buffer[offset + 1];
  let headerLength = 2;
  if (length & 0x80) {
    const byteCount = length & 0x7f;
    if (byteCount === 0 || byteCount > 4 || offset + 2 + byteCount > buffer.length) {
      throw new Error('Invalid BER length.');
    }
    length = 0;
    for (let index = 0; index < byteCount; index += 1) {
      length = length * 256 + buffer[offset + 2 + index];
    }
    headerLength += byteCount;
  }
  const start = offset + headerLength;
  const end = start + length;
  if (end > buffer.length) throw new Error('Truncated BER payload.');
  return { tag, start, end, next: end, value: buffer.subarray(start, end) };
}

function decodeSignedInteger(bytes) {
  if (bytes.length === 0 || bytes.length > 8) throw new Error('Invalid SNMP integer.');
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  if (bytes[0] & 0x80) value -= 1n << BigInt(bytes.length * 8);
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('SNMP integer exceeds JavaScript range.');
  return number;
}

function decodeUnsignedInteger(bytes) {
  if (bytes.length === 0 || bytes.length > 8) throw new Error('Invalid SNMP unsigned integer.');
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('SNMP integer exceeds JavaScript range.');
  return number;
}

function decodeSnmpValue(valueTlv) {
  if (valueTlv.tag === 0x02) return decodeSignedInteger(valueTlv.value);
  if ([0x41, 0x42, 0x43, 0x46].includes(valueTlv.tag)) {
    return decodeUnsignedInteger(valueTlv.value);
  }
  if (valueTlv.tag === 0x04) return valueTlv.value.toString('utf8');
  if ([0x80, 0x81, 0x82].includes(valueTlv.tag)) throw new Error('Nautel OID is unavailable.');
  throw new Error(`Unsupported SNMP value type 0x${valueTlv.tag.toString(16)}.`);
}

export function decodeSnmpResponse(buffer, expectedRequestId) {
  const message = readTlv(buffer, 0);
  if (message.tag !== 0x30 || message.next !== buffer.length) throw new Error('Invalid SNMP message.');
  let offset = message.start;
  const version = readTlv(buffer, offset);
  offset = version.next;
  const community = readTlv(buffer, offset);
  offset = community.next;
  const pdu = readTlv(buffer, offset);
  if (pdu.tag !== 0xa2) throw new Error('SNMP response PDU was not received.');
  let pduOffset = pdu.start;
  const requestId = readTlv(buffer, pduOffset);
  pduOffset = requestId.next;
  const errorStatus = readTlv(buffer, pduOffset);
  pduOffset = errorStatus.next;
  const errorIndex = readTlv(buffer, pduOffset);
  pduOffset = errorIndex.next;
  const decodedRequestId = decodeSignedInteger(requestId.value);
  if (decodedRequestId !== expectedRequestId) throw new Error('SNMP response request ID did not match.');
  const status = decodeSignedInteger(errorStatus.value);
  if (status !== 0) throw new Error(`Nautel returned SNMP error ${status}.`);
  const bindings = readTlv(buffer, pduOffset);
  if (bindings.tag !== 0x30) throw new Error('SNMP variable bindings are missing.');
  const binding = readTlv(buffer, bindings.start);
  if (binding.tag !== 0x30) throw new Error('SNMP variable binding is invalid.');
  const oid = readTlv(buffer, binding.start);
  const value = readTlv(buffer, oid.next);
  return {
    community: community.value.toString('utf8'),
    errorIndex: decodeSignedInteger(errorIndex.value),
    value: decodeSnmpValue(value),
  };
}

export async function queryOid({ host, port, community, oid, timeoutMs }) {
  const requestId = Math.floor(Math.random() * 0x3fffffff) + 1;
  const request = encodeSnmpGetRequest(community, oid, requestId);
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error(`SNMP timeout for ${oid}.`)), timeoutMs);
    socket.once('error', (error) => finish(error));
    socket.on('message', (message, remote) => {
      if (remote.address !== host || remote.port !== port) return;
      try {
        const decoded = decodeSnmpResponse(message, requestId);
        if (decoded.community !== community) throw new Error('SNMP response community did not match.');
        finish(null, decoded.value);
      } catch (error) {
        finish(error);
      }
    });
    socket.send(request, port, host, (error) => {
      if (error) finish(error);
    });
  });
}

async function queryOidWithRetry(options) {
  try {
    return await queryOid(options);
  } catch {
    return queryOid(options);
  }
}

function sanitizeRds(value, maximumLength) {
  if (!value) return null;
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength) || null;
}

export function parseRdsResponse(command, response, maximumLength) {
  const name = command.replace('?', '').toUpperCase();
  const lines = response
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.toUpperCase() !== command.toUpperCase());
  const named = lines.find((line) => new RegExp(`^${name}\\s*[=:]`, 'i').test(line));
  const raw = named ? named.replace(new RegExp(`^${name}\\s*[=:]\\s*`, 'i'), '') : lines.at(-1);
  return sanitizeRds(raw, maximumLength);
}

async function queryRds({ host, port, timeoutMs }, command, maximumLength) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks = [];
    let settled = false;
    let idleTimer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(idleTimer);
      socket.destroy();
      if (error) reject(error);
      else resolve(parseRdsResponse(command, Buffer.concat(chunks).toString('utf8'), maximumLength));
    };
    const timeoutTimer = setTimeout(() => {
      if (chunks.length) finish(null);
      else finish(new Error(`RDS timeout for ${command}.`));
    }, timeoutMs);
    socket.once('connect', () => socket.write(`${command}\r\n`));
    socket.on('data', (chunk) => {
      chunks.push(chunk);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => finish(null), 150);
    });
    socket.once('end', () => finish(null));
    socket.once('error', (error) => finish(error));
  });
}

function normalizeThousandths(value) {
  return Number.isFinite(value) ? value / 1_000 : null;
}

export async function pollTransmitter(config) {
  const snmp = {
    host: config.transmitterHost,
    port: config.snmpPort,
    community: config.snmpCommunity,
    timeoutMs: config.snmpTimeoutMs,
  };
  const readings = {};
  for (const [name, oid] of Object.entries(NAUTEL_VS52_OIDS)) {
    try {
      readings[name] = await queryOidWithRetry({ ...snmp, oid });
    } catch {
      readings[name] = null;
    }
  }

  let programService = null;
  let radioText = null;
  if (config.rds.enabled && readings.rfState !== null) {
    const rds = { host: config.transmitterHost, ...config.rds };
    [programService, radioText] = await Promise.all([
      queryRds(rds, 'PS?', 8).catch(() => null),
      queryRds(rds, 'TEXT?', 64).catch(() => null),
    ]);
  }

  return {
    connected: readings.rfState !== null,
    forwardPowerWatts: normalizeThousandths(readings.forwardPower),
    reflectedPowerWatts: normalizeThousandths(readings.reflectedPower),
    modulationPercent: normalizeThousandths(readings.peakModulation),
    programService,
    radioText,
  };
}

function loadConfig(configPath) {
  const configured = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  const config = {
    ...defaultConfig,
    ...configured,
    rds: { ...defaultConfig.rds, ...(configured.rds ?? {}) },
  };
  if (typeof config.transmitterHost !== 'string' || !config.transmitterHost.trim()) {
    throw new Error('transmitterHost is required.');
  }
  if (!Number.isInteger(config.snmpPort) || config.snmpPort < 1 || config.snmpPort > 65535) {
    throw new Error('snmpPort must be a valid port.');
  }
  if (typeof config.snmpCommunity !== 'string' || config.snmpCommunity.length < 8) {
    throw new Error('snmpCommunity must contain at least 8 characters.');
  }
  if (typeof config.ingestToken !== 'string' || config.ingestToken.length < 32) {
    throw new Error('ingestToken must contain at least 32 characters.');
  }
  const ingestUrl = new URL(config.ingestUrl);
  if (ingestUrl.protocol !== 'https:' || ingestUrl.origin !== 'https://www.captain97.com') {
    throw new Error('ingestUrl must use the Captain 97 HTTPS origin.');
  }
  if (!Number.isInteger(config.pollIntervalSeconds) || config.pollIntervalSeconds < 10) {
    throw new Error('pollIntervalSeconds must be at least 10.');
  }
  return config;
}

function telemetryPayload(transmitter) {
  return {
    version: 1,
    agentAt: new Date().toISOString(),
    sources: {},
    transmitter,
    listeners: null,
  };
}

async function postTelemetry(config, payload) {
  const response = await fetch(config.ingestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.ingestToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Captain97-Station-Agent/1.0',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Ingest returned HTTP ${response.status}: ${responseText.slice(0, 200)}`);
}

function appendLog(config, level, message, fields = {}) {
  const line = `${JSON.stringify({ at: new Date().toISOString(), level, message, ...fields })}\n`;
  try {
    fs.mkdirSync(path.dirname(config.logPath), { recursive: true });
    if (fs.existsSync(config.logPath) && fs.statSync(config.logPath).size > 5_000_000) {
      fs.renameSync(config.logPath, `${config.logPath}.1`);
    }
    fs.appendFileSync(config.logPath, line, 'utf8');
  } catch {
    // Logging must never stop transmitter telemetry.
  }
  process.stdout.write(line);
}

async function runCycle(config, dryRun) {
  const transmitter = await pollTransmitter(config);
  const payload = telemetryPayload(transmitter);
  if (dryRun) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    if (!transmitter.connected) throw new Error('The Nautel did not answer any read-only SNMP query.');
    return;
  }
  await postTelemetry(config, payload);
  appendLog(config, 'info', 'Telemetry delivered.', {
    connected: transmitter.connected,
    forwardPowerWatts: transmitter.forwardPowerWatts,
    reflectedPowerWatts: transmitter.reflectedPowerWatts,
    modulationPercent: transmitter.modulationPercent,
    rdsAvailable: Boolean(transmitter.programService || transmitter.radioText),
  });
}

function parseArguments(argv) {
  const configIndex = argv.indexOf('--config');
  if (configIndex < 0 || !argv[configIndex + 1]) throw new Error('Use --config <path>.');
  return {
    configPath: path.resolve(argv[configIndex + 1]),
    once: argv.includes('--once'),
    dryRun: argv.includes('--dry-run'),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const config = loadConfig(options.configPath);
  if (options.once) {
    await runCycle(config, options.dryRun);
    return;
  }
  let stopped = false;
  const stop = () => { stopped = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  while (!stopped) {
    const startedAt = Date.now();
    try {
      await runCycle(config, false);
    } catch (error) {
      appendLog(config, 'error', error instanceof Error ? error.message : 'Unknown station-agent error.');
    }
    const remaining = Math.max(1_000, config.pollIntervalSeconds * 1_000 - (Date.now() - startedAt));
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
