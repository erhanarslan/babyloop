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
      note: "Yerel sürücü için API dosya akışı rotası etkin kalır. S3/R2 sürücüsü tam herkese açık URL döndürür."
    },
    warning:
      "Bu uç nokta kimlik bilgisi veya gizli değer döndürmez. Yalnız etkin depolama sürücüsünü gösterir."
  };
}
