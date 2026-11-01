import {
  type AlertImpact,
  type AlertRecord,
  type AlertStatus,
  type BoardId,
  boardLabels,
  type EnrichedAlert,
  type ImpactGroup,
  type WorkspaceData,
  type WorkspaceView,
} from "@/lib/types";

const assetGroupDefinitions = [
  {
    key: "facilities",
    label: "Facilities",
    hint: "Import facilities to map storms, closures, and warehouse constraints.",
  },
  {
    key: "lanes",
    label: "Lanes",
    hint: "Import lanes to connect disruption to lead times and service promises.",
  },
  {
    key: "skus",
    label: "SKUs",
    hint: "Import SKUs to translate tariffs and supply shocks into margin risk.",
  },
  {
    key: "storefronts",
    label: "Storefronts",
    hint: "Import storefronts to tie disruption to customer promises and channel health.",
  },
  {
    key: "workforceLocations",
    label: "Workforce",
    hint: "Import workforce locations to make compliance and local response playbooks state-aware.",
  },
] as const;

const locationAliases: Record<string, string[]> = {
  "united states": ["united states", "us", "usa", "u.s."],
  canada: ["canada", "ca"],
  china: ["china", "cn", "prc"],
  california: ["california", "ca"],
  ontario: ["ontario", "on"],
  texas: ["texas", "tx"],
  washington: ["washington", "wa"],
  "new york": ["new york", "ny"],
  "new jersey": ["new jersey", "nj"],
  guangdong: ["guangdong"],
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchesLocation(values: string[], candidates: string[]) {
  if (!values.length) {
    return false;
  }

  const normalizedCandidates = candidates.map(normalize);

  return values.some((value) => {
    const key = normalize(value);
    const accepted = locationAliases[key] ?? [key];
    return accepted.some((candidate) => normalizedCandidates.includes(candidate));
  });
}

function isUnitedStates(value: string) {
  return matchesLocation(["United States"], [value]);
}

function isTariffAlert(alert: AlertRecord) {
  const text = [
    alert.riskType,
    alert.title,
    alert.summary,
    ...alert.signals,
  ].join(" ").toLowerCase();

  return ["tariff", "customs", "import", "trade", "duty", "section 338"].some((term) =>
    text.includes(term),
  );
}

function isCritical(criticality: string) {
  return criticality === "core";
}

function buildImpactGroup<T extends { name?: string; teamName?: string; criticality: string }>(
  records: T[],
) {
  const names = records.map((record) => record.name ?? record.teamName ?? "Unnamed");
  return {
    total: records.length,
    core: records.filter((record) => isCritical(record.criticality)).length,
    names,
  } satisfies ImpactGroup;
}

function getImpactForAlert(alert: AlertRecord, workspace: WorkspaceData): AlertImpact {
  const facilities = workspace.assets.facilities.filter((facility) =>
    matchesLocation(alert.locations.countries, [facility.country]) ||
    matchesLocation(alert.locations.states, [facility.state]) ||
    matchesLocation(alert.locations.cities, [facility.city]),
  );

  const foreignPolicyCountries = alert.locations.countries.filter((country) => !isUnitedStates(country));
  const lanes = workspace.assets.lanes.filter((lane) => {
    if (isTariffAlert(alert) && foreignPolicyCountries.length > 0) {
      return matchesLocation(foreignPolicyCountries, [lane.originCountry]);
    }

    return (
      matchesLocation(alert.locations.countries, [lane.originCountry, lane.destinationCountry]) ||
      matchesLocation(alert.locations.states, [lane.originState, lane.destinationState])
    );
  });

  const skus = workspace.assets.skus.filter((sku) => {
    if (isTariffAlert(alert) && foreignPolicyCountries.length > 0) {
      return matchesLocation(foreignPolicyCountries, [sku.originCountry]);
    }

    return (
      matchesLocation(alert.locations.countries, [sku.originCountry, sku.primaryMarket]) ||
      matchesLocation(alert.locations.states, sku.channels)
    );
  });

  const storefronts = workspace.assets.storefronts.filter((storefront) =>
    matchesLocation(alert.locations.countries, [storefront.country, storefront.market]) ||
    matchesLocation(alert.locations.states, [storefront.state]) ||
    matchesLocation(alert.locations.cities, [storefront.city]),
  );

  const workforceLocations = workspace.assets.workforceLocations.filter((location) =>
    matchesLocation(alert.locations.countries, [location.country]) ||
    matchesLocation(alert.locations.states, [location.state]) ||
    matchesLocation(alert.locations.cities, [location.city]),
  );

  const groups = {
    facilities: buildImpactGroup(facilities),
    lanes: buildImpactGroup(lanes),
    skus: buildImpactGroup(skus),
    storefronts: buildImpactGroup(storefronts),
    workforceLocations: buildImpactGroup(workforceLocations),
  };

  const totalAssets =
    groups.facilities.total +
    groups.lanes.total +
    groups.skus.total +
    groups.storefronts.total +
    groups.workforceLocations.total;

  const coreAssets =
    groups.facilities.core +
    groups.lanes.core +
    groups.skus.core +
    groups.storefronts.core +
    groups.workforceLocations.core;

  return {
    ...groups,
    totalAssets,
    coreAssets,
  };
}

function urgencyScore(hoursToImpact: number) {
  if (hoursToImpact <= 12) {
    return 28;
  }

  if (hoursToImpact <= 24) {
    return 22;
  }

  if (hoursToImpact <= 48) {
    return 14;
  }

  return 8;
}

function scoreAlert(alert: AlertRecord, impact: AlertImpact) {
  const severity = alert.severity * 12;
  const urgency = urgencyScore(alert.hoursToImpact);
  const exposure = Math.min(impact.totalAssets * 4, 28);
  const critical = Math.min(impact.coreAssets * 6, 24);
  const confidence = alert.confidence * 3;
  return severity + urgency + exposure + critical + confidence;
}

function statusFromScore(score: number): AlertStatus {
  if (score >= 90) {
    return "critical";
  }

  if (score >= 70) {
    return "high";
  }

  if (score >= 45) {
    return "elevated";
  }

  return "watch";
}

function buildSummary(boardId: BoardId, alerts: EnrichedAlert[]) {
  if (!alerts.length) {
    return "No alerts yet.";
  }

  const criticalCount = alerts.filter((alert) => alert.status === "critical").length;
  const exposedAssets = alerts.reduce((sum, alert) => sum + alert.impact.totalAssets, 0);
  const topRisk = alerts[0];

  return `${boardLabels[boardId]} board: ${criticalCount} critical, ${exposedAssets} exposed assets, top risk ${topRisk.title.toLowerCase()}.`;
}

function buildReadinessView(workspace: WorkspaceData, alerts: EnrichedAlert[]) {
  const loadedGroups = assetGroupDefinitions.filter(
    ({ key }) => workspace.assets[key].length > 0,
  );
  const missingGroups = assetGroupDefinitions.filter(
    ({ key }) => workspace.assets[key].length === 0,
  );
  const mappedAlerts = alerts.filter((alert) => alert.impact.totalAssets > 0);
  const blindSpots = alerts.filter((alert) => alert.impact.totalAssets === 0);
  const groupCoverage = (loadedGroups.length / assetGroupDefinitions.length) * 55;
  const alertCoverage =
    alerts.length > 0 ? (mappedAlerts.length / alerts.length) * 30 : 0;
  const documentCoverage = Math.min(workspace.documents.length, 3) / 3 * 15;
  const score = Math.round(groupCoverage + alertCoverage + documentCoverage);
  const label =
    score >= 85 ? "Pilot ready" : score >= 65 ? "Usable with gaps" : "Needs setup";

  const suggestions = [
    ...missingGroups.map(({ hint }) => hint),
    ...(blindSpots.length > 0
      ? [
          `${blindSpots.length} alerts still have no direct asset match. Add missing geography, channels, or workforce coverage to reduce blind spots.`,
        ]
      : []),
    ...(workspace.documents.length < 2
      ? [
          "Add at least one more playbook, contract, or local policy note so responders are not improvising during the first disruption.",
        ]
      : []),
  ];

  if (suggestions.length === 0) {
    suggestions.push(
      "Coverage is strong enough for a pilot. The next step is live source ingestion and multi-user workflow.",
    );
  }

  return {
    score,
    label,
    mappedAlerts: mappedAlerts.length,
    blindSpots: blindSpots.length,
    missingAssetGroups: missingGroups.map(({ label: groupLabel }) => groupLabel),
    blindSpotTitles: blindSpots.map((alert) => alert.title),
    suggestions,
  };
}

export function buildWorkspaceView(workspace: WorkspaceData): WorkspaceView {
  const enrichedAlerts = workspace.alerts
    .map((alert) => {
      const impact = getImpactForAlert(alert, workspace);
      const score = scoreAlert(alert, impact);
      return {
        ...alert,
        impact,
        score,
        status: statusFromScore(score),
      } satisfies EnrichedAlert;
    })
    .sort((left, right) => right.score - left.score || left.hoursToImpact - right.hoursToImpact);

  const boardEntries = (["natural-disasters", "social-policy"] as const).map((boardId) => {
    const alerts = enrichedAlerts.filter((alert) => alert.board === boardId);
    return [
      boardId,
      {
        id: boardId,
        label: boardLabels[boardId],
        summary: buildSummary(boardId, alerts),
        alerts,
      },
    ] as const;
  });

  const boards = Object.fromEntries(boardEntries) as WorkspaceView["boards"];
  const priorities = enrichedAlerts.slice(0, 3);
  const nextActions = priorities.flatMap((alert) =>
    alert.actions.map((action) => ({
      title: action.title,
      owner: action.owner,
      alertTitle: alert.title,
      board: alert.board,
      status: action.status,
    })),
  );

  const totalAssets =
    workspace.assets.facilities.length +
    workspace.assets.lanes.length +
    workspace.assets.skus.length +
    workspace.assets.storefronts.length +
    workspace.assets.workforceLocations.length;

  const coverageGroups = Object.values(workspace.assets).filter((records) => records.length > 0).length;
  const pendingActions = workspace.alerts.reduce(
    (sum, alert) => sum + alert.actions.filter((action) => action.status !== "done").length,
    0,
  );
  const doneActions = workspace.alerts.reduce(
    (sum, alert) => sum + alert.actions.filter((action) => action.status === "done").length,
    0,
  );
  const criticalAlerts = enrichedAlerts.filter((alert) => alert.status === "critical").length;
  const liveAlerts = enrichedAlerts.filter((alert) => alert.origin === "public-ingest").length;
  const readiness = buildReadinessView(workspace, enrichedAlerts);

  return {
    ...workspace,
    auditTrail: workspace.auditTrail ?? [],
    boards,
    totals: {
      totalAssets,
      monitoredAlerts: enrichedAlerts.length,
      criticalAlerts,
      pendingActions,
      doneActions,
      documents: workspace.documents.length,
      coverageGroups,
      liveAlerts,
    },
    readiness,
    digest: {
      headline:
        priorities[0]?.title ??
        "Import your asset map to see the first operational headline.",
      priorities,
      nextActions: nextActions
        .filter((action) => action.status !== "done")
        .slice(0, 6),
    },
  };
}
