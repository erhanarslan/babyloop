import { applyOpenApiRouteContract } from "./openapi-contracts.js";
import { API_PREFIX } from "@babyloop/config";
import type { FastifySchema } from "fastify";

export type OpenApiSecurityRequirement = Record<string, string[]>;

type OpenApiSchemaMetadata = {
  description?: string;
  hide?: boolean;
  operationId?: string;
  security?: OpenApiSecurityRequirement[];
  summary?: string;
  tags?: string[];
};

export type OpenApiTagDefinition = {
  description: string;
  name: string;
};

export const openApiTags: OpenApiTagDefinition[] = [
  {
    name: "Sistem",
    description: "API sağlık, yetenek ve teknik durum uçları."
  },
  {
    name: "Kimlik Doğrulama",
    description: "Kayıt, giriş, oturum, parola, MFA ve giriş onayı akışları."
  },
  {
    name: "İlanlar",
    description: "İlan oluşturma, görüntüleme, güncelleme ve durum işlemleri."
  },
  {
    name: "İlan Görselleri",
    description: "İlan görseli yükleme, sıralama, silme ve güvenlik kontrolleri."
  },
  {
    name: "Arama ve Kategoriler",
    description: "Kategori, arama önerisi, filtreleme ve ilan önerisi uçları."
  },
  {
    name: "Favoriler",
    description: "Kullanıcının favori ilan işlemleri."
  },
  {
    name: "Paylaşım",
    description: "Kısa link üretme ve ilan paylaşım uçları."
  },
  {
    name: "Mesajlaşma",
    description: "Konuşmalar, mesajlar, okunma durumu ve güvenli iletişim akışları."
  },
  {
    name: "Bildirimler",
    description: "Uygulama içi bildirimler, tercihler ve teslimat durumları."
  },
  {
    name: "Güvenlik",
    description: "Raporlama, engelleme ve kullanıcı güvenliği işlemleri."
  },
  {
    name: "Çocuk Profilleri",
    description: "Çocuk profilleri, yaş dönemleri ve profil önerileri."
  },
  {
    name: "Notlar ve Hatırlatıcılar",
    description: "Çocuk profiline bağlı not ve hatırlatıcı işlemleri."
  },
  {
    name: "Sepet ve Ödeme",
    description: "Sepet ve gerçek tahsilat yapmayan ödeme simülasyonu."
  },
  {
    name: "AI İlan Araçları",
    description: "İlan metni ve fiyat önerisi sağlayan yapay zekâ uçları."
  },
  {
    name: "AI Asistan",
    description: "BabyLoop ebeveyn ve ürün asistanı mesaj uçları."
  },
  {
    name: "RAG",
    description: "Kaynaklı bilgi erişimi ve retrieval uçları."
  },
  {
    name: "Ürün Analitiği",
    description: "Gizlilik sınırları içinde ürün olayı alımı."
  },
  {
    name: "Satıcı Paneli",
    description: "Satıcı ilan performansı ve hesap özetleri."
  },
  {
    name: "Admin Genel Bakış",
    description: "Backoffice dashboard ve operasyon özeti."
  },
  {
    name: "Admin Pazaryeri",
    description: "İlan, görsel ve pazaryeri yönetim uçları."
  },
  {
    name: "Admin Moderasyon",
    description: "Moderasyon vakaları, yaptırım ve hassas erişim işlemleri."
  },
  {
    name: "Admin Kullanıcılar",
    description: "Kullanıcı ve profil yönetim uçları."
  },
  {
    name: "Admin İletişim",
    description: "Email ve bildirim operasyon görünürlüğü."
  },
  {
    name: "Admin Analitik",
    description: "Toplu ve gizlilik güvenli yönetim analitikleri."
  },
  {
    name: "Admin AI ve RAG",
    description: "AI çalıştırmaları, RAG sağlık, eval ve retrieval operasyonları."
  },
  {
    name: "Admin Sistem",
    description: "Storage, audit ve sistem operasyon uçları."
  }
];

const tagDescriptions = new Map(
  openApiTags.map((tag) => [tag.name, tag.description] as const)
);

const publicProtectedPrefixes = [
  "/assistant",
  "/cart",
  "/checkout",
  "/child-profiles",
  "/conversations",
  "/favorites",
  "/notification-preferences",
  "/notifications",
  "/saved-searches",
  "/seller-dashboard"
];

const protectedAuthPrefixes = [
  "/auth/account-deletion",
  "/auth/me",
  "/auth/logout",
  "/auth/refresh",
  "/auth/sessions",
  "/auth/password/change",
  "/auth/mfa/status",
  "/auth/mfa/enable",
  "/auth/mfa/disable",
  "/auth/login-approval/status",
  "/auth/login-approval/preference",
  "/auth/login-approvals"
];

export function buildOpenApiRouteSchema(input: {
  method: string;
  schema?: FastifySchema;
  url: string;
}): FastifySchema {
  const documentedSchema = applyOpenApiRouteContract({
    method: input.method,
    schema: input.schema,
    url: input.url
  });

  const existingSchema = (documentedSchema ?? {}) as FastifySchema &
    OpenApiSchemaMetadata;
  const method = normalizeMethod(input.method);
  const path = normalizePath(input.url);

  if (isDocumentationRoute(path)) {
    return {
      ...existingSchema,
      hide: true
    } as FastifySchema;
  }

  const tag = resolveRouteTag(path);
  const operationId =
    existingSchema.operationId ?? createOperationId(method, path);
  const security =
    existingSchema.security ?? inferSecurityRequirements(method, path);

  return {
    ...existingSchema,
    tags:
      existingSchema.tags && existingSchema.tags.length > 0
        ? existingSchema.tags
        : [tag],
    summary:
      existingSchema.summary ??
      createRouteSummary(method, path, tag),
    description:
      existingSchema.description ??
      createRouteDescription(method, tag),
    operationId,
    ...(security ? { security } : {})
  } as FastifySchema;
}

export function readRouteMethod(route: unknown): string {
  if (!route || typeof route !== "object") {
    return "GET";
  }

  const method = Reflect.get(route, "method");

  if (Array.isArray(method)) {
    const firstMethod = method.find((value) => typeof value === "string");

    return typeof firstMethod === "string" ? firstMethod : "GET";
  }

  return typeof method === "string" ? method : "GET";
}

function resolveRouteTag(path: string): string {
  const relativePath = stripApiPrefix(path);

  if (path === "/health" || relativePath.startsWith("/meta/")) {
    return "Sistem";
  }

  if (relativePath.startsWith("/admin/dashboard")) {
    return "Admin Genel Bakış";
  }

  if (
    relativePath.startsWith("/admin/listings") ||
    relativePath.startsWith("/admin/categories") ||
    relativePath.startsWith("/admin/orders") ||
    relativePath.startsWith("/admin/payments")
  ) {
    return "Admin Pazaryeri";
  }

  if (
    relativePath.startsWith("/admin/moderation") ||
    relativePath.startsWith("/admin/conversations")
  ) {
    return "Admin Moderasyon";
  }

  if (relativePath.startsWith("/admin/profiles")) {
    return "Admin Kullanıcılar";
  }

  if (
    relativePath.startsWith("/admin/email") ||
    relativePath.startsWith("/admin/notifications")
  ) {
    return "Admin İletişim";
  }

  if (
    relativePath.startsWith("/admin/analytics") ||
    relativePath.startsWith("/admin/product-analytics")
  ) {
    return "Admin Analitik";
  }

  if (
    relativePath.startsWith("/admin/rag") ||
    relativePath.startsWith("/admin/ai-ops")
  ) {
    return "Admin AI ve RAG";
  }

  if (
    relativePath.startsWith("/admin/audit") ||
    relativePath.startsWith("/admin/storage")
  ) {
    return "Admin Sistem";
  }

  if (relativePath.startsWith("/auth")) {
    return "Kimlik Doğrulama";
  }

  if (relativePath.startsWith("/ai/")) {
    return "AI İlan Araçları";
  }

  if (relativePath.startsWith("/assistant")) {
    return "AI Asistan";
  }

  if (relativePath.startsWith("/rag")) {
    return "RAG";
  }

  if (
    relativePath.startsWith("/listings") ||
    relativePath.startsWith("/profiles/")
  ) {
    return "İlanlar";
  }

  if (relativePath.startsWith("/uploads")) {
    return "İlan Görselleri";
  }

  if (
    relativePath.startsWith("/categories") ||
    relativePath.startsWith("/search-suggestions") ||
    relativePath.startsWith("/listing-recommendations")
  ) {
    return "Arama ve Kategoriler";
  }

  if (relativePath.startsWith("/favorites")) {
    return "Favoriler";
  }

  if (relativePath.startsWith("/share-links")) {
    return "Paylaşım";
  }

  if (
    relativePath.startsWith("/conversations") ||
    relativePath.startsWith("/messages")
  ) {
    return "Mesajlaşma";
  }

  if (
    relativePath.startsWith("/notifications") ||
    relativePath.startsWith("/notification-preferences")
  ) {
    return "Bildirimler";
  }

  if (
    relativePath.startsWith("/safety") ||
    relativePath.startsWith("/reports") ||
    relativePath.startsWith("/blocked")
  ) {
    return "Güvenlik";
  }

  if (relativePath.includes("/notes") || relativePath.includes("/reminders")) {
    return "Notlar ve Hatırlatıcılar";
  }

  if (relativePath.startsWith("/child-profiles")) {
    return "Çocuk Profilleri";
  }

  if (
    relativePath.startsWith("/cart") ||
    relativePath.startsWith("/checkout") ||
    relativePath.startsWith("/payments")
  ) {
    return "Sepet ve Ödeme";
  }

  if (
    relativePath.startsWith("/analytics") ||
    relativePath.startsWith("/product-events")
  ) {
    return "Ürün Analitiği";
  }

  if (relativePath.startsWith("/seller-dashboard")) {
    return "Satıcı Paneli";
  }

  return "Sistem";
}

function inferSecurityRequirements(
  method: string,
  path: string
): OpenApiSecurityRequirement[] | undefined {
  const relativePath = stripApiPrefix(path);
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (relativePath.startsWith("/admin/")) {
    if (mutation) {
      return [
        {
          backofficeCookieAuth: [],
          csrfHeader: []
        },
        {
          bearerAuth: []
        }
      ];
    }

    return [
      {
        backofficeCookieAuth: []
      },
      {
        bearerAuth: []
      }
    ];
  }

  const isProtectedAuthRoute = protectedAuthPrefixes.some((prefix) =>
    relativePath.startsWith(prefix)
  );

  const isProtectedPublicRoute =
    isProtectedAuthRoute ||
    publicProtectedPrefixes.some((prefix) =>
      relativePath.startsWith(prefix)
    ) ||
    (relativePath.startsWith("/listings") && mutation) ||
    relativePath.startsWith("/uploads");

  if (!isProtectedPublicRoute) {
    return undefined;
  }

  if (mutation) {
    return [
      {
        publicCookieAuth: [],
        csrfHeader: []
      },
      {
        bearerAuth: []
      }
    ];
  }

  return [
    {
      publicCookieAuth: []
    },
    {
      bearerAuth: []
    }
  ];
}

function createRouteSummary(
  method: string,
  path: string,
  tag: string
): string {
  const action = getMethodAction(method);
  const resource = humanizePath(path);

  return resource ? `${action}: ${resource}` : `${action}: ${tag}`;
}

function createRouteDescription(method: string, tag: string): string {
  const tagDescription =
    tagDescriptions.get(tag) ?? "BabyLoop API işlemi.";

  if (method === "GET") {
    return `${tagDescription} Bu uç yalnız okuma işlemi gerçekleştirir.`;
  }

  if (method === "DELETE") {
    return `${tagDescription} Bu uç silme veya iptal işlemi gerçekleştirir; gerekli kimlik doğrulama ve güvenlik kontrolleri uygulanır.`;
  }

  return `${tagDescription} Bu uç veri değiştirebilir; gerekli kimlik doğrulama, CSRF, doğrulama ve iş kuralları uygulanır.`;
}

function createOperationId(method: string, path: string): string {
  const relativePath = stripApiPrefix(path);
  const parts = relativePath
    .split("/")
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith(":")) {
        return `By${toPascalCase(part.slice(1))}`;
      }

      return toPascalCase(part);
    });

  const suffix = parts.length > 0 ? parts.join("") : "Root";

  return `${method.toLowerCase()}${suffix}`;
}

function humanizePath(path: string): string {
  return stripApiPrefix(path)
    .split("/")
    .filter(Boolean)
    .filter((part) => !part.startsWith(":"))
    .slice(-3)
    .map((part) =>
      part
        .replace(/[-_]+/gu, " ")
        .replace(/\b\p{L}/gu, (character) =>
          character.toLocaleUpperCase("tr-TR")
        )
    )
    .join(" / ");
}

function getMethodAction(method: string): string {
  switch (method) {
    case "GET":
      return "Getir";
    case "POST":
      return "Oluştur veya çalıştır";
    case "PUT":
      return "Değiştir";
    case "PATCH":
      return "Güncelle";
    case "DELETE":
      return "Sil veya iptal et";
    default:
      return "İşle";
  }
}

function stripApiPrefix(path: string): string {
  if (!path.startsWith(API_PREFIX)) {
    return path;
  }

  const relativePath = path.slice(API_PREFIX.length);

  return relativePath || "/";
}

function normalizePath(url: string): string {
  const [path] = url.split("?");

  return path || "/";
}

function normalizeMethod(method: string): string {
  return method.trim().toUpperCase() || "GET";
}

function isDocumentationRoute(path: string): boolean {
  return path === "/docs" || path.startsWith("/docs/");
}

function toPascalCase(value: string): string {
  return value
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`
    )
    .join("");
}
