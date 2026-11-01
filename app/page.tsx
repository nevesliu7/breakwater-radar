import { ControlCenter } from "@/components/control-center";
import { getWorkspaceView } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workspace = await getWorkspaceView();
  return <ControlCenter initialWorkspace={workspace} />;
}
