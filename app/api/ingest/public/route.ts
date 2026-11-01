import { NextResponse } from "next/server";

import { runPublicSourceIngest } from "@/lib/store";

export async function POST() {
  try {
    const { workspace, result } = await runPublicSourceIngest();
    return NextResponse.json({
      message: "Public sources pulled into the backend workspace.",
      workspace,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Public source ingest failed." },
      { status: 502 },
    );
  }
}
