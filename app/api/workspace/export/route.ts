import { readWorkspaceData } from "@/lib/store";

export async function GET() {
  const workspace = await readWorkspaceData();
  const body = JSON.stringify(workspace, null, 2);

  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="breakwater-workspace-${new Date().toISOString().slice(0, 10)}.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
