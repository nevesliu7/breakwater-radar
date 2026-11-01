import { NextResponse } from "next/server";

import { describeUploadedFile, saveDocumentUpload } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Document file is required." }, { status: 400 });
    }

    const kind = String(formData.get("kind") ?? "ops-note");
    const note = String(formData.get("note") ?? "");
    const tags = String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = file.type.startsWith("text/") ? buffer.toString("utf8") : null;
    const workspace = await saveDocumentUpload({
      name: file.name,
      kind,
      buffer,
      summary: describeUploadedFile(file.name, text, note),
      tags,
    });

    return NextResponse.json({
      message: `Uploaded ${file.name} to the backend document vault.`,
      workspace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document upload failed." },
      { status: 400 },
    );
  }
}
