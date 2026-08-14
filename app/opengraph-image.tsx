import { ImageResponse } from 'next/og';

export const alt = "Captain 97.1 — Carolina's Dock Rock";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          color: '#ffffff',
          background: 'linear-gradient(135deg, #10162f 0%, #25285f 52%, #146f78 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 480,
            height: 480,
            right: -60,
            top: -90,
            borderRadius: 999,
            border: '2px solid rgba(255,216,77,.2)',
            boxShadow: '0 0 120px rgba(255,216,77,.12)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 690,
            height: 690,
            right: -165,
            top: -195,
            borderRadius: 999,
            border: '1px solid rgba(153,226,217,.18)',
          }}
        />
        <div
          style={{
            width: 1030,
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#a8ded0', fontSize: 22, fontWeight: 800, letterSpacing: 5 }}>
            <span style={{ width: 46, height: 2, background: '#ffd84d' }} /> WXNR-LP · NEW BERN
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 28 }}>
            <span style={{ fontFamily: 'Georgia', fontSize: 118, fontWeight: 900, letterSpacing: -8 }}>CAPTAIN</span>
            <span style={{ color: '#ffd84d', fontFamily: 'Georgia', fontSize: 142, fontWeight: 900, letterSpacing: -9 }}>97.1</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ height: 2, width: 165, background: '#5fb68b' }} />
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 7 }}>CAROLINA&apos;S DOCK ROCK</span>
          </div>
          <div style={{ marginTop: 18, color: '#dce8e8', fontSize: 25, letterSpacing: 1.3 }}>
            Smooth classics · Coastal favorites · Local personality
          </div>
        </div>
      </div>
    ),
    size,
  );
}
