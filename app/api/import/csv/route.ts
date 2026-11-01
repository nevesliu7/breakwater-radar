import { NextRequest, NextResponse } from "next/server";

import { isCsvImportKind, parseCsvImport } from "@/lib/importers";
import { replaceAssetGroup } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type");
    if (!isCsvImportKind(type)) {
      return NextResponse.json({ error: "Unsupported CSV import type." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }

    const parsed = parseCsvImport(type, await file.text());
    const workspace = await replaceAssetGroup(parsed.key, parsed.rows);
    return NextResponse.json({
      message: `Imported ${parsed.rows.length} ${parsed.key}.`,
      workspace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CSV import failed." },
      { status: 400 },
    );
  }
}
