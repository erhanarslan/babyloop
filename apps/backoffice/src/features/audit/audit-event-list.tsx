"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  type AdminAuditEvent,
  type AdminAuditSort,
  listAdminAuditEvents,
} from "./api";

type AuditFilters = {
  eventType: string;
  entityType: string;
  q: string;
  sort: AdminAuditSort;
  limit: number;
};

const defaultFilters: AuditFilters = {
  eventType: "",
  entityType: "",
  q: "",
  sort: "newest",
  limit: 50,
};

export function AuditEventList() {
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilters>(defaultFilters);
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadEvents() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await listAdminAuditEvents({
        ...(appliedFilters.eventType ? { eventType: appliedFilters.eventType } : {}),
        ...(appliedFilters.entityType ? { entityType: appliedFilters.entityType } : {}),
        ...(appliedFilters.q ? { q: appliedFilters.q } : {}),
        sort: appliedFilters.sort,
        limit: appliedFilters.limit,
      });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setEvents([]);
        setErrorMessage(getApiErrorMessage(response, "Could not load audit events."));
        setIsLoading(false);
        return;
      }

      setEvents(response.data.events);
      setIsLoading(false);
    }

    void loadEvents();

    return () => {
      isActive = false;
    };
  }, [appliedFilters]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      ...filters,
      eventType: filters.eventType.trim(),
      entityType: filters.entityType.trim(),
      q: filters.q.trim(),
    });
  }

  function handleReset() {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  }

  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">Trust & Safety</p>
        <h2>Audit events</h2>
        <p>
          Safe audit visibility for admin actions. Metadata is allowlisted and
          excludes raw reasons, emails, message bodies, tokens, and private objects.
        </p>
      </section>

      <form className="filter-panel" onSubmit={handleSubmit}>
        <div className="filter-grid">
          <label className="form-field">
            <span>Event type</span>
            <input
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  eventType: event.target.value,
                }))
              }
              placeholder="admin_profile_enforcement_applied"
              value={filters.eventType}
            />
          </label>

          <label className="form-field">
            <span>Entity type</span>
            <input
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  entityType: event.target.value,
                }))
              }
              placeholder="moderation_case"
              value={filters.entityType}
            />
          </label>

          <label className="form-field">
            <span>Safe search</span>
            <input
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="ID or event type"
              value={filters.q}
            />
          </label>

          <label className="form-field">
            <span>Sort</span>
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  sort: event.target.value as AdminAuditSort,
                }))
              }
              value={filters.sort}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>

          <label className="form-field">
            <span>Limit</span>
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  limit: Number(event.target.value),
                }))
              }
              value={filters.limit}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        <div className="filter-actions">
          <button className="primary-action" type="submit">
            Apply filters
          </button>
          <button className="secondary-action" onClick={handleReset} type="button">
            Reset
          </button>
        </div>
      </form>

      {isLoading ? <div className="state-panel">Loading audit events...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && events.length === 0 ? (
        <div className="state-panel">No audit events match these filters.</div>
      ) : null}

      {events.length > 0 ? (
        <section className="timeline" aria-label="Audit events">
          {events.map((event) => (
            <article className="timeline-item audit_event" key={event.id}>
              <div>
                <strong>{formatEventType(event.eventType)}</strong>
                <p>
                  {event.entityType} · {event.entityId}
                </p>
              </div>

              <dl className="compact-details">
                <div>
                  <dt>Actor profile</dt>
                  <dd>{event.actorProfileId ?? "System"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(event.createdAt)}</dd>
                </div>
              </dl>

              {Object.keys(event.metadata).length > 0 ? (
                <div className="metadata-chip-row">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <span className="metadata-chip" key={`${event.id}:${key}`}>
                      <strong>{formatMetadataKey(key)}</strong>
                      {formatMetadataValue(value)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">No safe metadata for this event.</p>
              )}

              <div className="filter-actions">
                {getSafeResourceLinks(event).map((link) => (
                  <Link className="secondary-action" href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}

function getSafeResourceLinks(event: AdminAuditEvent): Array<{ href: string; label: string }> {
  const links: Array<{ href: string; label: string }> = [];
  const caseId = getStringMetadata(event.metadata.caseId);
  const listingId = getStringMetadata(event.metadata.listingId);

  if (event.entityType === "moderation_case") {
    links.push({
      href: `/moderation/${event.entityId}`,
      label: "Open case",
    });
  }

  if (caseId && event.entityType !== "moderation_case") {
    links.push({
      href: `/moderation/${caseId}`,
      label: "Open case",
    });
  }

  if (event.entityType === "listing") {
    links.push({
      href: `/listings/${event.entityId}`,
      label: "Open listing",
    });
  }

  if (listingId && event.entityType !== "listing") {
    links.push({
      href: `/listings/${listingId}`,
      label: "Open listing",
    });
  }

  return links;
}

function getStringMetadata(
  value: string | number | boolean | string[] | null | undefined,
): string | null {
  return typeof value === "string" ? value : null;
}

function formatEventType(eventType: string): string {
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetadataKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function formatMetadataValue(
  value: string | number | boolean | string[] | null,
): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value === null) {
    return "none";
  }

  return String(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}
