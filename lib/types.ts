export type BoardId = "natural-disasters" | "social-policy";
export type Criticality = "core" | "important" | "monitor";
export type AlertStatus = "watch" | "elevated" | "high" | "critical";
export type ActionStatus = "new" | "in-progress" | "done";
export type AlertOrigin = "seed" | "public-ingest" | "manual";
export type ImpactFilterKey =
  | "facilities"
  | "lanes"
  | "skus"
  | "storefronts"
  | "workforceLocations";

export interface SourceLink {
  label: string;
  url: string;
  publishedAt?: string;
}

export interface ActionItem {
  title: string;
  owner: string;
  status: ActionStatus;
  rationale: string;
}

export interface AuditEvent {
  id: string;
  type:
    | "action-status"
    | "csv-import"
    | "document-upload"
    | "public-ingest"
    | "manual-alert"
    | "workspace-settings"
    | "workspace-import"
    | "workspace-export"
    | "workspace-reset";
  createdAt: string;
  actor: string;
  summary: string;
  alertId?: string;
  details?: Record<string, string | number | boolean>;
}

export interface AlertLocations {
  countries: string[];
  states: string[];
  cities: string[];
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  country: string;
  state: string;
  city: string;
  timezone: string;
  criticality: Criticality;
  notes?: string;
}

export interface Lane {
  id: string;
  name: string;
  originCountry: string;
  originState: string;
  destinationCountry: string;
  destinationState: string;
  mode: string;
  leadTimeDays: number;
  fulfillmentSlaDays: number;
  criticality: Criticality;
  notes?: string;
}

export interface Sku {
  id: string;
  name: string;
  originCountry: string;
  primaryMarket: string;
  channels: string[];
  marginBand: string;
  criticality: Criticality;
  htsCode?: string;
  category?: string;
  userSegments?: string[];
  alternateOrigins?: string[];
  notes?: string;
}

export interface Storefront {
  id: string;
  name: string;
  platform: string;
  market: string;
  country: string;
  state: string;
  city: string;
  criticality: Criticality;
  notes?: string;
}

export interface WorkforceLocation {
  id: string;
  teamName: string;
  country: string;
  state: string;
  city: string;
  employees: number;
  criticality: Criticality;
  notes?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  kind: string;
  summary: string;
  tags: string[];
  uploadedAt: string;
  sizeBytes: number;
  path: string;
}

export interface AlertRecord {
  id: string;
  board: BoardId;
  origin?: AlertOrigin;
  riskType: string;
  title: string;
  summary: string;
  severity: number;
  confidence: number;
  hoursToImpact: number;
  detectedAt: string;
  locations: AlertLocations;
  sourceLinks: SourceLink[];
  signals: string[];
  actions: ActionItem[];
  watchNext: string;
}

export interface WorkspaceData {
  metadata: {
    workspaceName: string;
    mode: string;
    createdAt: string;
    updatedAt: string;
    notes?: string;
  };
  assets: {
    facilities: Facility[];
    lanes: Lane[];
    skus: Sku[];
    storefronts: Storefront[];
    workforceLocations: WorkforceLocation[];
  };
  documents: DocumentRecord[];
  alerts: AlertRecord[];
  auditTrail?: AuditEvent[];
}

export type AssetCollectionKey = keyof WorkspaceData["assets"];
export type CsvImportKind =
  | "facilities"
  | "lanes"
  | "skus"
  | "storefronts"
  | "workforce_locations";

export interface ImpactGroup {
  total: number;
  core: number;
  names: string[];
}

export interface AlertImpact {
  facilities: ImpactGroup;
  lanes: ImpactGroup;
  skus: ImpactGroup;
  storefronts: ImpactGroup;
  workforceLocations: ImpactGroup;
  totalAssets: number;
  coreAssets: number;
}

export interface EnrichedAlert extends AlertRecord {
  score: number;
  status: AlertStatus;
  impact: AlertImpact;
}

export interface BoardView {
  id: BoardId;
  label: string;
  summary: string;
  alerts: EnrichedAlert[];
}

export interface DigestAction {
  title: string;
  owner: string;
  alertTitle: string;
  board: BoardId;
  status: ActionStatus;
}

export interface ReadinessView {
  score: number;
  label: string;
  mappedAlerts: number;
  blindSpots: number;
  missingAssetGroups: string[];
  blindSpotTitles: string[];
  suggestions: string[];
}

export interface WorkspaceView extends WorkspaceData {
  boards: Record<BoardId, BoardView>;
  totals: {
    totalAssets: number;
    monitoredAlerts: number;
    criticalAlerts: number;
    pendingActions: number;
    doneActions: number;
    documents: number;
    coverageGroups: number;
    liveAlerts: number;
  };
  auditTrail: AuditEvent[];
  readiness: ReadinessView;
  digest: {
    headline: string;
    priorities: EnrichedAlert[];
    nextActions: DigestAction[];
  };
}

export const boardLabels: Record<BoardId, string> = {
  "natural-disasters": "Natural disasters",
  "social-policy": "Social policy",
};
