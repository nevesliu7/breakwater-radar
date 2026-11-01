import { NextResponse } from "next/server";
import { z } from "zod";

import { updateAlertActionStatus } from "@/lib/store";

const payloadSchema = z.object({
  alertId: z.string().min(1),
  actionIndex: z.number().int().nonnegative(),
  status: z.enum(["new", "in-progress", "done"]),
});

export async function PATCH(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    const workspace = await updateAlertActionStatus(payload);
    return NextResponse.json({
      message: `Marked action as ${payload.status}.`,
      workspace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action update failed." },
      { status: 400 },
    );
  }
}
