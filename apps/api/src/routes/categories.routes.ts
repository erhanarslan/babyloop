import { productCategories } from "@babyloop/database/schema";
import type { ApiResponse } from "@babyloop/shared";
import { asc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

type CategoryResponse = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};

type CategoriesResponse = ApiResponse<{
  categories: CategoryResponse[];
}>;

export function registerCategoryRoutes(app: FastifyInstance): void {
  app.get<{ Reply: CategoriesResponse }>("/categories", async (_request, reply) => {
    const rows = await app.db
      .select({
        id: productCategories.id,
        name: productCategories.name,
        slug: productCategories.slug,
        parentId: productCategories.parentId
      })
      .from(productCategories)
      .orderBy(asc(productCategories.name));

    reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");

    return {
      ok: true,
      data: {
        categories: rows
      }
    };
  });
}
