import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import seedWorkspace from "@/data/workspace.json";
import { ingestPublicSources } from "@/lib/public-ingest";
import { buildWorkspaceView } from "@/lib/risk-engine";
import type {
  AssetCollectionKey,
  AuditEvent,
  DocumentRecord,
  AlertRecord,
  BoardId,
  WorkspaceData,
  WorkspaceView,
} from "@/lib/types";

const dataDirectory = path.join(process.cwd(), "data");
const workspacePath = path.join(dataDirectory, "workspace.json");
const uploadsDirectory = path.join(dataDirectory, "uploads");
let mutationQueue: Promise<unknown> = Promise.resolve();

export async function readWorkspaceData() {
  const raw = await fs.readFile(workspacePath, "utf8");
  const workspace = JSON.parse(raw) as WorkspaceData;
  workspace.auditTrail ??= [];
  return workspace;
}

export async function writeWorkspaceData(workspace: WorkspaceData) {
  await atomicWriteWorkspaceData(workspace);
}

async function atomicWriteWorkspaceData(workspace: WorkspaceData) {
  const serialized = `${JSON.stringify(workspace, null, 2)}\n`;

  await fs.mkdir(dataDirectory, { recursive: true });
  const temporaryPath = path.join(dataDirectory, `.workspace-${randomUUID()}.tmp`);
  await fs.writeFile(temporaryPath, serialized, "utf8");
  await fs.rename(temporaryPath, workspacePath);
}

async function mutateWorkspace<T>(
  mutator: (workspace: WorkspaceData) => Promise<T> | T,
) {
  let result: T;

  mutationQueue = mutationQueue.catch(() => undefined).then(async () => {
    const workspace = await readWorkspaceData();
    result = await mutator(workspace);
    await atomicWriteWorkspaceData(workspace);
  });

  await mutationQueue;
  return result!;
}

export async function getWorkspaceView() {
  return buildWorkspaceView(await readWorkspaceData());
}

export async function replaceAssetGroup<K extends AssetCollectionKey>(
  key: K,
  records: WorkspaceData["assets"][K],
) {
  return mutateWorkspace((workspace) => {
    workspace.assets[key] = records;
    appendAuditEvent(workspace, {
      type: "csv-import",
      actor: "local operator",
      summary: `Replaced ${key} with ${records.length} imported rows.`,
      details: {
        assetGroup: key,
        rows: records.length,
      },
    });
    workspace.metadata.updatedAt = new Date().toISOString();
    return buildWorkspaceView(workspace);
  });
}

function appendAuditEvent(
  workspace: WorkspaceData,
  event: Omit<AuditEvent, "id" | "createdAt">,
) {
  workspace.auditTrail ??= [];
  workspace.auditTrail.unshift({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...event,
  });
  workspace.auditTrail = workspace.auditTrail.slice(0, 80);
}

export async function saveDocumentUpload(input: {
  name: string;
  kind: string;
  buffer: Buffer;
  summary: string;
  tags: string[];
}) {
  return mutateWorkspace(async (workspace) => {
    await fs.mkdir(uploadsDirectory, { recursive: true });

    const safeName = input.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const storedName = `${Date.now()}-${safeName}`;
    const storedPath = path.join(uploadsDirectory, storedName);

    await fs.writeFile(storedPath, input.buffer);

    const document: DocumentRecord = {
      id: randomUUID(),
      name: input.name,
      kind: input.kind,
      summary: input.summary,
      tags: input.tags,
      uploadedAt: new Date().toISOString(),
      sizeBytes: input.buffer.byteLength,
      path: `data/uploads/${storedName}`,
    };

    workspace.documents.unshift(document);
    appendAuditEvent(workspace, {
      type: "document-upload",
      actor: "local operator",
      summary: `Uploaded ${input.name} to the document vault.`,
      details: {
        kind: input.kind,
        sizeBytes: input.buffer.byteLength,
      },
    });
    workspace.metadata.updatedAt = new Date().toISOString();

    return buildWorkspaceView(workspace);
  });
}

export async function updateAlertActionStatus(input: {
  alertId: string;
  actionIndex: number;
  status: "new" | "in-progress" | "done";
}) {
  return mutateWorkspace((workspace) => {
    const alert = workspace.alerts.find((candidate) => candidate.id === input.alertId);

    if (!alert) {
      throw new Error("Alert not found.");
    }

    const action = alert.actions[input.actionIndex];

    if (!action) {
      throw new Error("Action not found.");
    }

    action.status = input.status;
    appendAuditEvent(workspace, {
      type: "action-status",
      actor: "local operator",
      alertId: alert.id,
      summary: `Marked "${action.title}" as ${input.status}.`,
      details: {
        actionIndex: input.actionIndex,
        status: input.status,
        owner: action.owner,
      },
    });
    workspace.metadata.updatedAt = new Date().toISOString();

    return buildWorkspaceView(workspace);
  });
}

export async function runPublicSourceIngest() {
  const workspaceSnapshot = await readWorkspaceData();
  const result = await ingestPublicSources(workspaceSnapshot);
  let actualAdded = 0;
  let actualSkipped = 0;

  const workspace = await mutateWorkspace((currentWorkspace) => {
    const seen = new Set(currentWorkspace.alerts.map((alert) => alert.id));
    const incoming = result.incoming.filter((alert) => !seen.has(alert.id));
    actualAdded = incoming.length;
    actualSkipped = result.incoming.length - incoming.length;
    currentWorkspace.alerts = [...incoming, ...currentWorkspace.alerts];
    appendAuditEvent(currentWorkspace, {
      type: "public-ingest",
      actor: "system",
      summary: `Pulled ${result.fetched} public alerts and added ${actualAdded} new ones.`,
      details: {
        runId: result.runId,
        added: actualAdded,
        skipped: actualSkipped,
        noaa: result.sourceCounts.noaa,
        federalRegister: result.sourceCounts.federalRegister,
      },
    });
    currentWorkspace.metadata.updatedAt = new Date().toISOString();

    return buildWorkspaceView(currentWorkspace);
  });

  return {
    workspace,
    result: {
      ...result,
      added: actualAdded,
      skipped: actualSkipped,
    },
  };
}

export async function createManualAlert(input: {
  board: BoardId;
  riskType: string;
  title: string;
  summary: string;
  severity: number;
  confidence: number;
  hoursToImpact: number;
  countries: string[];
  states: string[];
  cities: string[];
  sourceLabel: string;
  sourceUrl: string;
  actionTitle: string;
  actionOwner: string;
}) {
  return mutateWorkspace((workspace) => {
    const now = new Date().toISOString();
    const alert: AlertRecord = {
      id: `manual-${randomUUID()}`,
      board: input.board,
      origin: "manual",
      riskType: input.riskType,
      title: input.title,
      summary: input.summary,
      severity: input.severity,
      confidence: input.confidence,
      hoursToImpact: input.hoursToImpact,
      detectedAt: now,
      locations: {
        countries: input.countries,
        states: input.states,
        cities: input.cities,
      },
      sourceLinks: input.sourceUrl
        ? [{ label: input.sourceLabel || "Manual source", url: input.sourceUrl }]
        : [],
      signals: [input.riskType, "manual operator input"],
      actions: [
        {
          title: input.actionTitle,
          owner: input.actionOwner,
          status: "new",
          rationale: "Added manually by an operator because the signal affects the operating map.",
        },
      ],
      watchNext: "Update this alert after the next supplier, platform, carrier, or policy confirmation.",
    };

    workspace.alerts.unshift(alert);
    appendAuditEvent(workspace, {
      type: "manual-alert",
      actor: "local operator",
      alertId: alert.id,
      summary: `Added manual alert: ${alert.title}.`,
      details: {
        board: alert.board,
        riskType: alert.riskType,
        severity: alert.severity,
        confidence: alert.confidence,
      },
    });
    workspace.metadata.updatedAt = now;
    return buildWorkspaceView(workspace);
  });
}

export async function updateWorkspaceSettings(input: {
  workspaceName: string;
  notes: string;
}) {
  return mutateWorkspace((workspace) => {
    workspace.metadata.workspaceName = input.workspaceName;
    workspace.metadata.notes = input.notes;
    workspace.metadata.mode = "server workspace";
    workspace.metadata.updatedAt = new Date().toISOString();
    appendAuditEvent(workspace, {
      type: "workspace-settings",
      actor: "local operator",
      summary: "Updated workspace settings.",
    });
    return buildWorkspaceView(workspace);
  });
}

export async function resetWorkspaceData() {
  return mutateWorkspace((workspace) => {
    const seed = structuredClone(seedWorkspace as WorkspaceData);
    Object.assign(workspace, seed);
    workspace.metadata.updatedAt = new Date().toISOString();
    workspace.metadata.mode = "server workspace";
    appendAuditEvent(workspace, {
      type: "workspace-reset",
      actor: "local operator",
      summary: "Reset workspace to the packaged demo data.",
    });
    return buildWorkspaceView(workspace);
  });
}

export async function importWorkspaceData(workspace: WorkspaceData) {
  if (!workspace.metadata || !workspace.assets || !Array.isArray(workspace.alerts)) {
    throw new Error("Invalid workspace JSON.");
  }

  return mutateWorkspace((currentWorkspace) => {
    Object.assign(currentWorkspace, workspace);
    currentWorkspace.auditTrail ??= [];
    currentWorkspace.metadata.updatedAt = new Date().toISOString();
    currentWorkspace.metadata.mode = "server workspace";
    appendAuditEvent(currentWorkspace, {
      type: "workspace-import",
      actor: "local operator",
      summary: "Imported a full workspace JSON backup.",
    });
    return buildWorkspaceView(currentWorkspace);
  });
}

export function describeUploadedFile(name: string, text: string | null, note: string) {
  if (note.trim()) {
    return note.trim();
  }

  if (text) {
    const compact = text.replace(/\s+/g, " ").trim();
    if (compact) {
      return compact.slice(0, 180);
    }
  }

  return `Uploaded ${name} for later risk and playbook context.`;
}
