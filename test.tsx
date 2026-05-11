import React, { useState, useEffect } from 'react';

const COLORS = ['#e06c75', '#e5c07b', '#98c379', '#56b6c2', '#c678dd'];

export default function App() {
  const [count, setCount] = useState(0);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [colorIdx, setColorIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const color = COLORS[colorIdx % COLORS.length];

  return (
    <div style={{
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: 32,
      background: '#1e1e1e',
      minHeight: '100vh',
      color: '#abb2bf',
    }}>
      <h1 style={{ color, marginBottom: 8, fontSize: 28 }}>
        Hello from Glance
      </h1>

      <p style={{ color: '#5c6370', marginBottom: 32, fontSize: 13 }}>
        Live clock: <span style={{ color: '#e5c07b' }}>{time}</span>
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={() => setCount(c => c - 1)}
          style={btnStyle}
        >
          −
        </button>
        <span style={{ fontSize: 32, fontWeight: 700, color: '#abb2bf', minWidth: 48, textAlign: 'center' }}>
          {count}
        </span>
        <button
          onClick={() => setCount(c => c + 1)}
          style={btnStyle}
        >
          +
        </button>
      </div>

      <button
        onClick={() => setColorIdx(i => i + 1)}
        style={{ ...btnStyle, fontSize: 12, padding: '6px 14px' }}
      >
        cycle color
      </button>

      {count !== 0 && (
        <p style={{ marginTop: 24, color: count > 0 ? '#98c379' : '#e06c75', fontSize: 13 }}>
          {count > 0 ? `${count} above zero` : `${Math.abs(count)} below zero`}
        </p>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#2c313a',
  border: '1px solid #3e4451',
  borderRadius: 6,
  color: '#abb2bf',
  cursor: 'pointer',
  fontSize: 20,
  fontWeight: 700,
  padding: '6px 18px',
};
