import { NextResponse } from "next/server";
import { z } from "zod";

import { createManualAlert } from "@/lib/store";

const manualAlertSchema = z.object({
  board: z.enum(["natural-disasters", "social-policy"]),
  riskType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(600),
  severity: z.coerce.number().int().min(1).max(5),
  confidence: z.coerce.number().int().min(1).max(5),
  hoursToImpact: z.coerce.number().int().min(1).max(720),
  countries: z.array(z.string().trim().min(1)).max(12).default([]),
  states: z.array(z.string().trim().min(1)).max(30).default([]),
  cities: z.array(z.string().trim().min(1)).max(30).default([]),
  sourceLabel: z.string().trim().max(120).default("Manual source"),
  sourceUrl: z.string().trim().url().or(z.literal("")).default(""),
  actionTitle: z.string().trim().min(1).max(180),
  actionOwner: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  try {
    const payload = manualAlertSchema.parse(await request.json());
    const workspace = await createManualAlert(payload);
    return NextResponse.json({
      message: "Manual alert added to the backend workspace.",
      workspace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual alert creation failed." },
      { status: 400 },
    );
  }
}
