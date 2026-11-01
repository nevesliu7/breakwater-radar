import { NextResponse } from "next/server";

import { getWorkspaceView } from "@/lib/store";

export async function GET() {
  try {
    const workspace = await getWorkspaceView();
    return NextResponse.json({ workspace });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read workspace." },
      { status: 500 },
    );
  }
}
