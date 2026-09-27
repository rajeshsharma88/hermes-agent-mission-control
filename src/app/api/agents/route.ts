import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AgentActivity {
  timestamp: string;
  action: string;
  result?: string;
}

interface AgentOut {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: string;
  currentTask?: string;
  lastActive?: Date;
  tasksCompleted: number;
  totalCost: number;
  recentActivity: AgentActivity[];
}

// Real Hermes agent profiles (as configured on the VPS), used as a fallback
// roster before the hermes-bridge sidecar has synced live AgentState rows,
// and to fill in any profile the bridge hasn't reported on yet.
// NOTE: keep this in sync with PROFILE_META in hermes-bridge/bridge.mjs.
const DEFAULT_AGENTS: AgentOut[] = [
  { id: "default", name: "Default", emoji: "\u{1F9ED}", role: "General-purpose gateway" },
  { id: "dev", name: "Dev", emoji: "\u{1F6E0}️", role: "Engineering & tooling" },
  { id: "scout", name: "Scout", emoji: "\u{1F52D}", role: "Research & discovery" },
  { id: "scribe", name: "Scribe", emoji: "✍️", role: "Writing & documentation" },
  { id: "personal", name: "Personal", emoji: "\u{1F5C2}️", role: "Personal assistant" },
  { id: "reach", name: "Reach", emoji: "\u{1F4E3}", role: "Outreach & engagement" },
  { id: "mkt-copy", name: "Marketing · Copy", emoji: "\u{1F58A}️", role: "Ad & content copywriting" },
  { id: "mkt-ads", name: "Marketing · Ads", emoji: "\u{1F3AF}", role: "Paid ads (Meta/Google)" },
  { id: "mkt-lead", name: "Marketing · Leads", emoji: "\u{1F9F2}", role: "Lead qualification" },
  { id: "mkt-crm", name: "Marketing · CRM", emoji: "\u{1F5C3}️", role: "CRM & customer workflows" },
  { id: "mkt-analytics", name: "Marketing · Analytics", emoji: "\u{1F4CA}", role: "Performance analytics" },
  { id: "mkt-review", name: "Marketing · Review", emoji: "\u{1F9D0}", role: "QA & campaign review" },
  { id: "mkt-research", name: "Marketing · Research", emoji: "\u{1F9EA}", role: "Market & competitor research" },
  { id: "mkt-creative", name: "Marketing · Creative", emoji: "\u{1F3A8}", role: "Creative asset ideation" },
  { id: "seo-review", name: "SEO · Review", emoji: "\u{1F9D0}", role: "SEO audits & review" },
  { id: "seo-lead", name: "SEO · Leads", emoji: "\u{1F9F2}", role: "SEO-sourced lead capture" },
  { id: "seo-content", name: "SEO · Content", emoji: "\u{1F4DD}", role: "SEO content strategy" },
  { id: "seo-local", name: "SEO · Local", emoji: "\u{1F4CD}", role: "Local / Google Business SEO" },
  { id: "seo-links", name: "SEO · Links", emoji: "\u{1F517}", role: "Link building" },
  { id: "seo-technical", name: "SEO · Technical", emoji: "⚙️", role: "Technical SEO" },
  { id: "seo-analytics", name: "SEO · Analytics", emoji: "\u{1F4C8}", role: "SEO analytics & reporting" },
  { id: "seo-keywords", name: "SEO · Keywords", emoji: "\u{1F511}", role: "Keyword research" },
].map((a): AgentOut => ({
  ...a,
  status: "offline",
  tasksCompleted: 0,
  totalCost: 0,
  recentActivity: [],
}));

export async function GET() {
  try {
    const states = await prisma.agentState.findMany();
    const stateMap: Record<string, (typeof states)[number]> = {};
    for (const s of states) {
      stateMap[s.id] = s;
    }

    // Start from the known roster (as a fallback shape), then overlay any
    // live state the bridge has synced — including profiles not in the
    // static list below, so a newly-created Hermes profile still shows up.
    const byId = new Map<string, AgentOut>(DEFAULT_AGENTS.map((a) => [a.id, a]));
    for (const s of states) {
      if (!byId.has(s.id)) {
        byId.set(s.id, {
          id: s.id,
          name: s.name,
          emoji: s.emoji || "\u{1F916}",
          role: s.role || "Hermes profile",
          status: "offline",
          tasksCompleted: 0,
          totalCost: 0,
          recentActivity: [],
        });
      }
    }

    const agents: AgentOut[] = [...byId.values()].map((agent) => {
      const s = stateMap[agent.id];
      if (!s) return agent;
      return {
        ...agent,
        name: s.name || agent.name,
        emoji: s.emoji || agent.emoji,
        role: s.role || agent.role,
        status: s.status || agent.status,
        currentTask: s.currentTask || undefined,
        lastActive: s.lastActive || undefined,
        tasksCompleted: s.tasksCompleted ?? agent.tasksCompleted,
        totalCost: s.totalCost ?? agent.totalCost,
        recentActivity: (s.recentActivity as unknown as AgentActivity[] | null) || agent.recentActivity,
      };
    });

    // Most recently active first, offline/never-active profiles last.
    agents.sort((a, b) => {
      const at = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const bt = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      return bt - at;
    });

    return NextResponse.json(agents, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Agents API error:", error);
    return NextResponse.json(DEFAULT_AGENTS, { status: 200 });
  }
}

// POST to manually update an agent's state (kept for compatibility; the
// hermes-bridge sidecar is the normal writer of this table now).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, action, status, currentTask } = body;

    if (!agentId) {
      return NextResponse.json({ error: "agentId required" }, { status: 400 });
    }

    const defaultAgent = DEFAULT_AGENTS.find((a) => a.id === agentId);
    const existing = await prisma.agentState.findUnique({ where: { id: agentId } });

    const recentActivity = (existing?.recentActivity as any[]) || [];
    const newRecentActivity = action
      ? [
          { timestamp: new Date().toISOString(), action },
          ...recentActivity.slice(0, 19),
        ]
      : recentActivity;

    const updatedState = await prisma.agentState.upsert({
      where: { id: agentId },
      update: {
        ...(status ? { status } : {}),
        ...(currentTask !== undefined ? { currentTask } : {}),
        lastActive: new Date(),
        ...(action
          ? {
              recentActivity: newRecentActivity,
              tasksCompleted: (existing?.tasksCompleted || 0) + 1,
            }
          : {}),
      },
      create: {
        id: agentId,
        name: defaultAgent?.name || agentId,
        emoji: defaultAgent?.emoji,
        role: defaultAgent?.role,
        status: status || "idle",
        currentTask: currentTask || null,
        lastActive: new Date(),
        tasksCompleted: action ? 1 : 0,
        totalCost: 0,
        recentActivity: newRecentActivity,
      },
    });

    return NextResponse.json({ ok: true, agent: updatedState });
  } catch (error) {
    console.error("Agent update error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}