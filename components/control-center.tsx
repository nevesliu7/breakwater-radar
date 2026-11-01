"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CloudSun,
  Database,
  FileDown,
  FileJson,
  FileText,
  Globe2,
  Landmark,
  ListChecks,
  MapPinned,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { startTransition, useDeferredValue, useState } from "react";

import {
  boardLabels,
  type ActionStatus,
  type AlertStatus,
  type BoardId,
  type EnrichedAlert,
  type ImpactFilterKey,
  type Sku,
  type WorkspaceView,
} from "@/lib/types";

const templateDefinitions = [
  {
    kind: "facilities",
    label: "Facilities",
    fileName: "facilities.csv",
    description: "Warehouses, 3PLs, origin hubs, and returns nodes.",
    columns: ["country", "state", "city", "criticality"],
  },
  {
    kind: "lanes",
    label: "Lanes",
    fileName: "lanes.csv",
    description: "Origins, destinations, and service expectations for each operating lane.",
    columns: ["origin_country", "destination_state", "mode", "sla"],
  },
  {
    kind: "skus",
    label: "SKUs",
    fileName: "skus.csv",
    description: "Margin-sensitive inventory and the channels each item touches.",
    columns: ["origin_country", "hts_code", "category", "alternate_origins"],
  },
  {
    kind: "storefronts",
    label: "Storefronts",
    fileName: "storefronts.csv",
    description: "Channels, marketplaces, and region-specific customer promises.",
    columns: ["platform", "market", "city", "criticality"],
  },
  {
    kind: "workforce_locations",
    label: "Workforce",
    fileName: "workforce_locations.csv",
    description: "Teams that need state-aware operating and compliance playbooks.",
    columns: ["team_name", "state", "employees", "criticality"],
  },
] as const;

const statusOptions: Array<{ value: "all" | AlertStatus; label: string }> = [
  { value: "all", label: "All status levels" },
  { value: "critical", label: "Critical only" },
  { value: "high", label: "High and above" },
  { value: "elevated", label: "Elevated and above" },
  { value: "watch", label: "Watch only" },
];

const urgencyOptions = [
  { value: "all", label: "All time windows" },
  { value: "12", label: "0-12 hours" },
  { value: "24", label: "0-24 hours" },
  { value: "48", label: "0-48 hours" },
  { value: "later", label: "Beyond 48 hours" },
] as const;

const impactOptions: Array<{ value: "all" | ImpactFilterKey; label: string }> = [
  { value: "all", label: "All exposed assets" },
  { value: "facilities", label: "Facilities" },
  { value: "lanes", label: "Lanes" },
  { value: "skus", label: "SKUs" },
  { value: "storefronts", label: "Storefronts" },
  { value: "workforceLocations", label: "Workforce" },
];

const actionStatusOptions: ActionStatus[] = ["new", "in-progress", "done"];

type FeedbackTone = "neutral" | "success" | "error";
type AlertStatusFilter = "all" | AlertStatus;
type UrgencyFilter = (typeof urgencyOptions)[number]["value"];
type ImpactSelection = "all" | ImpactFilterKey;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatStatus(status: string) {
  return status.replace("-", " ");
}

function boardStyle(board: BoardId) {
  return board === "natural-disasters" ? "tone-aqua" : "tone-saffron";
}

function statusStyle(status: string) {
  return `status-${status}`;
}

function originLabel(origin: EnrichedAlert["origin"]) {
  if (origin === "public-ingest") {
    return "Live source";
  }

  if (origin === "manual") {
    return "Manual";
  }

  return "Seeded";
}

function readinessStyle(score: number) {
  if (score >= 85) {
    return "readiness-strong";
  }

  if (score >= 65) {
    return "readiness-mid";
  }

  return "readiness-low";
}

function urgencyMatches(filter: UrgencyFilter, hoursToImpact: number) {
  switch (filter) {
    case "12":
      return hoursToImpact <= 12;
    case "24":
      return hoursToImpact <= 24;
    case "48":
      return hoursToImpact <= 48;
    case "later":
      return hoursToImpact > 48;
    default:
      return true;
  }
}

function statusMatches(filter: AlertStatusFilter, alert: EnrichedAlert) {
  if (filter === "all") {
    return true;
  }

  const ranking: Record<AlertStatus, number> = {
    watch: 1,
    elevated: 2,
    high: 3,
    critical: 4,
  };

  if (filter === "watch") {
    return alert.status === "watch";
  }

  return ranking[alert.status] >= ranking[filter];
}

function impactMatches(filter: ImpactSelection, alert: EnrichedAlert) {
  if (filter === "all") {
    return true;
  }

  return alert.impact[filter].total > 0;
}

function textIncludesAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms
    .map((term) => term.trim())
    .filter(Boolean)
    .some((term) => normalized.includes(term.toLowerCase()));
}

function buildTariffImpactRows(alert: EnrichedAlert | null, skus: Sku[]) {
  if (!alert || alert.board !== "social-policy") {
    return [];
  }

  const alertText = [
    alert.riskType,
    alert.title,
    alert.summary,
    ...alert.signals,
    ...alert.locations.countries,
    ...alert.locations.states,
  ].join(" ");
  const isTradeSignal = textIncludesAny(alertText, [
    "tariff",
    "customs",
    "import",
    "trade",
    "duty",
    "de minimis",
    "section 338",
    "cusma",
    "usmca",
  ]);

  if (!isTradeSignal) {
    return [];
  }

  const affectedLocations = [
    ...alert.locations.countries,
    ...alert.locations.states,
    "United States",
  ].map((location) => location.toLowerCase());
  const foreignPolicyCountries = alert.locations.countries
    .filter((country) => !textIncludesAny(country, ["United States", "US", "USA", "U.S."]))
    .map((country) => country.toLowerCase());

  return skus
    .filter((sku) => {
      const skuText = [
        sku.name,
        sku.originCountry,
        sku.primaryMarket,
        sku.category,
        sku.htsCode,
        sku.marginBand,
        ...sku.channels,
      ].join(" ");

      if (foreignPolicyCountries.length > 0) {
        return foreignPolicyCountries.includes(sku.originCountry.toLowerCase());
      }

      return (
        affectedLocations.includes(sku.originCountry.toLowerCase()) ||
        affectedLocations.includes(sku.primaryMarket.toLowerCase()) ||
        textIncludesAny(alertText, [sku.originCountry, sku.primaryMarket, sku.category ?? ""]) ||
        textIncludesAny(skuText, ["tariff", "duty", "customs"])
      );
    })
    .map((sku) => ({
      product: sku.name,
      category: sku.category ?? "Unclassified",
      origin: sku.originCountry,
      htsCode: sku.htsCode ?? "Add HTS",
      userSegments: sku.userSegments?.length ? sku.userSegments.join(", ") : sku.channels.join(", "),
      alternatives: sku.alternateOrigins?.length ? sku.alternateOrigins.join(", ") : "Add alternatives",
      action:
        sku.marginBand === "thin"
          ? "Requote, pause promos, or source-test"
          : "Check landed cost before next PO",
    }));
}

export function ControlCenter({
  initialWorkspace,
}: {
  initialWorkspace: WorkspaceView;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedBoard, setSelectedBoard] = useState<BoardId>("natural-disasters");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(
    initialWorkspace.boards["natural-disasters"].alerts[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [impactFilter, setImpactFilter] = useState<ImpactSelection>("all");
  const [feedback, setFeedback] = useState<{
    tone: FeedbackTone;
    message: string;
  }>({
    tone: "neutral",
    message: "Backend saved · manual/cron source sync.",
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [csvFiles, setCsvFiles] = useState<Record<string, File | null>>({});
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState("playbook");
  const [documentNote, setDocumentNote] = useState("");
  const [documentTags, setDocumentTags] = useState("");
  const [workspaceImportFile, setWorkspaceImportFile] = useState<File | null>(null);
  const [workspaceName, setWorkspaceName] = useState(workspace.metadata.workspaceName);
  const [workspaceNotes, setWorkspaceNotes] = useState(workspace.metadata.notes ?? "");
  const [manualAlert, setManualAlert] = useState({
    board: "social-policy" as BoardId,
    riskType: "trade policy",
    title: "",
    summary: "",
    severity: 3,
    confidence: 3,
    hoursToImpact: 24,
    countries: "United States",
    states: "",
    cities: "",
    sourceLabel: "",
    sourceUrl: "",
    actionTitle: "",
    actionOwner: "Operations lead",
  });

  const deferredSearch = useDeferredValue(search);
  const activeBoard = workspace.boards[selectedBoard];
  const filteredAlerts = activeBoard.alerts.filter((alert) => {
    const query = deferredSearch.trim().toLowerCase();
    const queryMatches =
      query.length === 0 ||
      alert.title.toLowerCase().includes(query) ||
      alert.summary.toLowerCase().includes(query) ||
      alert.riskType.toLowerCase().includes(query);

    return (
      queryMatches &&
      statusMatches(statusFilter, alert) &&
      urgencyMatches(urgencyFilter, alert.hoursToImpact) &&
      impactMatches(impactFilter, alert)
    );
  });

  const selectedAlert =
    filteredAlerts.find((alert) => alert.id === selectedAlertId) ??
    filteredAlerts[0] ??
    activeBoard.alerts[0] ??
    null;
  const lastPublicIngest = workspace.auditTrail.find((event) => event.type === "public-ingest");
  const tariffImpactRows = buildTariffImpactRows(selectedAlert, workspace.assets.skus);

  function syncWorkspaceView(
    nextWorkspace: WorkspaceView,
    board: BoardId,
    preferredAlertId: string | null = null,
  ) {
    const boardAlerts = nextWorkspace.boards[board].alerts;
    const fallbackBoard: BoardId =
      boardAlerts.length > 0 ? board : nextWorkspace.boards["natural-disasters"].alerts.length > 0
        ? "natural-disasters"
        : "social-policy";

    const nextAlert =
      nextWorkspace.boards[fallbackBoard].alerts.find(
        (alert) => alert.id === preferredAlertId,
      ) ?? nextWorkspace.boards[fallbackBoard].alerts[0] ?? null;

    setSelectedBoard(fallbackBoard);
    setSelectedAlertId(nextAlert?.id ?? null);
    setWorkspace(nextWorkspace);
    setWorkspaceName(nextWorkspace.metadata.workspaceName);
    setWorkspaceNotes(nextWorkspace.metadata.notes ?? "");
  }

  async function parseApiResponse<T extends object>(response: Response) {
    const payload = (await response.json()) as T | { error: string };

    if (!response.ok || ("error" in payload && typeof payload.error === "string")) {
      throw new Error("error" in payload ? payload.error : "Request failed.");
    }

    return payload as T;
  }

  async function postFormData(url: string, formData: FormData) {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    return parseApiResponse<{ message: string; workspace: WorkspaceView }>(response);
  }

  async function postJson<T extends object>(url: string, body?: object) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    return parseApiResponse<T>(response);
  }

  async function patchJson(url: string, body: object) {
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseApiResponse<{ message: string; workspace: WorkspaceView }>(response);
  }

  async function refreshWorkspace() {
    setBusyKey("refresh");

    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const payload = await parseApiResponse<{ workspace: WorkspaceView }>(response);
      startTransition(() => syncWorkspaceView(payload.workspace, selectedBoard, selectedAlertId));
      setFeedback({ tone: "success", message: "Workspace refreshed from the backend." });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCsvUpload(kind: string) {
    const file = csvFiles[kind];
    if (!file) {
      setFeedback({
        tone: "error",
        message: `Pick a file for ${kind} before importing.`,
      });
      return;
    }

    setBusyKey(kind);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const payload = await postFormData(`/api/import/csv?type=${kind}`, formData);
      startTransition(() => syncWorkspaceView(payload.workspace, selectedBoard, selectedAlertId));
      setFeedback({
        tone: "success",
        message: payload.message,
      });
      setCsvFiles((current) => ({ ...current, [kind]: null }));
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "CSV import failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDocumentUpload() {
    if (!documentFile) {
      setFeedback({
        tone: "error",
        message: "Pick a supplemental file before uploading.",
      });
      return;
    }

    setBusyKey("document");

    try {
      const formData = new FormData();
      formData.append("file", documentFile);
      formData.append("kind", documentKind);
      formData.append("note", documentNote);
      formData.append("tags", documentTags);
      const payload = await postFormData("/api/import/document", formData);
      startTransition(() => syncWorkspaceView(payload.workspace, selectedBoard, selectedAlertId));
      setFeedback({
        tone: "success",
        message: payload.message,
      });
      setDocumentFile(null);
      setDocumentNote("");
      setDocumentTags("");
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Document upload failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handlePublicIngest() {
    setBusyKey("public-ingest");

    try {
      const payload = await postJson<{
        message: string;
        workspace: WorkspaceView;
        result: {
          added: number;
          skipped: number;
          sourceCounts: { noaa: number; federalRegister: number };
        };
      }>("/api/ingest/public");
      startTransition(() => syncWorkspaceView(payload.workspace, selectedBoard, selectedAlertId));
      setFeedback({
        tone: "success",
        message: `${payload.result.added} added · ${payload.result.skipped} skipped · NOAA ${payload.result.sourceCounts.noaa} · FR ${payload.result.sourceCounts.federalRegister}`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Public source ingest failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleActionStatusChange(
    alertId: string,
    actionIndex: number,
    nextStatus: ActionStatus,
  ) {
    const actionBusyKey = `action-${alertId}-${actionIndex}`;
    setBusyKey(actionBusyKey);

    try {
      const payload = await patchJson("/api/alerts/action-status", {
        alertId,
        actionIndex,
        status: nextStatus,
      });
      startTransition(() => syncWorkspaceView(payload.workspace, selectedBoard, alertId));
      setFeedback({
        tone: "success",
        message: `Marked action as ${formatStatus(nextStatus)}.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Action update failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleResetWorkspace() {
    setBusyKey("workspace-reset");

    try {
      const payload = await postJson<{ message: string; workspace: WorkspaceView }>(
        "/api/workspace/reset",
      );
      startTransition(() => syncWorkspaceView(payload.workspace, "natural-disasters", null));
      setFeedback({
        tone: "success",
        message: payload.message,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Workspace reset failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  function handleWorkspaceExport() {
    window.location.href = "/api/workspace/export";
    setFeedback({
      tone: "success",
      message: "Workspace export started from the backend.",
    });
  }

  async function handleWorkspaceImport() {
    if (!workspaceImportFile) {
      setFeedback({ tone: "error", message: "Pick a workspace JSON file first." });
      return;
    }

    setBusyKey("workspace-import");

    try {
      const nextWorkspaceData = JSON.parse(await workspaceImportFile.text()) as object;
      const payload = await postJson<{ message: string; workspace: WorkspaceView }>(
        "/api/workspace/import",
        nextWorkspaceData,
      );
      startTransition(() => syncWorkspaceView(payload.workspace, "natural-disasters", null));
      setWorkspaceImportFile(null);
      setFeedback({
        tone: "success",
        message: payload.message,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Workspace import failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleWorkspaceSettings() {
    setBusyKey("workspace-settings");

    try {
      const payload = await patchJson("/api/workspace/settings", {
        workspaceName,
        notes: workspaceNotes,
      });
      startTransition(() => syncWorkspaceView(payload.workspace, selectedBoard, selectedAlertId));
      setFeedback({ tone: "success", message: payload.message });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Workspace settings update failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  function splitLocations(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function handleManualAlertCreate() {
    setBusyKey("manual-alert");

    try {
      const payload = await postJson<{ message: string; workspace: WorkspaceView }>(
        "/api/alerts/manual",
        {
          ...manualAlert,
          countries: splitLocations(manualAlert.countries),
          states: splitLocations(manualAlert.states),
          cities: splitLocations(manualAlert.cities),
        },
      );
      startTransition(() => syncWorkspaceView(payload.workspace, manualAlert.board, null));
      setManualAlert((current) => ({
        ...current,
        title: "",
        summary: "",
        sourceLabel: "",
        sourceUrl: "",
        actionTitle: "",
      }));
      setFeedback({ tone: "success", message: payload.message });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Manual alert creation failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="app-frame">
      <aside className="app-sidebar" aria-label="Workspace navigation">
        <div className="sidebar-brand">
          <span className="brand-mark">B</span>
          <div>
            <strong>Breakwater Radar</strong>
            <p>{workspace.metadata.workspaceName}</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          <a href="#overview">Overview</a>
          <a href="#risks">Risks</a>
          <a href="#signals">Sources</a>
          <a href="#intake">Data</a>
          <a href="#settings">Workspace</a>
          <a href="#audit">Audit</a>
        </nav>
        <div className={clsx("feedback-banner", `feedback-${feedback.tone}`)}>
          {feedback.message}
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operations workspace</p>
            <h1>Risk radar for cross-border operators</h1>
            <div className="status-strip">
              <span>
                <Database size={14} />
                Updated {formatDate(workspace.metadata.updatedAt)}
              </span>
              <span>
                <Radio size={14} />
                Manual / cron sync
              </span>
              <span>
                <Clock3 size={14} />
                Sources {lastPublicIngest ? formatDate(lastPublicIngest.createdAt) : "not pulled"}
              </span>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="secondary-button"
              disabled={busyKey === "refresh"}
              onClick={() => void refreshWorkspace()}
              type="button"
            >
              <RefreshCw size={16} />
              {busyKey === "refresh" ? "Refreshing..." : "Refresh"}
            </button>
            <button
              className="secondary-button"
              disabled={busyKey === "public-ingest"}
              onClick={() => void handlePublicIngest()}
              type="button"
            >
              <Globe2 size={16} />
              {busyKey === "public-ingest" ? "Syncing..." : "Sync now"}
            </button>
            <button className="ghost-button" onClick={handleWorkspaceExport} type="button">
              <FileJson size={16} />
              Export
            </button>
          </div>
        </header>

        <section className="section-block" id="overview">
          <div className="section-header">
            <div>
              <p className="eyebrow">Overview</p>
              <h2>What needs attention now</h2>
            </div>
          </div>
          <div className="metric-grid">
            <article className="metric-card panel">
              <span className="metric-label">
                <AlertTriangle size={14} />
                Critical
              </span>
              <strong>{workspace.totals.criticalAlerts}</strong>
              <p>{workspace.totals.monitoredAlerts} signals</p>
            </article>
            <article className="metric-card panel">
              <span className="metric-label">
                <ListChecks size={14} />
                Actions
              </span>
              <strong>{workspace.totals.pendingActions}</strong>
              <p>{workspace.totals.doneActions} done</p>
            </article>
            <article className="metric-card panel">
              <span className="metric-label">
                <MapPinned size={14} />
                Assets
              </span>
              <strong>{workspace.totals.totalAssets}</strong>
              <p>{workspace.totals.coverageGroups} groups</p>
            </article>
            <article className="metric-card panel">
              <span className="metric-label">
                <ShieldCheck size={14} />
                Readiness
              </span>
              <strong>{workspace.readiness.score}</strong>
              <p>{workspace.readiness.label}</p>
            </article>
          </div>
          <div className="split-layout">
            <article className="panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Daily digest</p>
                  <h2>Priority queue</h2>
                </div>
              </div>
              <ol className="priority-list">
                {workspace.digest.priorities.map((alert) => (
                  <li key={alert.id}>
                    <div>
                      <strong>{alert.title}</strong>
                      <div className="compact-meta">
                        <span>{alert.riskType}</span>
                        <span>{alert.hoursToImpact}h</span>
                        <span>{alert.impact.totalAssets} assets</span>
                      </div>
                    </div>
                    <span className="score-pill">Score {alert.score}</span>
                  </li>
                ))}
              </ol>
            </article>
            <article className="panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Readiness</p>
                  <h2>Setup gaps</h2>
                </div>
              </div>
              <div className={clsx("readiness-score", readinessStyle(workspace.readiness.score))}>
                <span>{workspace.readiness.label}</span>
                <strong>{workspace.readiness.score}</strong>
              </div>
              <div className="coverage-list coverage-list--dense">
                <li>Mapped alerts: {workspace.readiness.mappedAlerts}</li>
                <li>Blind spots: {workspace.readiness.blindSpots}</li>
                <li>Documents: {workspace.totals.documents}</li>
                <li>Asset groups: {workspace.totals.coverageGroups}</li>
              </div>
              <ul className="simple-list">
                {workspace.readiness.suggestions.slice(0, 2).map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="section-block" id="risks">
          <div className="section-header board-header">
            <div>
              <p className="eyebrow">Risk board</p>
              <h2>Exposure and urgency</h2>
              <div className="summary-strip">
                <span>{activeBoard.alerts.length} alerts</span>
                <span>{filteredAlerts.length} shown</span>
                <span>{boardLabels[selectedBoard]}</span>
              </div>
            </div>
            <div className="board-controls">
              <div className="toggle-row" role="tablist" aria-label="Risk boards">
                {(Object.keys(boardLabels) as BoardId[]).map((boardId) => (
                  <button
                    className={clsx(
                      "toggle-button",
                      selectedBoard === boardId && "toggle-button--active",
                      boardStyle(boardId),
                    )}
                    key={boardId}
                    onClick={() => {
                      setSelectedBoard(boardId);
                      setSelectedAlertId(workspace.boards[boardId].alerts[0]?.id ?? null);
                    }}
                    type="button"
                  >
                    {boardLabels[boardId]}
                    <span>{workspace.boards[boardId].alerts.length}</span>
                  </button>
                ))}
              </div>
              <div className="filters-grid">
                <label className="search-field">
                  <span>Status</span>
                  <select
                    onChange={(event) => setStatusFilter(event.target.value as AlertStatusFilter)}
                    value={statusFilter}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="search-field">
                  <span>Urgency</span>
                  <select
                    onChange={(event) => setUrgencyFilter(event.target.value as UrgencyFilter)}
                    value={urgencyFilter}
                  >
                    {urgencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="search-field">
                  <span>Impact</span>
                  <select
                    onChange={(event) => setImpactFilter(event.target.value as ImpactSelection)}
                    value={impactFilter}
                  >
                    {impactOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="search-field search-field--wide">
                  <span>Search</span>
                  <input
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Storm, tariff, platform policy..."
                    type="search"
                    value={search}
                  />
                </label>
              </div>
              <p className="filter-caption">
                Showing {filteredAlerts.length} of {activeBoard.alerts.length} alerts.
              </p>
            </div>
          </div>

          <div className="board-grid">
          <aside className="alert-list">
            {filteredAlerts.map((alert) => (
              <button
                className={clsx(
                  "alert-card",
                  alert.id === selectedAlert?.id && "alert-card--active",
                )}
                key={alert.id}
                onClick={() => setSelectedAlertId(alert.id)}
                type="button"
              >
                <div className="alert-card__top">
                  <span className={clsx("status-pill", statusStyle(alert.status))}>
                    {formatStatus(alert.status)}
                  </span>
              <span className="score-pill">Score {alert.score}</span>
                </div>
                <h3>{alert.title}</h3>
                <div className="alert-card__meta">
                  <span>{alert.riskType}</span>
                  <span>{alert.hoursToImpact}h</span>
                  <span>{alert.impact.totalAssets} assets</span>
                </div>
              </button>
            ))}
            {filteredAlerts.length === 0 ? (
              <div className="empty-card">
                <strong>No alerts match this triage view.</strong>
                <p>Broaden the filters or switch boards.</p>
              </div>
            ) : null}
          </aside>

          <article className="alert-detail">
            {selectedAlert ? (
              <>
                <div className="detail-header">
                  <div>
                    <div className="tag-row">
                      <span className={clsx("status-pill", statusStyle(selectedAlert.status))}>
                        {formatStatus(selectedAlert.status)}
                      </span>
                      <span className={clsx("status-pill", boardStyle(selectedAlert.board))}>
                        {boardLabels[selectedAlert.board]}
                      </span>
                      <span className="status-pill status-origin">
                        {originLabel(selectedAlert.origin)}
                      </span>
                    </div>
                    <h3>{selectedAlert.title}</h3>
                    <p className="supporting-copy">{selectedAlert.summary}</p>
                  </div>
                  <div className="detail-score">
                    <span>Risk score</span>
                    <strong>{selectedAlert.score}</strong>
                  </div>
                </div>

                <div className="detail-grid">
                  <div className="detail-card">
                    <span className="detail-label">Watch window</span>
                    <strong>{selectedAlert.hoursToImpact} hours to impact</strong>
                    <p>Detected {formatDate(selectedAlert.detectedAt)}</p>
                  </div>
                  <div className="detail-card">
                    <span className="detail-label">Signals</span>
                    <div className="tag-row">
                      {selectedAlert.signals.map((signal) => (
                        <span className="data-tag" key={signal}>
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="impact-grid">
                  {(
                    [
                      ["Facilities", selectedAlert.impact.facilities],
                      ["Lanes", selectedAlert.impact.lanes],
                      ["SKUs", selectedAlert.impact.skus],
                      ["Storefronts", selectedAlert.impact.storefronts],
                      ["Workforce", selectedAlert.impact.workforceLocations],
                    ] as const
                  ).map(([label, group]) => (
                    <div className="impact-card" key={label}>
                      <div className="impact-card__head">
                        <strong>{label}</strong>
                        <span>{group.total}</span>
                      </div>
                      <p>{group.core} core assets</p>
                      <ul>
                        {group.names.length > 0 ? (
                          group.names.slice(0, 4).map((name) => <li key={name}>{name}</li>)
                        ) : (
                          <li>No direct matches</li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>

                {tariffImpactRows.length > 0 ? (
                  <div className="detail-card detail-card--stack tariff-matrix">
                    <div className="section-header source-control-header">
                      <div>
                        <span className="detail-label">Tariff impact matrix</span>
                        <h3>Affected goods, alternatives, and users</h3>
                      </div>
                      <span className="score-pill">{tariffImpactRows.length} SKU rows</span>
                    </div>
                    <div className="matrix-table" role="table" aria-label="Tariff impact matrix">
                      <div className="matrix-row matrix-row--head" role="row">
                        <span>Product</span>
                        <span>Origin</span>
                        <span>HTS / category</span>
                        <span>Users</span>
                        <span>Alternatives</span>
                        <span>Next move</span>
                      </div>
                      {tariffImpactRows.map((row) => (
                        <div className="matrix-row" key={`${row.product}-${row.origin}`} role="row">
                          <strong>{row.product}</strong>
                          <span>{row.origin}</span>
                          <span>
                            {row.htsCode} · {row.category}
                          </span>
                          <span>{row.userSegments}</span>
                          <span>{row.alternatives}</span>
                          <span>{row.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="detail-columns">
                  <div className="detail-card detail-card--stack">
                    <span className="detail-label">Action checklist</span>
                    <ul className="action-list">
                      {selectedAlert.actions.map((action, actionIndex) => {
                        const actionBusyKey = `action-${selectedAlert.id}-${actionIndex}`;
                        return (
                          <li key={`${selectedAlert.id}-${actionIndex}`}>
                            <div className="action-body">
                              <strong>{action.title}</strong>
                              <p>{action.rationale}</p>
                              <div className="action-footer">
                                <span>{action.owner}</span>
                                <span className={clsx("status-pill", statusStyle(action.status))}>
                                  {formatStatus(action.status)}
                                </span>
                              </div>
                            </div>
                            <div className="action-controls">
                              {actionStatusOptions.map((status) => (
                                <button
                                  className={clsx(
                                    "action-status-button",
                                    action.status === status && "action-status-button--active",
                                  )}
                                  disabled={busyKey === actionBusyKey}
                                  key={status}
                                  onClick={() =>
                                    void handleActionStatusChange(
                                      selectedAlert.id,
                                      actionIndex,
                                      status,
                                    )
                                  }
                                  type="button"
                                >
                                  {formatStatus(status)}
                                </button>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="detail-card detail-card--stack">
                    <span className="detail-label">Sources and next watch</span>
                    <ul className="source-list">
                      {selectedAlert.sourceLinks.map((source) => (
                        <li key={source.url}>
                          <a href={source.url} rel="noreferrer" target="_blank">
                            {source.label}
                          </a>
                          <span>{source.publishedAt ?? "Undated"}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="watch-note">{selectedAlert.watchNext}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-card empty-card--detail">
                <strong>No alerts to show.</strong>
                <p>Import an asset map or switch boards to continue.</p>
              </div>
            )}
          </article>
          </div>
        </section>

        <section className="section-block" id="signals">
          <div className="section-header">
            <div>
              <p className="eyebrow">Sources</p>
              <h2>Public and manual signals</h2>
            </div>
          </div>
          <div className="split-layout">
            <article className="panel">
              <div className="section-header source-control-header">
                <div>
                  <p className="eyebrow">Public sources</p>
                  <h2>NOAA and Federal Register</h2>
                </div>
                <button
                  className="secondary-button"
                  disabled={busyKey === "public-ingest"}
                  onClick={() => void handlePublicIngest()}
                  type="button"
                >
                  <Globe2 size={16} />
                  {busyKey === "public-ingest" ? "Syncing..." : "Sync now"}
                </button>
              </div>
              <div className="source-grid">
                <div className="source-card">
                  <CloudSun size={18} />
                  <strong>NOAA</strong>
                  <p>Weather alerts</p>
                </div>
                <div className="source-card">
                  <Landmark size={18} />
                  <strong>Federal Register</strong>
                  <p>Policy changes</p>
                </div>
                <div className="source-card">
                  <CheckCircle2 size={18} />
                  <strong>{workspace.totals.liveAlerts}</strong>
                  <p>Live-source alerts</p>
                </div>
              </div>
            </article>
            <article className="panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Manual signal</p>
                  <h2>Add one risk</h2>
                </div>
              </div>
              <div className="manual-alert-grid">
                <label className="upload-field">
                  <span>Board</span>
                  <select
                    onChange={(event) =>
                      setManualAlert((current) => ({
                        ...current,
                        board: event.target.value as BoardId,
                      }))
                    }
                    value={manualAlert.board}
                  >
                    <option value="natural-disasters">Natural disasters</option>
                    <option value="social-policy">Social policy</option>
                  </select>
                </label>
                <label className="upload-field">
                  <span>Risk type</span>
                  <input
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, riskType: event.target.value }))
                    }
                    value={manualAlert.riskType}
                  />
                </label>
                <label className="upload-field upload-field--wide">
                  <span>Title</span>
                  <input
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Supplier notice pauses Shenzhen pickup windows"
                    value={manualAlert.title}
                  />
                </label>
                <label className="upload-field upload-field--wide">
                  <span>Summary</span>
                  <textarea
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, summary: event.target.value }))
                    }
                    placeholder="What changed, which promise is exposed, and why it matters."
                    rows={3}
                    value={manualAlert.summary}
                  />
                </label>
                <label className="upload-field">
                  <span>Severity</span>
                  <input
                    max={5}
                    min={1}
                    onChange={(event) =>
                      setManualAlert((current) => ({
                        ...current,
                        severity: Number(event.target.value),
                      }))
                    }
                    type="number"
                    value={manualAlert.severity}
                  />
                </label>
                <label className="upload-field">
                  <span>Confidence</span>
                  <input
                    max={5}
                    min={1}
                    onChange={(event) =>
                      setManualAlert((current) => ({
                        ...current,
                        confidence: Number(event.target.value),
                      }))
                    }
                    type="number"
                    value={manualAlert.confidence}
                  />
                </label>
                <label className="upload-field">
                  <span>Hours</span>
                  <input
                    min={1}
                    onChange={(event) =>
                      setManualAlert((current) => ({
                        ...current,
                        hoursToImpact: Number(event.target.value),
                      }))
                    }
                    type="number"
                    value={manualAlert.hoursToImpact}
                  />
                </label>
                <label className="upload-field">
                  <span>Countries</span>
                  <input
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, countries: event.target.value }))
                    }
                    placeholder="United States, China"
                    value={manualAlert.countries}
                  />
                </label>
                <label className="upload-field">
                  <span>States</span>
                  <input
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, states: event.target.value }))
                    }
                    placeholder="California, Guangdong"
                    value={manualAlert.states}
                  />
                </label>
                <label className="upload-field">
                  <span>Cities</span>
                  <input
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, cities: event.target.value }))
                    }
                    placeholder="Los Angeles, Shenzhen"
                    value={manualAlert.cities}
                  />
                </label>
                <label className="upload-field">
                  <span>Source label</span>
                  <input
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, sourceLabel: event.target.value }))
                    }
                    placeholder="Carrier email"
                    value={manualAlert.sourceLabel}
                  />
                </label>
                <label className="upload-field">
                  <span>Source URL</span>
                  <input
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, sourceUrl: event.target.value }))
                    }
                    placeholder="https://..."
                    value={manualAlert.sourceUrl}
                  />
                </label>
                <label className="upload-field">
                  <span>First action</span>
                  <input
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, actionTitle: event.target.value }))
                    }
                    placeholder="Prioritize exposed orders"
                    value={manualAlert.actionTitle}
                  />
                </label>
                <label className="upload-field">
                  <span>Owner</span>
                  <input
                    onChange={(event) =>
                      setManualAlert((current) => ({ ...current, actionOwner: event.target.value }))
                    }
                    value={manualAlert.actionOwner}
                  />
                </label>
                <button
                  className="primary-button manual-alert-submit"
                  disabled={busyKey === "manual-alert"}
                  onClick={() => void handleManualAlertCreate()}
                  type="button"
                >
                  <Plus size={16} />
                  {busyKey === "manual-alert" ? "Adding..." : "Add alert"}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="section-block" id="intake">
          <div className="section-header">
            <div>
              <p className="eyebrow">Data intake</p>
              <h2>CSV maps and documents</h2>
            </div>
          </div>
          <div className="workspace-tools">
            <label className="workspace-import">
              <span>Restore workspace JSON</span>
              <input
                accept="application/json,.json"
                type="file"
                onChange={(event) => setWorkspaceImportFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              className="secondary-button"
              disabled={busyKey === "workspace-import"}
              onClick={() => void handleWorkspaceImport()}
              type="button"
            >
              <Upload size={16} />
              {busyKey === "workspace-import" ? "Importing..." : "Import workspace"}
            </button>
            <button
              className="ghost-button"
              disabled={busyKey === "workspace-reset"}
              onClick={() => void handleResetWorkspace()}
              type="button"
            >
              <RotateCcw size={16} />
              {busyKey === "workspace-reset" ? "Resetting..." : "Reset demo"}
            </button>
          </div>
          <div className="template-grid">
            {templateDefinitions.map((template) => (
              <form
                className="template-card"
                key={template.kind}
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCsvUpload(template.kind);
                }}
              >
                <div className="template-card__head">
                  <div>
                    <h3>{template.label}</h3>
                  </div>
                  <a className="ghost-button" href={`/templates/${template.fileName}`} download>
                    <FileDown size={16} />
                    CSV
                  </a>
                </div>
                <label className="upload-field">
                  <span>Replace current {template.label.toLowerCase()}</span>
                  <input
                    accept=".csv,text/csv"
                    type="file"
                    onChange={(event) =>
                      setCsvFiles((current) => ({
                        ...current,
                        [template.kind]: event.target.files?.[0] ?? null,
                      }))
                    }
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={busyKey === template.kind}
                  type="submit"
                >
                  <Upload size={16} />
                  {busyKey === template.kind ? "Importing..." : `Import ${template.label}`}
                </button>
              </form>
            ))}
          </div>
          <div className="document-form panel inset-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Documents</p>
                <h3>Add context</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="upload-field">
                <span>File</span>
                <input
                  type="file"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className="upload-field">
                <span>Document type</span>
                <select
                  onChange={(event) => setDocumentKind(event.target.value)}
                  value={documentKind}
                >
                  <option value="playbook">Playbook</option>
                  <option value="policy">Policy note</option>
                  <option value="contract">Contract or SLA</option>
                  <option value="ops-note">Ops note</option>
                </select>
              </label>
              <label className="upload-field upload-field--wide">
                <span>Short note</span>
                <textarea
                  onChange={(event) => setDocumentNote(event.target.value)}
                  placeholder="What should the team remember about this file?"
                  rows={3}
                  value={documentNote}
                />
              </label>
              <label className="upload-field upload-field--wide">
                <span>Tags</span>
                <input
                  onChange={(event) => setDocumentTags(event.target.value)}
                  placeholder="weather, west coast, customs"
                  type="text"
                  value={documentTags}
                />
              </label>
            </div>
            <button
              className="secondary-button"
              disabled={busyKey === "document"}
              onClick={() => void handleDocumentUpload()}
              type="button"
            >
              <Upload size={16} />
              {busyKey === "document" ? "Uploading..." : "Upload document"}
            </button>
          </div>
        </section>

        <section className="section-block" id="settings">
          <div className="section-header">
            <div>
              <p className="eyebrow">Workspace</p>
              <h2>Settings and reference material</h2>
            </div>
          </div>
          <div className="split-layout">
            <article className="panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Settings</p>
                  <h2>Workspace profile</h2>
                </div>
              </div>
              <div className="settings-form">
                <label className="upload-field">
                  <span>Workspace name</span>
                  <input
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    value={workspaceName}
                  />
                </label>
                <label className="upload-field">
                  <span>Operator note</span>
                  <textarea
                    onChange={(event) => setWorkspaceNotes(event.target.value)}
                    rows={3}
                    value={workspaceNotes}
                  />
                </label>
                <button
                  className="secondary-button"
                  disabled={busyKey === "workspace-settings"}
                  onClick={() => void handleWorkspaceSettings()}
                  type="button"
                >
                  <Save size={16} />
                  {busyKey === "workspace-settings" ? "Saving..." : "Save settings"}
                </button>
              </div>
              <ul className="coverage-list">
                <li>Facilities: {workspace.assets.facilities.length}</li>
                <li>Lanes: {workspace.assets.lanes.length}</li>
                <li>SKUs: {workspace.assets.skus.length}</li>
                <li>Storefronts: {workspace.assets.storefronts.length}</li>
                <li>Workforce: {workspace.assets.workforceLocations.length}</li>
              </ul>
            </article>
            <article className="panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Documents</p>
                  <h2>Reference vault</h2>
                </div>
              </div>
              <ul className="document-list">
                {workspace.documents.map((document) => (
                  <li key={document.id}>
                    <div>
                      <strong>{document.name}</strong>
                      <div className="tag-row">
                        {document.tags.map((tag) => (
                          <span className="data-tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="document-meta">
                      <span>{document.kind}</span>
                      <span>{Math.max(1, Math.round(document.sizeBytes / 1024))} KB</span>
                      <span>{formatDate(document.uploadedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="section-block" id="audit">
          <div className="section-header">
            <div>
              <p className="eyebrow">Audit</p>
              <h2>Recent workspace changes</h2>
            </div>
          </div>
          <ul className="audit-list panel">
            {workspace.auditTrail.slice(0, 8).map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{event.summary}</strong>
                  <p>{event.actor} · {formatDate(event.createdAt)}</p>
                </div>
                <span className="data-tag">{event.type}</span>
              </li>
            ))}
            {workspace.auditTrail.length === 0 ? (
              <li>
                <div>
                  <strong>No audit events yet.</strong>
                  <p>Imports, public pulls, uploads, and action status changes will appear here.</p>
                </div>
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
