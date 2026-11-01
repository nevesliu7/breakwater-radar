import { NextResponse } from "next/server";

import { importWorkspaceData } from "@/lib/store";
import type { WorkspaceData } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const workspace = await importWorkspaceData((await request.json()) as WorkspaceData);
    return NextResponse.json({
      message: "Workspace JSON imported into the backend.",
      workspace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workspace import failed." },
      { status: 400 },
    );
  }
}
