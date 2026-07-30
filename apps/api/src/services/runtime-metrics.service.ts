export type RuntimeRequestMetricInput = {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
};

export class RuntimeMetricsRegistry {
  private readonly requestCounts = new Map<string, number>();
  private readonly requestDurationMs = new Map<string, { count: number; sum: number; max: number }>();
  private readinessChecks = 0;
  private readinessFailures = 0;
  private errorReportsAttempted = 0;
  private errorReportsFailed = 0;
  private rateLimitedResponses = 0;

  recordRequest(input: RuntimeRequestMetricInput): void {
    const method = sanitizeLabel(input.method.toUpperCase(), 16);
    const route = sanitizeRoute(input.route);
    const statusClass = `${Math.floor(input.statusCode / 100)}xx`;
    const key = `${method}|${route}|${statusClass}`;
    const durationKey = `${method}|${route}`;

    this.requestCounts.set(key, (this.requestCounts.get(key) ?? 0) + 1);
    if (input.statusCode === 429) this.rateLimitedResponses += 1;

    const current = this.requestDurationMs.get(durationKey) ?? { count: 0, sum: 0, max: 0 };
    const durationMs = Number.isFinite(input.durationMs) && input.durationMs >= 0 ? input.durationMs : 0;
    this.requestDurationMs.set(durationKey, {
      count: current.count + 1,
      sum: current.sum + durationMs,
      max: Math.max(current.max, durationMs)
    });

    trimMap(this.requestCounts, 400);
    trimMap(this.requestDurationMs, 200);
  }

  recordReadiness(ready: boolean): void {
    this.readinessChecks += 1;
    if (!ready) {
      this.readinessFailures += 1;
    }
  }

  recordErrorReport(success: boolean): void {
    this.errorReportsAttempted += 1;
    if (!success) {
      this.errorReportsFailed += 1;
    }
  }

  renderPrometheus(): string {
    const lines = [
      "# HELP babyloop_api_http_requests_total Total API responses by method, route and status class.",
      "# TYPE babyloop_api_http_requests_total counter"
    ];

    for (const [key, value] of [...this.requestCounts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const [method, route, statusClass] = key.split("|");
      lines.push(`babyloop_api_http_requests_total{method="${escapeLabel(method ?? "UNKNOWN")}",route="${escapeLabel(route ?? "/unknown")}",status_class="${escapeLabel(statusClass ?? "unknown")}"} ${value}`);
    }

    lines.push(
      "# HELP babyloop_api_http_request_duration_ms API response duration in milliseconds.",
      "# TYPE babyloop_api_http_request_duration_ms summary"
    );

    for (const [key, value] of [...this.requestDurationMs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const [method, route] = key.split("|");
      const labels = `method="${escapeLabel(method ?? "UNKNOWN")}",route="${escapeLabel(route ?? "/unknown")}"`;
      lines.push(`babyloop_api_http_request_duration_ms_count{${labels}} ${value.count}`);
      lines.push(`babyloop_api_http_request_duration_ms_sum{${labels}} ${value.sum.toFixed(3)}`);
      lines.push(`babyloop_api_http_request_duration_ms_max{${labels}} ${value.max.toFixed(3)}`);
    }

    lines.push(
      "# HELP babyloop_api_readiness_checks_total Total readiness checks.",
      "# TYPE babyloop_api_readiness_checks_total counter",
      `babyloop_api_readiness_checks_total ${this.readinessChecks}`,
      "# HELP babyloop_api_readiness_failures_total Total failed readiness checks.",
      "# TYPE babyloop_api_readiness_failures_total counter",
      `babyloop_api_readiness_failures_total ${this.readinessFailures}`,
      "# HELP babyloop_api_rate_limited_responses_total Total HTTP 429 responses.",
      "# TYPE babyloop_api_rate_limited_responses_total counter",
      `babyloop_api_rate_limited_responses_total ${this.rateLimitedResponses}`,
      "# HELP babyloop_api_error_reports_total Total external error report attempts.",
      "# TYPE babyloop_api_error_reports_total counter",
      `babyloop_api_error_reports_total ${this.errorReportsAttempted}`,
      "# HELP babyloop_api_error_report_failures_total Total failed external error reports.",
      "# TYPE babyloop_api_error_report_failures_total counter",
      `babyloop_api_error_report_failures_total ${this.errorReportsFailed}`
    );

    return `${lines.join("\n")}\n`;
  }
}

function sanitizeRoute(value: string): string {
  const route = value.split("?")[0]?.trim() || "/unknown";
  return route.replace(/[\r\n"\\]/gu, "_").slice(0, 180);
}

function sanitizeLabel(value: string, maxLength: number): string {
  return value.replace(/[^A-Z0-9_-]/giu, "_").slice(0, maxLength) || "unknown";
}

function escapeLabel(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"').replace(/\n/gu, "\\n");
}

function trimMap<T>(map: Map<string, T>, maxEntries: number): void {
  while (map.size > maxEntries) {
    const oldest = map.keys().next().value as string | undefined;
    if (!oldest) {
      return;
    }
    map.delete(oldest);
  }
}
