import { z } from "zod";

export const favoriteBodySchema = z
  .object({
    listing_id: z.string().uuid()
  })
  .strict();

export const favoriteProfileParamsSchema = z.object({
  profileId: z.string().uuid()
});

export type FavoriteBody = z.infer<typeof favoriteBodySchema>;

