export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { syncComprasAnil } from "@/lib/sync/compras-anil";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  const secret = process.env.CRON_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await syncComprasAnil("2026-06-01");

  return NextResponse.json(result);
}
