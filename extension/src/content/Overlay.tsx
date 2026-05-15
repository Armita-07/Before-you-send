import React, { useState, useEffect, useCallback, useRef } from "react";

export type Verdict = "green" | "amber" | "red";

export interface AnalysisResult {
  verdict: Verdict;
  reason: string;
  flags: string[];
  analysisId?: string | null;
}

export type OverlayState =
  | { type: "loading" }
  | { type: "result"; data: AnalysisResult }
  | { type: "error"; message: string };

interface OverlayProps {
  state: OverlayState;
  onSendAnyway: () => void;
  onEditFirst: () => void;
  onDismiss: () => void;
}

const VERDICT_CONFIG = {
  green: {
    border: "#22c55e",
    bg: "rgba(34, 197, 94, 0.08)",
    iconBg: "rgba(34, 197, 94, 0.15)",
    label: "Good to go",
    icon: "✓",
  },
  amber: {
    border: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.08)",
    iconBg: "rgba(245, 158, 11, 0.15)",
    label: "Worth a second look",
    icon: "⚠",
  },
  red: {
    border: "#ef4444",
    bg: "rgba(239, 68, 68, 0.08)",
    iconBg: "rgba(239, 68, 68, 0.15)",
    label: "Think twice",
    icon: "✕",
  },
};

const AUTO_DISMISS_MS = 3000;

export const Overlay: React.FC<OverlayProps> = ({
  state,
  onSendAnyway,
  onEditFirst,
  onDismiss,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Auto-dismiss countdown for green verdicts
  useEffect(() => {
    if (state.type === "result" && state.data.verdict === "green") {
      startTimeRef.current = Date.now();
      setCountdown(AUTO_DISMISS_MS);

      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = AUTO_DISMISS_MS - elapsed;
        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          onSendAnyway();
        } else {
          setCountdown(remaining);
        }
      }, 50);

      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }

    // Auto-dismiss for error state too (fail open)
    if (state.type === "error") {
      startTimeRef.current = Date.now();
      setCountdown(AUTO_DISMISS_MS);

      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = AUTO_DISMISS_MS - elapsed;
        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          onSendAnyway();
        } else {
          setCountdown(remaining);
        }
      }, 50);

      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [state, onSendAnyway]);

  const handleSendAnyway = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    onSendAnyway();
  }, [onSendAnyway]);

  const handleEditFirst = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    onEditFirst();
  }, [onEditFirst]);

  const progressPercent =
    countdown !== null ? (countdown / AUTO_DISMISS_MS) * 100 : 100;

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        position: "relative",
        zIndex: 9999,
        width: "100%",
        animation: "slideDown 0.25s ease-out",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes slideDown {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .bys-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'Inter', system-ui, sans-serif;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
          line-height: 1.4;
        }
        .bys-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .bys-btn:active {
          transform: translateY(0);
        }
        .bys-btn-send {
          background: #374151;
          color: #fff;
        }
        .bys-btn-send:hover {
          background: #1f2937;
        }
        .bys-btn-edit {
          background: #f3f4f6;
          color: #374151;
        }
        .bys-btn-edit:hover {
          background: #e5e7eb;
        }
      `}</style>

      {/* Loading State */}
      {state.type === "loading" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            background: "rgba(59, 130, 246, 0.06)",
            borderLeft: "3px solid #3b82f6",
            borderRadius: "0 8px 8px 0",
            fontSize: "13px",
            color: "#374151",
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              border: "2px solid #93c5fd",
              borderTopColor: "#3b82f6",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              animation: "pulseSoft 1.5s ease-in-out infinite",
              fontWeight: 500,
            }}
          >
            Checking your email…
          </span>
        </div>
      )}

      {/* Error State (fail open) */}
      {state.type === "error" && (
        <div
          style={{
            padding: "10px 14px",
            background: VERDICT_CONFIG.amber.bg,
            borderLeft: `3px solid ${VERDICT_CONFIG.amber.border}`,
            borderRadius: "0 8px 8px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flex: 1,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: VERDICT_CONFIG.amber.iconBg,
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                ⚠
              </span>
              <span style={{ fontSize: "13px", color: "#374151", fontWeight: 500 }}>
                {state.message}
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <button className="bys-btn bys-btn-edit" onClick={handleEditFirst}>
                Edit
              </button>
              <button className="bys-btn bys-btn-send" onClick={handleSendAnyway}>
                Send
              </button>
            </div>
          </div>
          {countdown !== null && (
            <div
              style={{
                marginTop: "6px",
                height: "2px",
                background: "rgba(245, 158, 11, 0.15)",
                borderRadius: "1px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: VERDICT_CONFIG.amber.border,
                  borderRadius: "1px",
                  transition: "width 50ms linear",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Result State */}
      {state.type === "result" && (() => {
        const config = VERDICT_CONFIG[state.data.verdict];
        return (
          <div
            style={{
              padding: "10px 14px",
              background: config.bg,
              borderLeft: `3px solid ${config.border}`,
              borderRadius: "0 8px 8px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: config.iconBg,
                    fontSize: "12px",
                    fontWeight: 700,
                    color: config.border,
                    flexShrink: 0,
                  }}
                >
                  {config.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: config.border,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "1px",
                    }}
                  >
                    {config.label}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#374151",
                      fontWeight: 500,
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {state.data.reason}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                {state.data.verdict !== "green" && (
                  <button
                    className="bys-btn bys-btn-edit"
                    onClick={handleEditFirst}
                  >
                    Edit First
                  </button>
                )}
                <button
                  className="bys-btn bys-btn-send"
                  onClick={handleSendAnyway}
                >
                  {state.data.verdict === "green"
                    ? "Send"
                    : "Send Anyway"}
                </button>
              </div>
            </div>

            {/* Flags */}
            {state.data.flags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  marginTop: "6px",
                  flexWrap: "wrap",
                }}
              >
                {state.data.flags.map((flag) => (
                  <span
                    key={flag}
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: `${config.border}18`,
                      color: config.border,
                      textTransform: "capitalize",
                    }}
                  >
                    {flag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}

            {/* Countdown progress bar (green auto-send) */}
            {countdown !== null && (
              <div
                style={{
                  marginTop: "6px",
                  height: "2px",
                  background: `${config.border}20`,
                  borderRadius: "1px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: config.border,
                    borderRadius: "1px",
                    transition: "width 50ms linear",
                  }}
                />
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
