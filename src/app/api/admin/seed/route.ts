import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { seedDatabase } from "../../../../../prisma/seed-data";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedDatabase(prisma);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
