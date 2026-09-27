"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import OfficeView from "@/components/OfficeView";

interface AgentActivity {
  timestamp: string;
  action: string;
  result?: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: "idle" | "working" | "error" | "offline";
  currentTask?: string;
  lastActive?: string;
  tasksCompleted: number;
  totalCost: number;
  recentActivity: AgentActivity[];
}

const statusConfig: Record<string, { color: string; dot: string; label: string; pulse?: boolean }> = {
  idle: { color: "var(--warn)", dot: "var(--warn)", label: "Idle" },
  working: { color: "var(--accent)", dot: "var(--accent)", label: "Working", pulse: true },
  error: { color: "var(--down)", dot: "var(--down)", label: "Error" },
  offline: { color: "var(--text-3)", dot: "var(--text-4)", label: "Offline" },
  online: { color: "var(--up)", dot: "var(--up)", label: "Online", pulse: true },
  active: { color: "var(--up)", dot: "var(--up)", label: "Active", pulse: true },
  mixed: { color: "var(--warn)", dot: "var(--warn)", label: "Partial" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function AgentCard({ agent, isExpanded, onToggle }: { agent: Agent; isExpanded: boolean; onToggle: () => void }) {
  const status = statusConfig[agent.status] || statusConfig.offline;

  return (
    <div className="panel panel-interactive overflow-hidden">
      {/* Main card */}
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-3.5">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-[var(--r-md)] flex items-center justify-center text-2xl shrink-0"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            {agent.emoji}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex w-2 h-2 shrink-0">
                {status.pulse && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: status.dot }} />}
                <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: status.dot }} />
              </span>
              <h3 className="text-[14px] font-semibold text-[var(--text)]">{agent.name}</h3>
              <span className="text-[10px] font-medium" style={{ color: status.color }}>{status.label}</span>
            </div>
            <p className="text-[12px] text-[var(--text-3)] mt-1">{agent.role}</p>

            {/* Current task */}
            {agent.currentTask && agent.status === "working" && (
              <p className="text-[12px] mt-2 truncate" style={{ color: "var(--accent)" }}>{agent.currentTask}</p>
            )}
          </div>

          {/* Stats */}
          <div className="text-right shrink-0">
            <div className="num text-[22px] font-semibold text-[var(--text)] leading-none">{agent.tasksCompleted}</div>
            <div className="eyebrow mt-1.5">tasks</div>
            {agent.lastActive && (
              <div className="num text-[10px] text-[var(--text-4)] mt-1">{timeAgo(agent.lastActive)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded activity feed */}
      {isExpanded && (
        <div className="px-5 py-4 space-y-2.5" style={{ borderTop: "1px solid var(--line)" }}>
          <h4 className="eyebrow">Recent Activity</h4>
          {agent.recentActivity.length === 0 ? (
            <p className="text-[12px] text-[var(--text-3)] py-2">No activity yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {agent.recentActivity.slice(0, 10).map((activity, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[12px]">
                  <span className="num text-[var(--text-4)] shrink-0 w-14">{timeAgo(activity.timestamp)}</span>
                  <span className="text-[var(--text-2)]">{activity.action}</span>
                  {activity.result && (
                    <span className="text-[var(--text-3)] ml-auto truncate max-w-[200px]">{activity.result}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Live Agent Chat ───────────────────────────────────────
function AgentChat({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<{ role: "user"|"assistant"; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMsgs = [...msgs, { role: "user" as const, content: text }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const r = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, message: text, history: msgs }),
      });
      const d = await r.json() as { reply: string };
      setMsgs([...newMsgs, { role: "assistant", content: d.reply }]);
    } catch {
      setMsgs([...newMsgs, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="elevated w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="text-2xl">{agent.emoji}</div>
          <div>
            <div className="text-[14px] font-semibold text-[var(--text)]">{agent.name}</div>
            <div className="text-[12px] text-[var(--text-3)]">{agent.role}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-[var(--text-3)] hover:text-[var(--text)] transition-colors text-xl leading-none">×</button>
        </div>
        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-3 flex flex-col" style={{ background: "var(--surface-1)" }}>
          {msgs.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[var(--text-3)] text-[13px] text-center">Ask {agent.name} anything.<br/>They&apos;re ready.</p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%] rounded-[var(--r-md)] px-3.5 py-2 text-[13px] leading-relaxed"
                style={m.role === "user"
                  ? { background: "var(--surface-3)", color: "var(--text)" }
                  : { background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text-2)" }}>
                {m.role === "assistant" && <span className="text-xs mr-1">{agent.emoji}</span>}
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-[var(--r-md)] px-3.5 py-2" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <span className="text-[var(--text-3)] text-[13px]">{agent.emoji} thinking…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        {/* Input */}
        <div className="flex gap-2 p-3" style={{ borderTop: "1px solid var(--line)" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={`Message ${agent.name}…`}
            className="flex-1 rounded-full px-4 py-2 text-[13px] text-[var(--text)] focus:outline-none transition-colors"
            style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="btn-primary px-4 py-2 text-[13px]"
          >Send</button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "office">("office");
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAgents();
    const interval = setInterval(loadAgents, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [loadAgents]);

  if (loading) {
    return (
      <div className="relative min-h-screen p-8">
        <div className="relative z-10 w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="sk h-32 rounded-[var(--r-lg)]" />)}
        </div>
      </div>
    );
  }

  const online = agents.filter(a => a.status !== "offline").length;
  const working = agents.filter(a => a.status === "working").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);

  return (
    <>
      <div className="relative z-10 w-full mx-auto text-[var(--text)] p-8 pb-16 space-y-8">
      {/* Header */}
      <div className="hq-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2.5">Agent HQ</div>
          <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">Your AI Team</h1>
          <p className="text-[13px] text-[var(--text-3)] mt-3">Working 24/7</p>
        </div>
        <div className="flex items-center gap-6">
          {/* Stats */}
          <div className="flex gap-7 text-center">
            <div>
              <div className="num text-[22px] font-semibold leading-none" style={{ color: "var(--up)" }}>{online}<span className="text-[var(--text-4)]">/{agents.length}</span></div>
              <div className="eyebrow mt-1.5">Online</div>
            </div>
            <div>
              <div className="num text-[22px] font-semibold leading-none" style={{ color: "var(--accent)" }}>{working}</div>
              <div className="eyebrow mt-1.5">Working</div>
            </div>
            <div>
              <div className="num text-[22px] font-semibold leading-none text-[var(--text)]">{totalTasks}</div>
              <div className="eyebrow mt-1.5">Total Tasks</div>
            </div>
          </div>
          {/* View toggle */}
          <div className="flex rounded-full p-1 gap-1" style={{ border: "1px solid var(--line)" }}>
            <button
              onClick={() => setView("office")}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                view === "office"
                  ? "bg-white/[0.08] text-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              Office
            </button>
            <button
              onClick={() => setView("cards")}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                view === "cards"
                  ? "bg-white/[0.08] text-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Live Agent Chat Modal */}
      {chatAgent && <AgentChat agent={chatAgent} onClose={() => setChatAgent(null)} />}

      {/* Office View */}
      {view === "office" && (
        <>
          <OfficeView agents={agents} />
          {/* Chat quick-launch strip */}
          <div className="flex flex-wrap gap-2 pt-2">
            {agents.map(a => (
              <button key={a.id} onClick={() => setChatAgent(a)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] text-[var(--text-2)] transition-colors panel-interactive"
                style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}>
                <span>{a.emoji}</span> Chat with {a.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Cards View */}
      {view === "cards" && (
        <>
          {/* Agent grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isExpanded={expandedAgent === agent.id}
                onToggle={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
              />
            ))}
          </div>

          {/* Org chart visual */}
          <div className="pt-6" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="eyebrow mb-5">Team Structure</div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-wrap justify-center gap-3">
                {agents.map(agent => (
                  <div key={agent.id} className="flex items-center gap-2.5 rounded-[var(--r-md)] px-3.5 py-2.5"
                    style={{ background: "var(--surface-1)", border: "1px solid var(--line)", opacity: agent.status === "offline" ? 0.5 : 1 }}>
                    <span className="text-lg">{agent.emoji}</span>
                    <div>
                      <div className="text-[12px] font-semibold text-[var(--text)]">{agent.name}</div>
                      <div className="text-[10px] text-[var(--text-3)]">{agent.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </>
  );
}
