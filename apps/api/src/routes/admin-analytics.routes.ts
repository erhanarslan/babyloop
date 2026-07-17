import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { adminAnalyticsQuerySchema } from "../schemas/admin-analytics.schemas.js";
import { requireBackofficePermission } from "../services/admin-context.service.js";
import {
  getAdminAnalyticsDataQuality,
  getAdminAnalyticsOverview,
  listAdminAnalyticsAuth,
  listAdminAnalyticsCategories,
  listAdminAnalyticsPages,
  type AdminAnalyticsQuery,
  type AdminAnalyticsAuthRow,
  type AdminAnalyticsCategoryRow,
  type AdminAnalyticsDataQuality,
  type AdminAnalyticsOverview,
  type AdminAnalyticsPageRow
} from "../services/admin-analytics.service.js";

type OverviewResponse = ApiResponse<{ overview: AdminAnalyticsOverview }>;
type AuthResponse = ApiResponse<{ auth: AdminAnalyticsAuthRow[] }>;
type PagesResponse = ApiResponse<{ pages: AdminAnalyticsPageRow[] }>;
type CategoriesResponse = ApiResponse<{ categories: AdminAnalyticsCategoryRow[] }>;
type DataQualityResponse = ApiResponse<{ dataQuality: AdminAnalyticsDataQuality }>;

export function registerAdminAnalyticsRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: unknown; Reply: OverviewResponse | ApiFailure }>(
    "/admin/analytics/overview",
    async (request, reply) => {
      const query = parseAdminAnalyticsQuery(request.query, reply);

      if (!query) {
        return reply;
      }

      const admin = await requireBackofficePermission(app, request, reply, "dashboard_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          overview: await getAdminAnalyticsOverview(app, query)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: AuthResponse | ApiFailure }>(
    "/admin/analytics/auth",
    async (request, reply) => {
      const query = parseAdminAnalyticsQuery(request.query, reply);

      if (!query) {
        return reply;
      }

      const admin = await requireBackofficePermission(app, request, reply, "dashboard_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          auth: await listAdminAnalyticsAuth(app, query)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: PagesResponse | ApiFailure }>(
    "/admin/analytics/pages",
    async (request, reply) => {
      const query = parseAdminAnalyticsQuery(request.query, reply);

      if (!query) {
        return reply;
      }

      const admin = await requireBackofficePermission(app, request, reply, "dashboard_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          pages: await listAdminAnalyticsPages(app, query)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: CategoriesResponse | ApiFailure }>(
    "/admin/analytics/categories",
    async (request, reply) => {
      const query = parseAdminAnalyticsQuery(request.query, reply);

      if (!query) {
        return reply;
      }

      const admin = await requireBackofficePermission(app, request, reply, "dashboard_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          categories: await listAdminAnalyticsCategories(app, query)
        }
      };
    }
  );

  app.get<{ Reply: DataQualityResponse | ApiFailure }>(
    "/admin/analytics/data-quality",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "dashboard_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          dataQuality: await getAdminAnalyticsDataQuality(app)
        }
      };
    }
  );
}

function parseAdminAnalyticsQuery(query: unknown, reply: FastifyReply): AdminAnalyticsQuery | null {
  const parsed = adminAnalyticsQuerySchema.safeParse(query);

  if (!parsed.success) {
    reply.status(400).send({
      ok: false,
      error: {
        code: "INVALID_ANALYTICS_QUERY",
        message: "Analytics query is invalid."
      }
    });
    return null;
  }

  const normalizedQuery: AdminAnalyticsQuery = {};

  if (parsed.data.from) {
    normalizedQuery.from = parsed.data.from;
  }

  if (parsed.data.to) {
    normalizedQuery.to = parsed.data.to;
  }

  if (parsed.data.platform) {
    normalizedQuery.platform = parsed.data.platform;
  }

  return normalizedQuery;
}
