import type { FastifyInstance } from "fastify";
import { getImageStorageConfigPreview } from "./image-storage.service.js";

export type AdminStorageOpsPreview = {
  imageStorage: ReturnType<typeof getImageStorageConfigPreview>;
  uploadRoute: {
    localRouteEnabled: true;
    routePrefix: "/api/v1/uploads/listings";
    note: string;
  };
  warning: string;
};

export async function getAdminStorageOpsPreview(_app: FastifyInstance): Promise<AdminStorageOpsPreview> {
  return {
    imageStorage: getImageStorageConfigPreview(),
    uploadRoute: {
      localRouteEnabled: true,
      routePrefix: "/api/v1/uploads/listings",
      note: "Local driver için API dosya stream route'u aktif kalır. S3/R2 driver absolute public URL döndürür."
    },
    warning:
      "Bu endpoint credential veya secret döndürmez. Sadece hangi storage driver'ın aktif olduğunu gösterir."
  };
}
