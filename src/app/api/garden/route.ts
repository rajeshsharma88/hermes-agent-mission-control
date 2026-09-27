import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Garden data now lives in our own Postgres (DataStore table) instead of
// the old shared jsonblob.com blob, which started returning Cloudflare
// bot-protection HTML instead of JSON (breaking this route with a 500).
// One row, keyed "garden", holds the whole blob — same shape the UI
// already expects, so src/app/garden/page.tsx needed no changes.
const GARDEN_KEY = "garden";

interface Plant {
  id: string;
  name: string;
  emoji: string;
  location: "indoor" | "outdoor";
  waterSchedule: string;
  waterDays: number[];
  img?: string;
  tip?: string;
  addedBy?: string;
  addedAt?: string;
}

interface GardenBlob {
  version: number;
  lastUpdated: string;
  plants: Plant[];
}

const EMPTY_GARDEN: GardenBlob = {
  version: 1,
  lastUpdated: new Date(0).toISOString(),
  plants: [],
};

export async function GET() {
  try {
    const row = await prisma.dataStore.findUnique({ where: { key: GARDEN_KEY } });
    const data = (row?.data as unknown as GardenBlob) || EMPTY_GARDEN;
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (e) {
    console.error("Garden GET error:", e);
    return NextResponse.json({ error: "Failed to fetch garden" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const payload: GardenBlob = {
      version: typeof body?.version === "number" ? body.version : 1,
      lastUpdated: new Date().toISOString(),
      plants: Array.isArray(body?.plants) ? body.plants : [],
    };

    // Prisma's Json field wants InputJsonValue, which requires an index
    // signature our plain GardenBlob interface doesn't have — the shape
    // is still plain JSON, so this cast is safe.
    const jsonPayload = payload as unknown as Prisma.InputJsonValue;

    await prisma.dataStore.upsert({
      where: { key: GARDEN_KEY },
      update: { data: jsonPayload },
      create: { key: GARDEN_KEY, data: jsonPayload },
    });

    return NextResponse.json({ ok: true, garden: payload });
  } catch (e) {
    console.error("Garden PUT error:", e);
    return NextResponse.json({ error: "Failed to update garden" }, { status: 500 });
  }
}
