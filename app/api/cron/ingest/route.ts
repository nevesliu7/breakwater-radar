import { NextRequest, NextResponse } from "next/server";

import { runPublicSourceIngest } from "@/lib/store";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.BREAKWATER_CRON_SECRET;

  if (!secret) {
    return true;
  }

  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearerToken === secret || request.nextUrl.searchParams.get("secret") === secret;
}

async function handleCronIngest(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    const { workspace, result } = await runPublicSourceIngest();

    return NextResponse.json({
      message: "Scheduled public-source sync completed.",
      updatedAt: workspace.metadata.updatedAt,
      result: {
        added: result.added,
        skipped: result.skipped,
        fetched: result.fetched,
        sourceCounts: result.sourceCounts,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduled source sync failed." },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCronIngest(request);
}

export async function POST(request: NextRequest) {
  return handleCronIngest(request);
}
