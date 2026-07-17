import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { adminAnalyticsQuerySchema } from "../schemas/admin-analytics.schemas.js";
import { requireBackofficePermission } from "../services/admin-context.service.js";
import {
  getAdminAnalyticsDataQuality,
  getAdminAnalyticsAssistant,
  getAdminAnalyticsChild,
  getAdminAnalyticsEngagement,
  getAdminAnalyticsFunnels,
  getAdminAnalyticsMarketplace,
  getAdminAnalyticsMessaging,
  getAdminAnalyticsOverview,
  getAdminAnalyticsUsers,
  listAdminAnalyticsAuth,
  listAdminAnalyticsCategories,
  listAdminAnalyticsPages,
  type AdminAnalyticsQuery,
  type AdminAnalyticsAuthRow,
  type AdminAnalyticsCategoryRow,
  type AdminAnalyticsDataQuality,
  type AdminAnalyticsOverview,
  type AdminAnalyticsPageRow,
  type AdminAnalyticsSection
} from "../services/admin-analytics.service.js";

type OverviewResponse = ApiResponse<{ overview: AdminAnalyticsOverview }>;
type AuthResponse = ApiResponse<{ auth: AdminAnalyticsAuthRow[] }>;
type PagesResponse = ApiResponse<{ pages: AdminAnalyticsPageRow[] }>;
type CategoriesResponse = ApiResponse<{ categories: AdminAnalyticsCategoryRow[] }>;
type DataQualityResponse = ApiResponse<{ dataQuality: AdminAnalyticsDataQuality }>;
type SectionResponse = ApiResponse<{ section: AdminAnalyticsSection }>;
type EngagementResponse = ApiResponse<{
  engagement: Awaited<ReturnType<typeof getAdminAnalyticsEngagement>>;
}>;
type MarketplaceResponse = ApiResponse<{
  marketplace: Awaited<ReturnType<typeof getAdminAnalyticsMarketplace>>;
}>;
type FunnelsResponse = ApiResponse<{
  funnels: Awaited<ReturnType<typeof getAdminAnalyticsFunnels>>;
}>;

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

  app.get<{ Querystring: unknown; Reply: SectionResponse | ApiFailure }>(
    "/admin/analytics/users",
    async (request, reply) => {
      const query = await parseAuthorizedAdminAnalyticsQuery(app, request.query, reply, request);

      if (!query) {
        return reply;
      }

      return {
        ok: true,
        data: {
          section: await getAdminAnalyticsUsers(app, query)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: EngagementResponse | ApiFailure }>(
    "/admin/analytics/engagement",
    async (request, reply) => {
      const query = await parseAuthorizedAdminAnalyticsQuery(app, request.query, reply, request);

      if (!query) {
        return reply;
      }

      return {
        ok: true,
        data: {
          engagement: await getAdminAnalyticsEngagement(app, query)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: MarketplaceResponse | ApiFailure }>(
    "/admin/analytics/marketplace",
    async (request, reply) => {
      const query = await parseAuthorizedAdminAnalyticsQuery(app, request.query, reply, request);

      if (!query) {
        return reply;
      }

      return {
        ok: true,
        data: {
          marketplace: await getAdminAnalyticsMarketplace(app, query)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: SectionResponse | ApiFailure }>(
    "/admin/analytics/messaging",
    async (request, reply) => {
      const query = await parseAuthorizedAdminAnalyticsQuery(app, request.query, reply, request);

      if (!query) {
        return reply;
      }

      return {
        ok: true,
        data: {
          section: await getAdminAnalyticsMessaging(app, query)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: SectionResponse | ApiFailure }>(
    "/admin/analytics/assistant",
    async (request, reply) => {
      const query = await parseAuthorizedAdminAnalyticsQuery(app, request.query, reply, request);

      if (!query) {
        return reply;
      }

      return {
        ok: true,
        data: {
          section: await getAdminAnalyticsAssistant(app, query)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: SectionResponse | ApiFailure }>(
    "/admin/analytics/child",
    async (request, reply) => {
      const query = await parseAuthorizedAdminAnalyticsQuery(app, request.query, reply, request);

      if (!query) {
        return reply;
      }

      return {
        ok: true,
        data: {
          section: await getAdminAnalyticsChild(app, query)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: FunnelsResponse | ApiFailure }>(
    "/admin/analytics/funnels",
    async (request, reply) => {
      const query = await parseAuthorizedAdminAnalyticsQuery(app, request.query, reply, request);

      if (!query) {
        return reply;
      }

      return {
        ok: true,
        data: {
          funnels: await getAdminAnalyticsFunnels(app, query)
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

async function parseAuthorizedAdminAnalyticsQuery(
  app: FastifyInstance,
  queryInput: unknown,
  reply: FastifyReply,
  request: FastifyRequest
): Promise<AdminAnalyticsQuery | null> {
  const query = parseAdminAnalyticsQuery(queryInput, reply);

  if (!query) {
    return null;
  }

  const admin = await requireBackofficePermission(app, request, reply, "dashboard_view");

  return admin ? query : null;
}
