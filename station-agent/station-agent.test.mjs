import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import test from 'node:test';
import {
  decodeSnmpResponse,
  encodeSnmpGetRequest,
  NAUTEL_VS52_OIDS,
  parseRdsResponse,
  pollTransmitter,
  queryOid,
} from './station-agent.mjs';

function lengthBytes(length) {
  if (length < 0x80) return Buffer.from([length]);
  const bytes = [];
  for (let remaining = length; remaining > 0; remaining = Math.floor(remaining / 256)) {
    bytes.unshift(remaining & 0xff);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag, value) {
  return Buffer.concat([Buffer.from([tag]), lengthBytes(value.length), value]);
}

function integer(value) {
  if (value === 0) return tlv(0x02, Buffer.from([0]));
  const bytes = [];
  for (let remaining = value; remaining > 0; remaining = Math.floor(remaining / 256)) {
    bytes.unshift(remaining & 0xff);
  }
  if (bytes[0] & 0x80) bytes.unshift(0);
  return tlv(0x02, Buffer.from(bytes));
}

function sequence(...items) {
  return tlv(0x30, Buffer.concat(items));
}

function readTlv(buffer, offset) {
  const tag = buffer[offset];
  let length = buffer[offset + 1];
  let header = 2;
  if (length & 0x80) {
    const count = length & 0x7f;
    length = 0;
    for (let index = 0; index < count; index += 1) length = length * 256 + buffer[offset + 2 + index];
    header += count;
  }
  const start = offset + header;
  return { tag, start, end: start + length, next: start + length, value: buffer.subarray(start, start + length) };
}

function signedInteger(bytes) {
  let value = 0;
  for (const byte of bytes) value = value * 256 + byte;
  return value;
}

function decodeOid(bytes) {
  const parts = [];
  let current = 0;
  for (const byte of bytes) {
    current = current * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      if (parts.length === 0) {
        const first = current < 40 ? 0 : current < 80 ? 1 : 2;
        parts.push(first, current - first * 40);
      } else {
        parts.push(current);
      }
      current = 0;
    }
  }
  return parts.join('.');
}

function decodeRequest(request) {
  const message = readTlv(request, 0);
  let offset = message.start;
  const version = readTlv(request, offset);
  offset = version.next;
  const community = readTlv(request, offset);
  offset = community.next;
  const pdu = readTlv(request, offset);
  let pduOffset = pdu.start;
  const requestId = readTlv(request, pduOffset);
  pduOffset = requestId.next;
  const error = readTlv(request, pduOffset);
  pduOffset = error.next;
  const errorIndex = readTlv(request, pduOffset);
  pduOffset = errorIndex.next;
  const bindings = readTlv(request, pduOffset);
  const binding = readTlv(request, bindings.start);
  const oid = readTlv(request, binding.start);
  return {
    community: community.value.toString('utf8'),
    oidBytes: oid.value,
    oid: decodeOid(oid.value),
    requestId: signedInteger(requestId.value),
  };
}

function responseFor(request, value) {
  const decoded = decodeRequest(request);
  const binding = sequence(tlv(0x06, decoded.oidBytes), integer(value));
  const pdu = tlv(0xa2, Buffer.concat([
    integer(decoded.requestId),
    integer(0),
    integer(0),
    sequence(binding),
  ]));
  return sequence(integer(1), tlv(0x04, Buffer.from(decoded.community)), pdu);
}

async function withMockSnmp(values, callback) {
  const server = dgram.createSocket('udp4');
  server.on('message', (request, remote) => {
    const decoded = decodeRequest(request);
    const value = values[decoded.oid];
    const response = responseFor(request, value ?? 0);
    server.send(response, remote.port, remote.address);
  });
  await new Promise((resolve) => server.bind(0, '127.0.0.1', resolve));
  try {
    await callback(server.address().port);
  } finally {
    server.close();
  }
}

test('encodes a single-variable SNMP v2c GET request', () => {
  const request = encodeSnmpGetRequest('monitor-only', NAUTEL_VS52_OIDS.forwardPower, 1234);
  assert.equal(request[0], 0x30);
  assert.ok(request.includes(Buffer.from('monitor-only')));
  assert.deepEqual(request.subarray(-2), Buffer.from([0x05, 0x00]));
  const decoded = decodeRequest(request);
  assert.equal(decoded.requestId, 1234);
  assert.equal(decoded.oid, NAUTEL_VS52_OIDS.forwardPower);
});

test('decodes a Nautel integer response', () => {
  const request = encodeSnmpGetRequest('monitor-only', NAUTEL_VS52_OIDS.forwardPower, 44);
  const response = responseFor(request, 300_000);
  assert.equal(decodeSnmpResponse(response, 44).value, 300_000);
});

test('queries one OID over UDP', async () => {
  await withMockSnmp({ [NAUTEL_VS52_OIDS.forwardPower]: 300_000 }, async (port) => {
    const value = await queryOid({
      host: '127.0.0.1',
      port,
      community: 'monitor-only',
      oid: NAUTEL_VS52_OIDS.forwardPower,
      timeoutMs: 500,
    });
    assert.equal(value, 300_000);
  });
});

test('normalizes VS 5.2 transmitter readings from integer thousandths', async () => {
  await withMockSnmp({
    [NAUTEL_VS52_OIDS.rfState]: 1,
    [NAUTEL_VS52_OIDS.forwardPower]: 300_000,
    [NAUTEL_VS52_OIDS.reflectedPower]: 140,
    [NAUTEL_VS52_OIDS.peakModulation]: 99_050,
  }, async (port) => {
    const reading = await pollTransmitter({
      transmitterHost: '127.0.0.1',
      snmpPort: port,
      snmpCommunity: 'monitor-only',
      snmpTimeoutMs: 500,
      rds: { enabled: false, port: 7005, timeoutMs: 500 },
    });
    assert.deepEqual(reading, {
      connected: true,
      forwardPowerWatts: 300,
      reflectedPowerWatts: 0.14,
      modulationPercent: 99.05,
      programService: null,
      radioText: null,
    });
  });
});

test('parses the documented read-only Nautel RDS query responses', () => {
  assert.equal(parseRdsResponse('PS?', 'PS?\r\nPS=CAPTN97\r\n', 8), 'CAPTN97');
  assert.equal(
    parseRdsResponse('TEXT?', 'TEXT=Captain 97.1 - Carolina\'s Dock Rock\r\n', 64),
    "Captain 97.1 - Carolina's Dock Rock",
  );
});
