import React, { useState, useEffect, useCallback } from "react";

interface Analysis {
  id: string;
  subject: string;
  verdict: "green" | "amber" | "red";
  reason: string;
  flags: string[];
  sent_anyway: boolean;
  created_at: string;
}

interface Settings {
  enabled: boolean;
  backendUrl: string;
  userId: string | null;
}

interface HistoryData {
  recent: Analysis[];
  stats: {
    totalChecked: number;
    sentAnyway: number;
  };
}

const VERDICT_COLORS = {
  green: { dot: "#22c55e", bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)" },
  amber: { dot: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)" },
  red: { dot: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)" },
};

export const Popup: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    enabled: true,
    backendUrl: "http://localhost:3001",
    userId: null,
  });
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendInput, setBackendInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Load settings and history on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (result) => {
      if (result && !result.error) {
        setSettings(result);
        setBackendInput(result.backendUrl);
      }
    });

    chrome.runtime.sendMessage({ type: "GET_HISTORY" }, (result) => {
      if (result && !result.error) {
        setHistory(result);
      }
      setLoading(false);
    });
  }, []);

  const toggleEnabled = useCallback(() => {
    const newEnabled = !settings.enabled;
    chrome.runtime.sendMessage(
      { type: "SAVE_SETTINGS", settings: { enabled: newEnabled } },
      () => {
        setSettings((prev) => ({ ...prev, enabled: newEnabled }));
        setStatus(newEnabled ? "Extension enabled" : "Extension disabled");
        setTimeout(() => setStatus(null), 2000);
      }
    );
  }, [settings.enabled]);

  const saveBackendUrl = useCallback(() => {
    const url = backendInput.trim();
    if (!url) return;
    chrome.runtime.sendMessage(
      { type: "SAVE_SETTINGS", settings: { backendUrl: url } },
      () => {
        setSettings((prev) => ({ ...prev, backendUrl: url }));
        setShowUrlInput(false);
        setStatus("Backend URL saved");
        setTimeout(() => setStatus(null), 2000);
      }
    );
  }, [backendInput]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div style={{ padding: "16px", minHeight: "200px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
          >
            ✉
          </div>
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#f1f5f9",
                lineHeight: 1.2,
              }}
            >
              Before You Send
            </div>
            <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 500 }}>
              Gmail gut-check
            </div>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={toggleEnabled}
          style={{
            position: "relative",
            width: "40px",
            height: "22px",
            borderRadius: "11px",
            border: "none",
            cursor: "pointer",
            background: settings.enabled
              ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
              : "#334155",
            transition: "background 0.2s ease",
            padding: 0,
          }}
          title={settings.enabled ? "Disable" : "Enable"}
        >
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: settings.enabled ? "20px" : "2px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </button>
      </div>

      {/* Status message */}
      {status && (
        <div
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "#a78bfa",
            textAlign: "center",
            marginBottom: "12px",
            padding: "4px 8px",
            background: "rgba(139, 92, 246, 0.1)",
            borderRadius: "6px",
          }}
        >
          {status}
        </div>
      )}

      {/* Stats */}
      {history && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "10px",
              background: "rgba(99, 102, 241, 0.08)",
              borderRadius: "8px",
              border: "1px solid rgba(99, 102, 241, 0.15)",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#a78bfa",
                lineHeight: 1,
              }}
            >
              {history.stats.totalChecked}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "#64748b",
                fontWeight: 500,
                marginTop: "2px",
              }}
            >
              emails checked
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: "10px",
              background: "rgba(245, 158, 11, 0.08)",
              borderRadius: "8px",
              border: "1px solid rgba(245, 158, 11, 0.15)",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#f59e0b",
                lineHeight: 1,
              }}
            >
              {history.stats.sentAnyway}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "#64748b",
                fontWeight: 500,
                marginTop: "2px",
              }}
            >
              sent anyway
            </div>
          </div>
        </div>
      )}

      {/* Recent Analyses */}
      <div style={{ marginBottom: "12px" }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "8px",
          }}
        >
          Recent checks
        </div>

        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            Loading…
          </div>
        )}

        {!loading && (!history || history.recent.length === 0) && (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              fontSize: "12px",
              color: "#475569",
              background: "rgba(30, 41, 59, 0.5)",
              borderRadius: "8px",
              border: "1px solid #1e293b",
            }}
          >
            No emails checked yet.
            <br />
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              Compose an email in Gmail to get started.
            </span>
          </div>
        )}

        {history &&
          history.recent.map((analysis) => {
            const colors = VERDICT_COLORS[analysis.verdict];
            return (
              <div
                key={analysis.id}
                style={{
                  padding: "8px 10px",
                  marginBottom: "6px",
                  background: colors.bg,
                  borderRadius: "6px",
                  border: `1px solid ${colors.border}`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: colors.dot,
                    flexShrink: 0,
                    marginTop: "4px",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#e2e8f0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {analysis.subject}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                      marginTop: "2px",
                      lineHeight: 1.3,
                    }}
                  >
                    {analysis.reason}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginTop: "4px",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "#475569" }}>
                      {formatTime(analysis.created_at)}
                    </span>
                    {analysis.sent_anyway && (
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 600,
                          color: "#f59e0b",
                          background: "rgba(245, 158, 11, 0.1)",
                          padding: "1px 4px",
                          borderRadius: "3px",
                        }}
                      >
                        sent anyway
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Backend URL Config */}
      <div
        style={{
          borderTop: "1px solid #1e293b",
          paddingTop: "12px",
        }}
      >
        <button
          onClick={() => setShowUrlInput(!showUrlInput)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#64748b",
            fontSize: "11px",
            fontWeight: 500,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          <span>Backend URL</span>
          <span
            style={{
              transform: showUrlInput ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
              fontSize: "10px",
            }}
          >
            ▼
          </span>
        </button>

        {showUrlInput && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              marginTop: "6px",
            }}
          >
            <input
              type="text"
              value={backendInput}
              onChange={(e) => setBackendInput(e.target.value)}
              placeholder="http://localhost:3001"
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "11px",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#e2e8f0",
                outline: "none",
                fontFamily: "'Inter', monospace",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "#6366f1")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "#334155")
              }
            />
            <button
              onClick={saveBackendUrl}
              style={{
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: 600,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "12px",
          textAlign: "center",
          fontSize: "9px",
          color: "#334155",
          fontWeight: 500,
        }}
      >
        Before You Send v1.0.0
      </div>
    </div>
  );
};
