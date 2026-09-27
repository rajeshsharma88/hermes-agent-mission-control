"use client";

import { useEffect, useState, useCallback } from "react";

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
  status: "idle" | "working" | "error" | "offline" | "online" | "active";
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
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-[var(--r-md)] flex items-center justify-center text-2xl shrink-0"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            {agent.emoji}
          </div>

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

            {agent.currentTask && agent.status === "working" && (
              <p className="text-[12px] mt-2 truncate" style={{ color: "var(--accent)" }}>{agent.currentTask}</p>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="num text-[22px] font-semibold text-[var(--text)] leading-none">{agent.tasksCompleted}</div>
            <div className="eyebrow mt-1.5">done</div>
            {agent.lastActive && (
              <div className="num text-[10px] text-[var(--text-4)] mt-1">{timeAgo(agent.lastActive)}</div>
            )}
          </div>
        </div>
      </div>

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

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

  const online = agents.filter((a) => a.status !== "offline").length;
  const working = agents.filter((a) => a.status === "working").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);

  return (
    <div className="relative z-10 w-full mx-auto text-[var(--text)] p-8 pb-16 space-y-8">
      {/* Header */}
      <div className="hq-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2.5">Agent HQ</div>
          <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">Your Hermes Profiles</h1>
          <p className="text-[13px] text-[var(--text-3)] mt-3">
            Live status for every configured Hermes profile · dispatch new work from the{" "}
            <a href="/hermes" className="underline hover:no-underline" style={{ color: "var(--accent)" }}>Hermes page</a>
          </p>
        </div>
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
            <div className="eyebrow mt-1.5">Tasks Done</div>
          </div>
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isExpanded={expandedAgent === agent.id}
            onToggle={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
          />
        ))}
      </div>
    </div>
  );
}
