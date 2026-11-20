import { NextResponse } from "next/server";
import type { SponsorStatus } from "@/lib/contracts";
import { sieEnabled } from "@/lib/sie";
import { cogneeEnabled } from "@/lib/cognee";
import * as s2 from "@/lib/s2";
import { telegramEnabled } from "@/lib/telegram";
import { airbyteAuthConfigured, health } from "@/lib/airbyte";

export const dynamic = "force-dynamic";

export async function GET() {
  const status: SponsorStatus = {
    sie: sieEnabled(),
    cognee: cogneeEnabled(),
    singlestore: s2.s2Enabled() ? await s2.ping() : false,
    telegram: telegramEnabled(),
    airbyte: airbyteAuthConfigured() ? (await health()).ok : false,
  };
  return NextResponse.json(status);
}
