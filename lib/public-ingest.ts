import type { AlertRecord, WorkspaceData } from "@/lib/types";

const stateNameToCode: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

const stateCodeToName = Object.fromEntries(
  Object.entries(stateNameToCode).map(([name, code]) => [code, name]),
);

type NoaaFeature = {
  id: string;
  properties: {
    event?: string;
    headline?: string;
    description?: string;
    severity?: string;
    certainty?: string;
    urgency?: string;
    effective?: string;
    expires?: string;
    areaDesc?: string;
    geocode?: {
      UGC?: string[];
    };
  };
};

type FederalRegisterDocument = {
  document_number: string;
  title: string;
  abstract?: string;
  publication_date: string;
  html_url: string;
  agencies?: Array<{ name: string }>;
};

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function stateCodesFromWorkspace(workspace: WorkspaceData) {
  const states = [
    ...workspace.assets.facilities.map((facility) => facility.state),
    ...workspace.assets.lanes.map((lane) => lane.destinationState),
    ...workspace.assets.storefronts.map((storefront) => storefront.state),
    ...workspace.assets.workforceLocations.map((location) => location.state),
  ];

  return unique(
    states
      .map((state) => state.trim())
      .map((state) => stateNameToCode[state] ?? state.toUpperCase())
      .filter((state) => /^[A-Z]{2}$/.test(state)),
  ).slice(0, 8);
}

function noaaSeverityScore(value: string | undefined) {
  switch (value?.toLowerCase()) {
    case "extreme":
      return 5;
    case "severe":
      return 4;
    case "moderate":
      return 3;
    default:
      return 2;
  }
}

function noaaConfidenceScore(value: string | undefined) {
  switch (value?.toLowerCase()) {
    case "observed":
    case "likely":
      return 5;
    case "possible":
      return 3;
    default:
      return 4;
  }
}

function hoursUntil(value: string | undefined) {
  if (!value) {
    return 24;
  }

  const diff = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(diff)) {
    return 24;
  }

  return Math.max(1, Math.round(diff / 1000 / 60 / 60));
}

function riskTypeFromNoaaEvent(event: string | undefined) {
  const normalized = event?.toLowerCase() ?? "";

  if (normalized.includes("flood")) {
    return "flood";
  }

  if (normalized.includes("fire") || normalized.includes("smoke")) {
    return "wildfire";
  }

  if (normalized.includes("heat")) {
    return "heatwave";
  }

  if (normalized.includes("storm") || normalized.includes("wind") || normalized.includes("hurricane")) {
    return "storm";
  }

  return "weather";
}

async function fetchNoaaAlerts(workspace: WorkspaceData): Promise<AlertRecord[]> {
  const states = stateCodesFromWorkspace(workspace);

  if (!states.length) {
    return [];
  }

  const url = `https://api.weather.gov/alerts/active?area=${states.join(",")}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json",
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA ingest failed with ${response.status}.`);
  }

  const data = (await response.json()) as { features?: NoaaFeature[] };

  return (data.features ?? []).slice(0, 8).map((feature) => {
    const event = feature.properties.event ?? "Weather alert";
    const stateNames = unique(
      (feature.properties.geocode?.UGC ?? [])
        .map((code) => code.slice(0, 2))
        .map((code) => stateCodeToName[code])
        .filter(Boolean),
    );
    const areaStates = stateNames.length > 0 ? stateNames : states.map((state) => stateCodeToName[state] ?? state);

    return {
      id: `noaa-${slug(feature.id)}`,
      board: "natural-disasters",
      origin: "public-ingest",
      riskType: riskTypeFromNoaaEvent(event),
      title: feature.properties.headline ?? event,
      summary:
        feature.properties.description?.replace(/\s+/g, " ").slice(0, 240) ??
        `${event} is active for ${feature.properties.areaDesc ?? areaStates.join(", ")}.`,
      severity: noaaSeverityScore(feature.properties.severity),
      confidence: noaaConfidenceScore(feature.properties.certainty ?? feature.properties.urgency),
      hoursToImpact: hoursUntil(feature.properties.effective ?? feature.properties.expires),
      detectedAt: new Date().toISOString(),
      locations: {
        countries: ["United States"],
        states: areaStates,
        cities: [],
      },
      sourceLinks: [
        {
          label: "NOAA active alert",
          url: feature.id,
          publishedAt: feature.properties.effective?.slice(0, 10),
        },
      ],
      signals: [event, feature.properties.severity ?? "active alert", feature.properties.areaDesc ?? "regional exposure"],
      actions: [
        {
          title: "Check exposed facilities, lanes, and customer promises",
          owner: "Operations lead",
          status: "new",
          rationale: "NOAA has an active alert in a geography connected to the asset map.",
        },
        {
          title: "Stage a customer-facing delay note if carrier windows tighten",
          owner: "Customer care",
          status: "new",
          rationale: "External weather alerts often show up first as delivery promise pressure.",
        },
      ],
      watchNext: "Refresh public weather alerts and carrier exceptions before the next operating cutoff.",
    };
  });
}

async function fetchFederalRegisterAlerts(): Promise<AlertRecord[]> {
  const url = new URL("https://www.federalregister.gov/api/v1/documents.json");
  url.searchParams.set("per_page", "8");
  url.searchParams.set("order", "newest");
  url.searchParams.set(
    "conditions[term]",
    "tariff customs import trade Canada Section 338 CUSMA USMCA de minimis",
  );

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Federal Register ingest failed with ${response.status}.`);
  }

  const data = (await response.json()) as { results?: FederalRegisterDocument[] };

  return (data.results ?? []).slice(0, 5).map((document) => ({
    id: `fr-${document.document_number}`,
    board: "social-policy",
    origin: "public-ingest",
    riskType: "trade policy",
    title: document.title,
    summary:
      document.abstract?.replace(/\s+/g, " ").slice(0, 240) ??
      `Federal Register document from ${document.agencies?.[0]?.name ?? "a U.S. agency"} may affect import, customs, tariff, or trade operations.`,
    severity: 3,
    confidence: 4,
    hoursToImpact: 24,
    detectedAt: new Date().toISOString(),
    locations: {
      countries: ["United States"],
      states: [],
      cities: [],
    },
    sourceLinks: [
      {
        label: "Federal Register",
        url: document.html_url,
        publishedAt: document.publication_date,
      },
    ],
    signals: ["federal policy document", "trade or customs term match", document.agencies?.[0]?.name ?? "U.S. agency"],
    actions: [
      {
        title: "Review affected SKU origins, HTS codes, and U.S. market exposure",
        owner: "Trade compliance",
        status: "new",
        rationale: "The source matched trade, tariff, customs, or import terms that can affect landed cost and declaration workflow.",
      },
      {
        title: "Decide whether pricing, shipping promises, or supplier routing needs a hold",
        owner: "Finance and operations",
        status: "new",
        rationale: "Policy signals become operational risk when they touch margin, routing, or customer promises.",
      },
    ],
    watchNext: "Compare the document with current replenishment plans and thin-margin SKUs.",
  }));
}

function mergeAlerts(existing: AlertRecord[], incoming: AlertRecord[]) {
  const seen = new Set(existing.map((alert) => alert.id));
  const newAlerts = incoming.filter((alert) => !seen.has(alert.id));

  return {
    alerts: [...newAlerts, ...existing],
    added: newAlerts.length,
    skipped: incoming.length - newAlerts.length,
  };
}

export async function ingestPublicSources(workspace: WorkspaceData) {
  const [weatherAlerts, policyAlerts] = await Promise.all([
    fetchNoaaAlerts(workspace),
    fetchFederalRegisterAlerts(),
  ]);
  const incoming = [...weatherAlerts, ...policyAlerts];
  const merged = mergeAlerts(workspace.alerts, incoming);

  return {
    ...merged,
    incoming,
    fetched: incoming.length,
    sourceCounts: {
      noaa: weatherAlerts.length,
      federalRegister: policyAlerts.length,
    },
    runId: crypto.randomUUID(),
  };
}
