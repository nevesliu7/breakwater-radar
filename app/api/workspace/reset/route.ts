import { NextResponse } from "next/server";

import { resetWorkspaceData } from "@/lib/store";

export async function POST() {
  try {
    const workspace = await resetWorkspaceData();
    return NextResponse.json({
      message: "Workspace reset to packaged demo data.",
      workspace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workspace reset failed." },
      { status: 500 },
    );
  }
}
