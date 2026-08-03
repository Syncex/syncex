import { useEffect, useRef, useState } from "react";
import {
  Bluetooth,
  Brain,
  Radio,
  RotateCcw,
  Sparkles,
  Unplug,
  Waves,
} from "lucide-react";
import { connectToBluetooth } from "./bluetoothservice.js";
import { dbService } from "./dbService.js";
import "./Dashboard.css";

const MAX_LOG_LENGTH = 50;
const formatTime = (value) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const bytesToHex = (bytes) =>
  bytes?.length
    ? bytes
        .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
        .join(" ")
    : "—";

function normalizeState(payload) {
  if (!payload) {
    return null;
  }
  const value =
    payload.mentalState ?? payload.mental_state ?? payload.result ?? payload;
  return typeof value === "object"
    ? { ...value, timestamp: value.timestamp ?? Date.now() }
    : { state: String(value), timestamp: Date.now() };
}

function StateCard({ state }) {
  if (!state)
    return (
      <div className="empty-state">
        <span className="orb">
          <Brain size={28} />
        </span>
        <h3>Ready when you are</h3>
        <p>Your interpreted mood signals will appear here in real time.</p>
      </div>
    );
  const entries = Object.entries(state).filter(([key]) => key !== "timestamp");
  const primary =
    entries.find(([, value]) => typeof value === "string")?.[1] ??
    "Current reading";
  return (
    <div className="state-card">
      <div className="state-hero">
        <span className="state-icon">
          <Sparkles size={24} />
        </span>
        <div>
          <p className="label">Current state</p>
          <h3>{String(primary)}</h3>
          <p>Updated {formatTime(state.timestamp)}</p>
        </div>
      </div>
      <div className="metric-grid">
        {entries.map(([key, value]) => (
          <div className="metric" key={key}>
            <span>{key.replaceAll("_", " ")}</span>
            <strong>
              {typeof value === "number" ? value.toFixed(2) : String(value)}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function Dashboard() {
  const [status, setStatus] = useState("Ready to connect");
  const [device, setDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [rawPackets, setRawPackets] = useState([]);
  const [processedStates, setProcessedStates] = useState([]);
  const [error, setError] = useState("");
  const connectionRef = useRef(null);
  const processingRef = useRef(false);
  useEffect(() => () => connectionRef.current?.cleanup?.(), []);
  const processPacket = async (packet) => {
    setRawPackets((current) => [packet, ...current].slice(0, MAX_LOG_LENGTH));
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      const result = await dbService.getMentalState({ datapacket: packet });//this is the call to the backend
      const nextState = normalizeState(result);
      if (nextState) {
        setProcessedStates((current) =>
          [nextState, ...current].slice(0, MAX_LOG_LENGTH),
        );
        setError("");
      }
    } catch (packetError) {
      setError(packetError.message);
    } finally {
      processingRef.current = false;
    }
  };
  const disconnect = () => {
    connectionRef.current?.cleanup?.();
    if (connectionRef.current?.device?.gatt?.connected)
      connectionRef.current.device.gatt.disconnect();
    connectionRef.current = null;
    setDevice(null);
    setStatus("Ready to connect");
  };

  const connect = async () => {
    setIsConnecting(true);
    setError("");
    setStatus("Choose your MoodBuds");
    try {
      const connection = await connectToBluetooth(processPacket);
      connectionRef.current = connection;
      setDevice(connection.device);
      setStatus("Connected");
      connection.device.addEventListener(
        "gattserverdisconnected",
        () => {
          connectionRef.current = null;
          setDevice(null);
          setStatus("Connection lost");
        },
        { once: true },
      );
      if (connection.notificationCount === 0)
        setError(
          "Connected, but this device does not expose a notification stream.",
        );
    } catch (connectError) {
      setStatus("Ready to connect");
      if (connectError.name !== "NotFoundError") setError(connectError.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const isLive = Boolean(device);
  const latestPacket = rawPackets[0];
  return (
    <main className="dashboard-shell">
      <nav className="topbar">
        <div className="wordmark">
          <span className="logo-mark">
            <Waves size={19} />
          </span>
          MoodBuds
        </div>
        <span className="nav-label">Sensor dashboard</span>
        <button
          className={isLive ? "secondary-button" : "primary-button"}
          onClick={isLive ? disconnect : connect}
          disabled={isConnecting}
        >
          {isLive ? <Unplug size={17} /> : <Bluetooth size={17} />}
          {isConnecting ? "Connecting…" : isLive ? "Disconnect" : "Connect"}
        </button>
      </nav>

      <div className="dashboard-content">
        <header className="hero">
          <div>
            <p className="kicker">Live wellbeing insights</p>
            <h1>How are you feeling?</h1>
            <p>
              Connect your wearable and watch subtle signals become clear,
              private insights.
            </p>
          </div>
          <div className={`connection-pill ${isLive ? "live" : ""}`}>
            <i />
            {status}
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <section className="overview-grid">
          <article className="insight-panel">
            <div className="panel-heading">
              <div>
                <p className="label">Mindful insight</p>
                <h2>Your live state</h2>
              </div>
              <Brain size={20} />
            </div>
            <StateCard state={processedStates[0]} />
          </article>
          <aside className="summary-stack">
            <article className="summary-card">
              <span className="summary-icon blue">
                <Radio size={19} />
              </span>
              <div>
                <p>Packets received</p>
                <strong>{rawPackets.length}</strong>
                <span>this session</span>
              </div>
            </article>
            <article className="summary-card">
              <span className="summary-icon violet">
                <Sparkles size={19} />
              </span>
              <div>
                <p>Insights created</p>
                <strong>{processedStates.length}</strong>
                <span>this session</span>
              </div>
            </article>
            <article className="summary-card device-card">
              <div>
                <p>Connected device</p>
                <strong>{device?.name || "No device"}</strong>
                <span>
                  {device?.id ? `ID ${device.id}` : "Bluetooth is off"}
                </span>
              </div>
              <i className={isLive ? "active" : ""} />
            </article>
          </aside>
        </section>

        <section className="stream-panel">
          <div className="panel-heading">
            <div>
              <p className="label">Signal activity</p>
              <h2>Live sensor stream</h2>
            </div>
            <button
              className="icon-button"
              onClick={() => setRawPackets([])}
              disabled={!rawPackets.length}
            >
              <RotateCcw size={16} /> Clear
            </button>
          </div>
          {!rawPackets.length ? (
            <div className="stream-empty">
              <span>
                <Radio size={22} />
              </span>
              <div>
                <strong>No readings yet</strong>
                <p>
                  {isLive
                    ? "Listening for your first signal…"
                    : "Connect a device to begin."}
                </p>
              </div>
            </div>
          ) : (
            <div className="packet-list">
              {rawPackets.map((packet, index) => (
                <div className="packet" key={`${packet.timestamp}-${index}`}>
                  <span className="packet-index">
                    {String(rawPackets.length - index).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{packet.characteristicUuid}</strong>
                    <code>{bytesToHex(packet.bytes)}</code>
                  </div>
                  <time>{formatTime(packet.timestamp)}</time>
                </div>
              ))}
            </div>
          )}
          {latestPacket && (
            <div className="stream-footer">
              <span>
                <i className="live-dot" />
                Receiving live
              </span>
              <span>{latestPacket.bytes.length} bytes in latest packet</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
