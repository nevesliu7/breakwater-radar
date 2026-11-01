import { NextResponse } from "next/server";
import { z } from "zod";

import { updateWorkspaceSettings } from "@/lib/store";

const settingsSchema = z.object({
  workspaceName: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(800),
});

export async function PATCH(request: Request) {
  try {
    const payload = settingsSchema.parse(await request.json());
    const workspace = await updateWorkspaceSettings(payload);
    return NextResponse.json({
      message: "Workspace settings saved.",
      workspace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workspace settings update failed." },
      { status: 400 },
    );
  }
}
