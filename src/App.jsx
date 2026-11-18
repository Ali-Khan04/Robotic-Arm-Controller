import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

// Point this at your ESP32's IP (printed to Serial on boot)
const ESP32_WS_URL = import.meta.env.VITE_ESP32_WS_URL;

const JOINTS = [
  { ch: 6, label: 'Base' },
  { ch: 1, label: 'Shoulder' },
  { ch: 2, label: 'Elbow' },
  { ch: 3, label: 'Wrist joint' },
  { ch: 4, label: 'Wrist joint 2' },
  { ch: 5, label: 'Claw / gripper' },
];

const THROTTLE_MS = 30; // don't flood the websocket while dragging

export default function App() {
  const [angles, setAngles] = useState(JOINTS.map(() => 90));
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const lastSentRef = useRef({});

  useEffect(() => {
    const socket = new WebSocket(ESP32_WS_URL);
    wsRef.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);

    return () => socket.close();
  }, []);

  const sendAngle = useCallback((ch, angle) => {
    const now = performance.now();
    const last = lastSentRef.current[ch] || 0;
    if (now - last < THROTTLE_MS) return;
    lastSentRef.current[ch] = now;

    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ ch, angle }));
    }
  }, []);

  const handleSlide = (index, ch, value) => {
    const angle = Number(value);
    setAngles((prev) => {
      const next = [...prev];
      next[index] = angle;
      return next;
    });
    sendAngle(ch, angle);
  };

  const nudge = (index, ch, delta) => {
    setAngles((prev) => {
      const next = [...prev];
      const newAngle = Math.min(180, Math.max(0, next[index] + delta));
      next[index] = newAngle;
      sendAngle(ch, newAngle);
      return next;
    });
  };

  const centerAll = () => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ cmd: 'center' }));
    }
    setAngles(JOINTS.map(() => 90));
  };

  return (
    <div className="panel">
      <header className="panel-header">
        <h1>Arm Control</h1>
        <span className={`status ${connected ? 'status-ok' : 'status-down'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </header>

      <div className="joints">
        {JOINTS.map((joint, i) => (
          <div className="joint-row" key={joint.ch}>
            <div className="joint-label">
              <span>{joint.label}</span>
              <span className="joint-value">{angles[i]}°</span>
            </div>
            <div className="slider-row">
              <button
                className="nudge-btn"
                onClick={() => nudge(i, joint.ch, -1)}
                disabled={!connected}
                aria-label={`Decrease ${joint.label}`}
              >
                −
              </button>
              <input
                type="range"
                min="0"
                max="180"
                value={angles[i]}
                onChange={(e) => handleSlide(i, joint.ch, e.target.value)}
                disabled={!connected}
              />
              <button
                className="nudge-btn"
                onClick={() => nudge(i, joint.ch, 1)}
                disabled={!connected}
                aria-label={`Increase ${joint.label}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="center-btn" onClick={centerAll} disabled={!connected}>
        Center all (90°)
      </button>
    </div>
  );
}
