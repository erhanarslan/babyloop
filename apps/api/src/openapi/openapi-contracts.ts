import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
type JsonSchema = Record<string, unknown>;

type RouteContract = {
  body?: JsonSchema;
  consumes?: string[];
  params?: JsonSchema;
  querystring?: JsonSchema;
  replaceDefaultResponses?: boolean;
  response?: Record<string, JsonSchema>;
  security?: Array<Record<string, string[]>>;
};

type ApplyOpenApiRouteContractInput = {
  method: unknown;
  schema: unknown;
  url: string;
};

const UUID_EXAMPLE = "11111111-1111-4111-8111-111111111111";
const SECOND_UUID_EXAMPLE = "22222222-2222-4222-8222-222222222222";

const listingTypeValues = ["sale", "swap", "donation"] as const;
const listingConditionValues = [
  "new",
  "like_new",
  "good",
  "fair",
  "needs_repair"
] as const;
const listingStatusValues = ["active", "reserved", "sold", "archived"] as const;

const childAgeBandValues = [
  "expecting",
  "newborn_0_3",
  "infant_3_6",
  "infant_6_12",
  "toddler_12_24",
  "preschool_24_36",
  "child_3_plus"
] as const;

const childNoteTypeValues = [
  "general",
  "feeding",
  "diaper",
  "sleep",
  "activity",
  "shopping",
  "health_note",
  "size",
  "preference",
  "daycare",
  "milestone"
] as const;

const childReminderTypeValues = [
  "feeding",
  "diaper",
  "sleep",
  "activity",
  "shopping",
  "appointment",
  "general"
] as const;

const childReminderScheduleValues = [
  "one_time",
  "interval",
  "daily",
  "weekly",
  "relative_before_event"
] as const;

const notificationSourceValues = [
  "child_reminder",
  "child_note",
  "saved_search",
  "child_lifecycle",
  "marketplace",
  "messages",
  "message",
  "listing",
  "security",
  "marketing",
  "trust_safety"
] as const;

const notificationChannelValues = [
  "in_app",
  "email",
  "push",
  "n8n",
  "sms"
] as const;

const BODY_CONTRACTS: Record<string, JsonSchema> = {};
const QUERY_CONTRACTS: Record<string, JsonSchema> = {};
const ROUTE_CONTRACTS: Record<string, RouteContract> = {};

registerCoreBodyContracts();
registerMarketplaceBodyContracts();
registerChildAndNotificationBodyContracts();
registerAdminBodyContracts();
registerQueryContracts();
registerSpecialContracts();

export function applyOpenApiRouteContract(
  input: ApplyOpenApiRouteContractInput
): JsonSchema {
  const method = normalizeMethod(input.method);
  const path = normalizeRoutePath(input.url);
  const key = `${method} ${path}`;

  const existing = isRecord(input.schema) ? input.schema : {};
  const routeContract = ROUTE_CONTRACTS[key] ?? {};
  const {
    replaceDefaultResponses = false,
    ...documentedRouteContract
  } = routeContract;
  const documentedBody = BODY_CONTRACTS[key] ?? routeContract.body;
  const documentedQuery = QUERY_CONTRACTS[key] ?? routeContract.querystring;
  const inferredParams = createPathParamsSchema(path);

  const params = mergeObjectSchemas(
    inferredParams,
    routeContract.params,
    existing.params
  );
  const querystring = mergeObjectSchemas(
    documentedQuery,
    routeContract.querystring,
    existing.querystring
  );

  const body = existing.body ?? documentedBody;
  const response = mergeResponses(
    replaceDefaultResponses ? undefined : defaultResponses(path),
    routeContract.response,
    existing.response
  );

  return removeUndefinedValues({
    ...documentedRouteContract,
    ...existing,
    ...(params ? { params } : {}),
    ...(querystring ? { querystring } : {}),
    ...(body ? { body } : {}),
    response
  });
}

function registerCoreBodyContracts(): void {
  addBody(
    "POST",
    "/auth/register",
    objectSchema(
      {
        email: emailSchema("erhan@example.test"),
        password: stringSchema({
          description: "En az 8 karakterlik kullanıcı parolası.",
          example: "BabyLoop123!",
          maxLength: 128,
          minLength: 8
        }),
        displayName: stringSchema({
          example: "Erhan",
          maxLength: 120,
          minLength: 2
        }),
        locationCity: stringSchema({
          example: "İstanbul",
          maxLength: 120,
          nullable: true
        }),
        termsAccepted: {
          type: "boolean",
          const: true,
          description: "Kullanım Koşulları'nın aktif kullanıcı eylemiyle kabul edildiğini gösterir."
        },
        termsVersion: {
          type: "string",
          const: CURRENT_TERMS_VERSION,
          example: CURRENT_TERMS_VERSION,
          description: "Kabul edilen Kullanım Koşulları sürümü."
        }
      },
      ["email", "password", "displayName", "termsAccepted", "termsVersion"],
      {
        description: "Yeni BabyLoop kullanıcı hesabı oluşturur."
      }
    )
  );

  const publicLoginBody = objectSchema(
    {
      email: emailSchema("erhan@example.test"),
      password: stringSchema({
        example: "BabyLoop123!",
        maxLength: 128,
        minLength: 1
      }),
      clientType: {
          ...enumSchema(["web", "mobile", "backoffice"], {
            example: "mobile"
          }),
          description:
            "Swagger testi için mobile seçildiğinde web login approval beklenmeden normal kullanıcı oturumu açılır. Alan gönderilmezse API varsayılan olarak web kabul eder."
        }
    },
    ["email", "password"],
    {
      description:
        "Kullanıcı girişi yapar. Web girişleri mobil onay akışına yönlenebilir."
    }
  );

  addBody("POST", "/auth/login", publicLoginBody);
  addBody(
    "POST",
    "/auth/backoffice/login",
    objectSchema(
      {
        email: emailSchema("admin@example.test"),
        password: stringSchema({
          example: "BabyLoop123!",
          maxLength: 128,
          minLength: 1
        })
      },
      ["email", "password"],
      {
        description:
          "Yetkili ekip rollerine staff, normal kullanıcılara server-side salt okunur preview scope’lu cookie oturumu açar."
      }
    )
  );

  addBody(
    "POST",
    "/auth/mfa/verify",
    objectSchema(
      {
        challengeId: uuidSchema("MFA challenge kimliği"),
        code: stringSchema({
          description: "Altı haneli tek kullanımlık kod.",
          example: "123456",
          maxLength: 6,
          minLength: 6,
          pattern: "^\\d{6}$"
        })
      },
      ["challengeId", "code"]
    )
  );

  addBody(
    "POST",
    "/auth/login-approval/complete",
    objectSchema(
      {
        approvalToken: stringSchema({
          description: "Onaylanan web girişine ait tek kullanımlık token.",
          example: "approval-token-value-with-at-least-32-characters",
          maxLength: 512,
          minLength: 32
        })
      },
      ["approvalToken"]
    )
  );

  const passwordPreferenceBody = objectSchema(
    {
      currentPassword: stringSchema({
        example: "BabyLoop123!",
        maxLength: 128,
        minLength: 1
      })
    },
    ["currentPassword"]
  );

  for (const path of [
    "/auth/mfa/enable",
    "/auth/mfa/disable",
    "/auth/login-approval/enable",
    "/auth/login-approval/disable",
    "/auth/sessions/revoke-all"
  ]) {
    addBody("POST", path, passwordPreferenceBody);
  }

  addBody(
    "POST",
    "/auth/password-reset/request",
    objectSchema(
      {
        email: emailSchema("erhan@example.test")
      },
      ["email"]
    )
  );

  addBody(
    "POST",
    "/auth/password-reset/confirm",
    objectSchema(
      {
        token: stringSchema({
          example: "password-reset-token",
          maxLength: 512,
          minLength: 16
        }),
        password: stringSchema({
          example: "YeniBabyLoop123!",
          maxLength: 128,
          minLength: 8
        })
      },
      ["token", "password"]
    )
  );

  addBody(
    "POST",
    "/auth/password/change",
    objectSchema(
      {
        currentPassword: stringSchema({
          example: "BabyLoop123!",
          maxLength: 128,
          minLength: 1
        }),
        newPassword: stringSchema({
          example: "YeniBabyLoop123!",
          maxLength: 128,
          minLength: 8
        })
      },
      ["currentPassword", "newPassword"]
    )
  );

  addBody(
    "POST",
    "/auth/account-deletion/request",
    objectSchema(
      {
        currentPassword: stringSchema({
          description:
            "Parola sağlayıcısı bağlı hesaplarda zorunludur. Google-only hesaplarda gönderilmez.",
          example: "BabyLoop123!",
          maxLength: 128,
          minLength: 1
        })
      },
      [],
      {
        description:
          "Kalıcı hesap silme işleminden önce e-posta güvenlik kodu üretir. Aynı kullanıcıya ait önceki kullanılmamış hesap silme kodları geçersiz olur."
      }
    )
  );

  addBody(
    "POST",
    "/auth/account-deletion/confirm",
    objectSchema(
      {
        challengeId: uuidSchema("Hesap silme güvenlik kodu challenge kimliği"),
        code: stringSchema({
          description: "E-posta ile gönderilen altı haneli tek kullanımlık kod.",
          example: "123456",
          maxLength: 6,
          minLength: 6,
          pattern: "^\\d{6}$"
        }),
        confirmation: enumSchema(["HESABIMI SİL"], {
          example: "HESABIMI SİL"
        })
      },
      ["challengeId", "code", "confirmation"],
      {
        description:
          "Hesabı siler, oturumları iptal eder, özel kullanıcı verilerini temizler, pazaryeri geçmişini anonim profil ile korur ve görsel storage temizliğini dayanıklı iş kuyruğuna yazar."
      }
    )
  );

  addBody(
    "POST",
    "/auth/email-verification/request",
    objectSchema(
      {
        email: emailSchema("erhan@example.test")
      },
      ["email"]
    )
  );

  addBody(
    "POST",
    "/auth/email-verification/confirm",
    objectSchema(
      {
        token: stringSchema({
          example: "email-verification-token",
          maxLength: 512,
          minLength: 16
        })
      },
      ["token"]
    )
  );

  addBody(
    "POST",
    "/assistant/messages",
    objectSchema(
      {
        message: stringSchema({
          description: "BabyLoop Assistant'a gönderilecek mesaj.",
          example: "24-36 ay için ikinci el oyuncak seçerken nelere bakmalıyım?",
          maxLength: 1000,
          minLength: 1
        }),
        locale: enumSchema(["tr", "en"], {
          defaultValue: "tr",
          example: "tr"
        })
      },
      ["message"]
    )
  );

  addBody(
    "POST",
    "/assistant/chat",
    objectSchema(
      {
        mode: enumSchema(
          [
            "find_products",
            "sell_help",
            "age_needs",
            "safe_buying",
            "platform_help"
          ],
          {
            example: "find_products"
          }
        ),
        content: stringSchema({
          example: "İstanbul'da 2 yaş için uygun oyuncak ilanlarını bul.",
          maxLength: 1000,
          minLength: 1
        })
      },
      ["mode", "content"]
    )
  );

  addBody(
    "POST",
    "/rag/search",
    objectSchema(
      {
        query: stringSchema({
          example: "İkinci el bebek arabası alırken nelere dikkat etmeliyim?",
          maxLength: 1000,
          minLength: 1
        }),
        limit: integerSchema({
          defaultValue: 5,
          example: 5,
          maximum: 10,
          minimum: 1
        })
      },
      ["query"]
    )
  );

  addBody(
    "POST",
    "/analytics/events/batch",
    objectSchema(
      {
        events: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: objectSchema(
            {
              eventName: stringSchema({
                example: "listing_detail_viewed",
                maxLength: 120,
                minLength: 1
              }),
              occurredAt: dateTimeSchema("2030-01-01T10:00:00.000Z"),
              sessionId: stringSchema({
                example: "session-example",
                maxLength: 160,
                minLength: 1
              }),
              platform: enumSchema(["web", "mobile"], {
                example: "web"
              }),
              properties: {
                type: "object",
                additionalProperties: true
              }
            },
            ["eventName", "occurredAt", "sessionId", "platform"]
          )
        }
      },
      ["events"]
    )
  );

  addBody(
    "POST",
    "/product-events",
    productEventBodyContract()
  );
}

function registerMarketplaceBodyContracts(): void {
  const listingCreateBody = objectSchema(
    {
      categoryId: uuidSchema("Ürün kategorisi", UUID_EXAMPLE),
      title: stringSchema({
        example: "Temiz kullanılmış bebek arabası",
        maxLength: 160,
        minLength: 4
      }),
      description: stringSchema({
        example:
          "Ürün temiz durumdadır. Katlanma mekanizması ve frenleri çalışmaktadır.",
        maxLength: 2000
      }),
      priceAmount: optionalDecimalInputSchema("6500"),
      currency: currencyCodeSchema("TRY"),
      listingType: enumSchema(listingTypeValues, {
        example: "sale"
      }),
      condition: enumSchema(listingConditionValues, {
        example: "good"
      }),
      recommendedAgeMinMonths: integerSchema({
        example: 12,
        maximum: 216,
        minimum: 0,
        nullable: true
      }),
      recommendedAgeMaxMonths: integerSchema({
        example: 24,
        maximum: 216,
        minimum: 0,
        nullable: true
      })
    },
    ["categoryId", "title", "listingType", "condition"],
    {
      description:
        "İlan taslak olarak oluşturulur ve yayın kontrol sürecine girer. Yaş aralığı alanları birlikte gönderilir; ikisinin null olması yaştan bağımsız anlamına gelir. priceAmount opsiyoneldir; boş metin fiyatı null olarak kaydeder. currency gönderilmezse TRY kullanılır."
    }
  );

  addBody("POST", "/listings", listingCreateBody);

  addBody(
    "PATCH",
    "/listings/:id",
    objectSchema(
      {
        categoryId: uuidSchema("Yeni kategori kimliği"),
        title: stringSchema({
          example: "Güncellenmiş ilan başlığı",
          maxLength: 160,
          minLength: 4
        }),
        description: stringSchema({
          example: "Güncellenmiş ilan açıklaması.",
          maxLength: 2000
        }),
        priceAmount: optionalDecimalInputSchema("6000"),
        currency: currencyCodeSchema("TRY"),
        listingType: enumSchema(listingTypeValues),
        condition: enumSchema(listingConditionValues),
        recommendedAgeMinMonths: integerSchema({
          example: 12,
          maximum: 216,
          minimum: 0,
          nullable: true
        }),
        recommendedAgeMaxMonths: integerSchema({
          example: 24,
          maximum: 216,
          minimum: 0,
          nullable: true
        })
      },
      [],
      {
        description:
          "Gönderilen alanlar güncellenir ve en az bir alan gerekir. Yaş aralığı değiştirilirken minimum ve maksimum birlikte gönderilir. priceAmount için boş metin mevcut fiyatı null yapar."
      }
    )
  );

  addBody(
    "PATCH",
    "/listings/:id/status",
    objectSchema(
      {
        status: enumSchema(listingStatusValues, {
          example: "sold"
        })
      },
      ["status"]
    )
  );

  addBody(
    "POST",
    "/listings/:id/images/reorder",
    objectSchema(
      {
        imageIds: {
          type: "array",
          maxItems: 5,
          items: uuidSchema("İlan görseli kimliği"),
          example: [UUID_EXAMPLE, SECOND_UUID_EXAMPLE]
        }
      },
      ["imageIds"]
    )
  );

  const favoriteBody = objectSchema(
    {
      listingId: uuidSchema("Favoriye eklenecek ilan", UUID_EXAMPLE)
    },
    ["listingId"]
  );

  addBody("POST", "/favorites", favoriteBody);
  addBody("DELETE", "/favorites", favoriteBody);

  addBody(
    "POST",
    "/conversations",
    objectSchema(
      {
        listingId: uuidSchema("Mesajlaşmanın başlatılacağı ilan", UUID_EXAMPLE)
      },
      ["listingId"]
    )
  );

  addBody(
    "POST",
    "/conversations/:id/messages",
    objectSchema(
      {
        body: stringSchema({
          example:
            "Merhaba, ürün hâlâ satılık mı? Eksik parçası veya hasarı bulunuyor mu?",
          maxLength: 500,
          minLength: 1
        })
      },
      ["body"]
    )
  );

  addBody(
    "POST",
    "/cart/items",
    objectSchema(
      {
        listingId: uuidSchema("Sepete eklenecek ilan", UUID_EXAMPLE)
      },
      ["listingId"]
    )
  );

  addBody(
    "POST",
    "/checkout/mock-iyzico",
    objectSchema(
      {
        scenario: enumSchema(["success", "failure"], {
          defaultValue: "success",
          example: "success"
        })
      },
      [],
      {
        description:
          "Gerçek tahsilat yapmayan BabyLoop mock iyzico checkout akışı. scenario gönderilmezse success kullanılır."
      }
    )
  );

  addBody(
    "POST",
    "/ai/listing-suggestions",
    objectSchema(
      {
        title: stringSchema({
          example: "Bebek arabası",
          maxLength: 160
        }),
        description: stringSchema({
          example: "Temiz ve çalışır durumda.",
          maxLength: 2000
        }),
        categoryName: stringSchema({
          example: "Bebek Arabaları",
          maxLength: 120
        }),
        condition: stringSchema({
          example: "good",
          maxLength: 80
        })
      },
      [],
      {
        description:
          "İlanı otomatik yayımlamaz; yalnızca kullanıcı tarafından incelenecek taslak önerisi üretir."
      }
    )
  );

  addBody(
    "POST",
    "/ai/price-suggestions",
    objectSchema(
      {
        title: stringSchema({
          example: "Bebek arabası",
          maxLength: 160
        }),
        categoryName: stringSchema({
          example: "Bebek Arabaları",
          maxLength: 120
        }),
        condition: enumSchema(listingConditionValues, {
          example: "good"
        }),
        listingType: enumSchema(listingTypeValues, {
          example: "sale"
        }),
        currentPriceAmount: optionalDecimalInputSchema("6500"),
        currency: currencyCodeSchema("TRY")
      },
      [],
      {
        description:
          "En az bir fiyatlandırma sinyali gönderilmelidir: title, categoryName, condition, listingType veya currentPriceAmount. currency gönderilmezse TRY kullanılır."
      }
    )
  );

  addBody(
    "POST",
    "/saved-searches",
    objectSchema(
      {
        name: stringSchema({
          example: "İstanbul bebek arabaları",
          maxLength: 120,
          minLength: 1
        }),
        q: stringSchema({
          example: "bebek arabası",
          maxLength: 120
        }),
        city: stringSchema({
          example: "İstanbul",
          maxLength: 120
        }),
        categoryId: uuidSchema("Kategori filtresi"),
        listingType: enumSchema(listingTypeValues),
        condition: enumSchema(listingConditionValues),
        priceMin: decimalStringSchema("1000"),
        priceMax: decimalStringSchema("7000"),
        hasImages: booleanSchema(true),
        sort: enumSchema(
          ["newest", "oldest", "price_asc", "price_desc"],
          { example: "newest" }
        ),
        notificationsEnabled: booleanSchema(false)
      },
      ["name"]
    )
  );

  addBody(
    "PATCH",
    "/saved-searches/:savedSearchId/notifications",
    objectSchema(
      {
        notificationsEnabled: booleanSchema(true)
      },
      ["notificationsEnabled"]
    )
  );

  const reportBody = objectSchema(
    {
      reason: enumSchema(
        [
          "safety",
          "scam",
          "inappropriate",
          "prohibited_item",
          "harassment",
          "other"
        ],
        {
          example: "inappropriate"
        }
      ),
      details: stringSchema({
        example: "İlan açıklamasının incelenmesi gerekiyor.",
        maxLength: 1000,
        nullable: true
      })
    },
    ["reason"]
  );

  addBody("POST", "/reports/listings/:listingId", reportBody);
  addBody("POST", "/reports/profiles/:profileId", reportBody);
  addBody("POST", "/reports/messages/:messageId", reportBody);
}

function registerChildAndNotificationBodyContracts(): void {
  addBody(
    "POST",
    "/child-profiles",
    objectSchema(
      {
        label: stringSchema({
          defaultValue: "Çocuğum",
          example: "Ada",
          maxLength: 80,
          minLength: 1
        }),
        ageBand: enumSchema(childAgeBandValues, {
          example: "preschool_24_36"
        }),
        ageMonths: integerSchema({
          example: 30,
          maximum: 216,
          minimum: 0,
          nullable: true
        }),
        birthMonth: integerSchema({
          example: 1,
          maximum: 12,
          minimum: 1,
          nullable: true
        }),
        birthYear: integerSchema({
          example: 2024,
          maximum: 2035,
          minimum: 2016,
          nullable: true
        }),
        gender: enumSchema(["female", "male", "prefer_not_to_say"], {
          example: "female",
          nullable: true
        }),
        notificationCadence: enumSchema(
          ["off", "weekly", "monthly", "yearly"],
          {
            defaultValue: "off",
            example: "weekly"
          }
        ),
        isActive: booleanSchema(true)
      },
      ["ageBand"]
    )
  );

  addBody(
    "PATCH",
    "/child-profiles/:childProfileId",
    objectSchema(
      {
        label: stringSchema({
          example: "Ada",
          maxLength: 80,
          minLength: 1
        }),
        ageBand: enumSchema(childAgeBandValues),
        ageMonths: integerSchema({
          example: 30,
          maximum: 216,
          minimum: 0,
          nullable: true
        }),
        birthMonth: integerSchema({
          maximum: 12,
          minimum: 1,
          nullable: true
        }),
        birthYear: integerSchema({
          maximum: 2035,
          minimum: 2016,
          nullable: true
        }),
        gender: enumSchema(["female", "male", "prefer_not_to_say"], {
          nullable: true
        }),
        notificationCadence: enumSchema([
          "off",
          "weekly",
          "monthly",
          "yearly"
        ]),
        isActive: booleanSchema(true)
      },
      [],
      {
        description: "En az bir alan gönderilmelidir."
      }
    )
  );

  addBody(
    "POST",
    "/child-profiles/:childProfileId/notes",
    objectSchema(
      {
        noteType: enumSchema(childNoteTypeValues, {
          defaultValue: "general",
          example: "shopping"
        }),
        title: stringSchema({
          example: "Hafta sonu bez al",
          maxLength: 100,
          minLength: 1
        }),
        body: stringSchema({
          example: "3 numara bez stoğu azaldı.",
          maxLength: 2000,
          nullable: true
        }),
        isPinned: booleanSchema(false)
      },
      ["title"]
    )
  );

  addBody(
    "PATCH",
    "/child-profiles/:childProfileId/notes/:noteId",
    objectSchema(
      {
        noteType: enumSchema(childNoteTypeValues),
        title: stringSchema({
          example: "Güncellenmiş not",
          maxLength: 100,
          minLength: 1
        }),
        body: stringSchema({
          maxLength: 2000,
          nullable: true
        }),
        isPinned: booleanSchema(true),
        isArchived: booleanSchema(false)
      },
      [],
      {
        description: "En az bir alan gönderilmelidir."
      }
    )
  );

  const createReminderBody = objectSchema(
    {
      title: stringSchema({
        example: "Cumartesi bez al",
        maxLength: 120,
        minLength: 1
      }),
      description: stringSchema({
        example: "Market alışverişine ekle.",
        maxLength: 1000,
        nullable: true
      }),
      reminderType: enumSchema(childReminderTypeValues, {
        defaultValue: "general",
        example: "shopping"
      }),
      scheduleKind: enumSchema(childReminderScheduleValues, {
        defaultValue: "one_time",
        example: "one_time"
      }),
      intervalMinutes: integerSchema({
        example: 120,
        maximum: 43200,
        minimum: 15
      }),
      remindAt: dateTimeSchema("2030-01-02T07:00:00.000Z"),
      dueAt: dateTimeSchema("2030-01-02T07:00:00.000Z"),
      eventAt: dateTimeSchema("2030-01-10T10:00:00.000Z"),
      notifyBeforeMinutes: integerSchema({
        example: 1440,
        maximum: 43200,
        minimum: 1
      }),
      localTime: localTimeContract(false),
      timezone: timezoneContract(),
      channel: enumSchema(["in_app", "email_draft"], {
        defaultValue: "in_app",
        example: "in_app"
      })
    },
    ["title"],
    {
      description:
        "scheduleKind koşulları: interval için intervalMinutes; one_time için dueAt veya remindAt; relative_before_event için eventAt ve notifyBeforeMinutes; daily/weekly için localTime, dueAt veya remindAt gerekir. Sağlık, ilaç, tedavi, tanı, terapi ve diyet talimatları kabul edilmez."
    }
  );

  const updateReminderBody = objectSchema(
    {
      title: stringSchema({
        example: "Cumartesi bez al",
        maxLength: 120,
        minLength: 1
      }),
      description: stringSchema({
        example: "Market alışverişine ekle.",
        maxLength: 1000,
        nullable: true
      }),
      reminderType: enumSchema(childReminderTypeValues),
      scheduleKind: enumSchema(childReminderScheduleValues),
      intervalMinutes: integerSchema({
        example: 120,
        maximum: 43200,
        minimum: 15,
        nullable: true
      }),
      remindAt: dateTimeSchema("2030-01-02T07:00:00.000Z"),
      dueAt: dateTimeSchema("2030-01-02T07:00:00.000Z", true),
      eventAt: dateTimeSchema("2030-01-10T10:00:00.000Z", true),
      notifyBeforeMinutes: integerSchema({
        example: 1440,
        maximum: 43200,
        minimum: 1,
        nullable: true
      }),
      localTime: localTimeContract(true),
      timezone: timezoneContract(),
      channel: enumSchema(["in_app", "email_draft"]),
      status: enumSchema(["scheduled", "completed", "cancelled"], {
        example: "completed"
      })
    },
    [],
    {
      description:
        "Gönderilen hatırlatıcı alanları güncellenir ve en az bir alan gerekir. remindAt null kabul etmez; temizlenebilen alanlar dueAt, eventAt, intervalMinutes, notifyBeforeMinutes ve localTime ile sınırlıdır. scheduleKind bağımlılıkları create sözleşmesiyle aynıdır."
    }
  );

  addBody(
    "POST",
    "/child-profiles/:childProfileId/reminders",
    createReminderBody
  );

  addBody(
    "PATCH",
    "/child-profiles/:childProfileId/reminders/:reminderId",
    updateReminderBody
  );

  addBody(
    "PATCH",
    "/notification-preferences",
    objectSchema(
      {
        source: enumSchema(notificationSourceValues, {
          example: "child_reminder"
        }),
        channel: enumSchema(notificationChannelValues, {
          example: "push"
        }),
        enabled: booleanSchema(true),
        mutedUntil: dateTimeSchema("2030-01-03T10:00:00.000Z", true),
        quietHoursStart: stringSchema({
          example: "22:00",
          nullable: true,
          pattern: "^[0-2][0-9]:[0-5][0-9]$"
        }),
        quietHoursEnd: stringSchema({
          example: "08:00",
          nullable: true,
          pattern: "^[0-2][0-9]:[0-5][0-9]$"
        }),
        timezone: stringSchema({
          defaultValue: "Europe/Istanbul",
          example: "Europe/Istanbul",
          maxLength: 80
        }),
        digest: enumSchema(["immediate", "daily", "weekly"], {
          defaultValue: "immediate",
          example: "immediate"
        }),
        reason: stringSchema({
          description:
            "Tercih değişikliğinin kullanıcı tarafından girilen güvenli ve opsiyonel açıklaması.",
          example: "Bu kanaldan bildirim almak istemiyorum.",
          maxLength: 240
        })
      },
      ["source", "channel", "enabled"]
    )
  );

  const pushTokenBody = objectSchema(
    {
      token: stringSchema({
        description: "Push token. Response içinde ham token dönmez.",
        example: "ExponentPushToken[example-device-token]",
        maxLength: 2048,
        minLength: 20
      }),
      platform: enumSchema(["ios", "android", "expo"], {
        example: "expo"
      }),
      deviceLabel: stringSchema({
        example: "Galaxy S22",
        maxLength: 120,
        minLength: 1
      })
    },
    ["token", "platform"]
  );

  const revokePushTokenBody = objectSchema(
    {
      token: stringSchema({
        description: "İptal edilecek push token.",
        example: "ExponentPushToken[example-device-token]",
        maxLength: 2048,
        minLength: 20
      })
    },
    ["token"]
  );

  addBody("POST", "/notifications/push-tokens", pushTokenBody);
  addBody("DELETE", "/notifications/push-tokens", revokePushTokenBody);
}

function registerAdminBodyContracts(): void {
  addBody(
    "POST",
    "/admin/email/test-send",
    objectSchema(
      {
        to: emailSchema("test@example.test"),
        intent: enumSchema(
          [
            "email_verification",
            "password_reset",
            "notification_digest",
            "security_alert"
          ],
          {
            defaultValue: "security_alert",
            example: "security_alert"
          }
        ),
        note: stringSchema({
          example: "Backoffice provider bağlantı testi.",
          maxLength: 240,
          nullable: true
        }),
        confirmation: enumSchema(["SEND_TEST_EMAIL"], {
          example: "SEND_TEST_EMAIL"
        }),
        idempotencyKey: uuidSchema(
          "Kontrollü test isteği tekilleştirme anahtarı",
          UUID_EXAMPLE
        )
      },
      ["to", "confirmation", "idempotencyKey"]
    )
  );

  addBody(
    "POST",
    "/admin/listings/:listingId/actions",
    objectSchema(
      {
        action: enumSchema(["archive", "restore", "publish", "request_changes"], {
          example: "publish"
        }),
        reason: stringSchema({
          example: "İlan içerik politikası incelemesi nedeniyle arşivleniyor.",
          maxLength: 1000,
          minLength: 10
        })
      },
      ["action", "reason"]
    )
  );

  addBody(
    "PATCH",
    "/admin/listings/publication-settings",
    objectSchema(
      {
        adminReviewEnabled: {
          type: "boolean",
          example: false,
          description:
            "Açık olduğunda AI kontrolünü geçen ilanlar yönetici yayın kararı bekler."
        },
        autoPublishDelaySeconds: integerSchema({
          defaultValue: 30,
          example: 30,
          maximum: 86400,
          minimum: 5
        })
      },
      ["adminReviewEnabled", "autoPublishDelaySeconds"]
    )
  );

  addBody(
    "POST",
    "/admin/listings/:listingId/images/:imageId/actions",
    objectSchema(
      {
        action: enumSchema(["approve", "reject"], {
          example: "approve"
        }),
        reason: stringSchema({
          example: "Görsel gerçek ürünü açık biçimde gösteriyor.",
          maxLength: 1000,
          minLength: 10
        })
      },
      ["action", "reason"]
    )
  );

  addBody(
    "PATCH",
    "/admin/moderation/cases/:caseId/status",
    objectSchema(
      {
        status: enumSchema(
          ["pending", "in_review", "resolved", "dismissed"],
          {
            example: "in_review"
          }
        ),
        note: stringSchema({
          example: "İnceleme başlatıldı.",
          maxLength: 1000,
          nullable: true
        })
      },
      ["status"]
    )
  );

  addBody(
    "POST",
    "/admin/moderation/cases/:caseId/actions",
    objectSchema(
      {
        actionType: enumSchema(
          ["note", "review_started", "dismissed", "resolved", "action_taken"],
          {
            example: "review_started"
          }
        ),
        note: stringSchema({
          example: "İlan ve profil geçmişi incelenecek.",
          maxLength: 1000,
          nullable: true
        })
      },
      ["actionType"]
    )
  );

  addBody(
    "POST",
    "/admin/moderation/cases/:caseId/sensitive-access",
    objectSchema(
      {
        reason: stringSchema({
          example:
            "Raporun doğrulanması için kontrollü mesaj önizlemesi gerekiyor.",
          maxLength: 1000,
          minLength: 10
        }),
        fields: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: enumSchema(["reporter", "message"]),
          example: ["message"]
        }
      },
      ["reason", "fields"]
    )
  );

  const moderationReasonBody = objectSchema(
    {
      reason: stringSchema({
        example: "Moderasyon kararı için vaka özeti gerekiyor.",
        maxLength: 1000,
        minLength: 10
      })
    },
    ["reason"]
  );

  addBody(
    "POST",
    "/admin/moderation/cases/:caseId/ai-summary",
    moderationReasonBody
  );

  addBody(
    "POST",
    "/admin/moderation/cases/:caseId/enforcement",
    objectSchema(
      {
        action: enumSchema(
          [
            "listing_hide",
            "listing_restore",
            "message_hide",
            "message_mark_reviewed",
            "profile_warn",
            "profile_restrict",
            "profile_suspend",
            "profile_restore"
          ],
          {
            example: "listing_hide"
          }
        ),
        reason: stringSchema({
          example:
            "İlan doğrulanabilir güvenlik politikası ihlali nedeniyle gizleniyor.",
          maxLength: 1000,
          minLength: 10
        })
      },
      ["action", "reason"]
    )
  );

  addBody(
    "POST",
    "/admin/profiles/:profileId/enforcement",
    objectSchema(
      {
        action: enumSchema(
          ["warn", "restrict", "suspend", "restore"],
          {
            example: "restrict"
          }
        ),
        reason: stringSchema({
          example:
            "Tekrarlanan güvenlik ihlalleri nedeniyle profil kısıtlanıyor.",
          maxLength: 1000,
          minLength: 10
        })
      },
      ["action", "reason"]
    )
  );

  addBody(
    "POST",
    "/admin/rag/playground/query",
    objectSchema(
      {
        query: stringSchema({
          example: "Bebek arabası alırken hangi kontroller yapılmalı?",
          maxLength: 1000,
          minLength: 2
        }),
        mode: enumSchema(["search", "answer"], {
          defaultValue: "search",
          example: "search"
        }),
        limit: integerSchema({
          defaultValue: 5,
          example: 5,
          maximum: 10,
          minimum: 1
        }),
        debug: booleanSchema(false)
      },
      ["query"]
    )
  );

  addBody(
    "POST",
    "/admin/rag/reindex/run",
    objectSchema(
      {
        mode: enumSchema(["check", "full"], {
          defaultValue: "check",
          example: "check"
        }),
        confirm: stringSchema({
          description:
            "mode=full olduğunda tam olarak REINDEX_RAG gönderilmelidir.",
          example: "REINDEX_RAG"
        })
      },
      []
    )
  );

  addBody(
    "POST",
    "/admin/rag/eval/run",
    objectSchema(
      {
        mode: enumSchema(["mock", "live"], {
          defaultValue: "mock",
          example: "mock"
        }),
        limit: integerSchema({
          defaultValue: 20,
          example: 20,
          maximum: 50,
          minimum: 1
        })
      },
      []
    )
  );
}

function registerQueryContracts(): void {
  addQuery(
    "GET",
    "/listings",
    objectSchema({
      q: stringSchema({
        example: "bebek arabası",
        maxLength: 120
      }),
      search: stringSchema({
        description: "q alanıyla aynı davranan geriye uyumlu arama alias'ı.",
        example: "bebek arabası",
        maxLength: 120
      }),
      categoryId: uuidSchema("Kategori filtresi"),
      listingType: enumSchema(listingTypeValues),
      condition: enumSchema(listingConditionValues),
      city: stringSchema({
        example: "İstanbul",
        maxLength: 120
      }),
      priceMin: decimalStringSchema("1000"),
      priceMax: decimalStringSchema("7000"),
      hasImages: booleanSchema(true),
      includeTotal: {
        type: "boolean",
        default: true,
        example: true,
        description: "İlk sayfada tam toplamı döndürür. Infinite-scroll devam sayfaları COUNT sorgusunu atlamak için false gönderebilir."
      },
      imageLimit: integerSchema({
        defaultValue: 3,
        example: 1,
        maximum: 3,
        minimum: 1
      }),
      createdSince: enumSchema(["today", "last_7_days"]),
      sort: enumSchema(["newest", "oldest", "price_asc", "price_desc"], {
        defaultValue: "newest",
        example: "newest"
      }),
      limit: integerSchema({
        defaultValue: 20,
        example: 20,
        maximum: 50,
        minimum: 1
      }),
      offset: integerSchema({
        defaultValue: 0,
        example: 0,
        maximum: 10000,
        minimum: 0
      })
    })
  );

  addQuery(
    "GET",
    "/listings/:listingId/recommendations",
    objectSchema({
      limit: integerSchema({
        defaultValue: 6,
        example: 6,
        maximum: 20,
        minimum: 1
      })
    })
  );

  const searchSuggestionsQuery = objectSchema(
    {
      q: stringSchema({
        example: "bebek ara",
        maxLength: 120,
        minLength: 1
      }),
      limit: integerSchema({
        defaultValue: 8,
        example: 8,
        maximum: 20,
        minimum: 1
      })
    },
    ["q"]
  );

  addQuery("GET", "/search/suggestions", searchSuggestionsQuery);
  addQuery("GET", "/search-suggestions", searchSuggestionsQuery);

  const adminAnalyticsQuery = objectSchema(
    {
      from: dateOnlySchema("2030-01-01"),
      to: dateOnlySchema("2030-01-31"),
      platform: enumSchema(["web", "mobile"], {
        example: "web"
      })
    },
    [],
    {
      description:
        "from ve to YYYY-MM-DD biçimindedir. from, to değerinden sonra olamaz ve tarih aralığı 370 günü aşamaz."
    }
  );

  for (const path of [
    "/admin/analytics/overview",
    "/admin/analytics/auth",
    "/admin/analytics/users",
    "/admin/analytics/engagement",
    "/admin/analytics/marketplace",
    "/admin/analytics/messaging",
    "/admin/analytics/assistant",
    "/admin/analytics/child",
    "/admin/analytics/funnels",
    "/admin/analytics/pages",
    "/admin/analytics/categories"
  ]) {
    addQuery("GET", path, adminAnalyticsQuery);
  }

  addQuery(
    "GET",
    "/admin/listings",
    objectSchema({
      status: enumSchema([
        "draft",
        "active",
        "reserved",
        "sold",
        "archived"
      ]),
      imageReviewStatus: enumSchema([
        "pending",
        "approved",
        "needs_review",
        "rejected"
      ]),
      publicationState: enumSchema([
        "awaiting_images",
        "ai_review",
        "admin_review",
        "scheduled",
        "published",
        "changes_requested"
      ]),
      q: stringSchema({
        example: "bebek arabası",
        maxLength: 120,
        minLength: 1
      }),
      categoryId: uuidSchema("Kategori filtresi"),
      sort: enumSchema([
        "newest",
        "oldest",
        "updated_desc",
        "updated_asc"
      ]),
      limit: integerSchema({
        defaultValue: 50,
        example: 50,
        maximum: 100,
        minimum: 1
      })
    })
  );

  const moderationQuery = objectSchema({
    status: enumSchema([
      "pending",
      "in_review",
      "resolved",
      "dismissed"
    ]),
    targetType: enumSchema(["listing", "profile", "message"]),
    q: stringSchema({
      example: "inceleme",
      maxLength: 120,
      minLength: 1
    }),
    sort: enumSchema([
      "newest",
      "oldest",
      "updated_desc",
      "updated_asc"
    ]),
    limit: integerSchema({
      defaultValue: 50,
      example: 50,
      maximum: 100,
      minimum: 1
    })
  });

  addQuery("GET", "/admin/moderation/cases", moderationQuery);

  addQuery(
    "GET",
    "/admin/moderation/cases/:caseId/ai-summaries",
    objectSchema({
      limit: integerSchema({
        defaultValue: 10,
        example: 10,
        maximum: 20,
        minimum: 1
      })
    })
  );

  addQuery(
    "GET",
    "/admin/profiles",
    objectSchema({
      safetyStatus: enumSchema(["active", "restricted", "suspended"]),
      riskLevel: enumSchema(["low", "medium", "high", "critical"]),
      q: stringSchema({
        example: "profil",
        maxLength: 120,
        minLength: 1
      }),
      limit: integerSchema({
        defaultValue: 50,
        example: 50,
        maximum: 100,
        minimum: 1
      })
    })
  );

  addQuery(
    "GET",
    "/admin/conversations",
    objectSchema({
      q: stringSchema({
        example: "ilan",
        maxLength: 120,
        minLength: 1
      }),
      status: enumSchema(["active"]),
      limit: integerSchema({
        defaultValue: 50,
        example: 50,
        maximum: 100,
        minimum: 1
      })
    })
  );

  addQuery(
    "GET",
    "/admin/ai-ops/runs",
    objectSchema({
      status: enumSchema([
        "success",
        "error",
        "validation_failed",
        "provider_failed",
        "skipped"
      ]),
      providerName: stringSchema({
        example: "gemini",
        maxLength: 120
      }),
      feature: stringSchema({
        example: "assistant_message",
        maxLength: 120
      }),
      limit: integerSchema({
        defaultValue: 50,
        example: 50,
        maximum: 100,
        minimum: 1
      })
    })
  );

  addQuery(
    "GET",
    "/admin/audit/events",
    objectSchema({
      eventType: stringSchema({
        example: "admin_listing_action_applied",
        maxLength: 120
      }),
      actorProfileId: uuidSchema("Admin profil kimliği"),
      targetType: stringSchema({
        example: "listing",
        maxLength: 80
      }),
      targetId: stringSchema({
        example: UUID_EXAMPLE,
        maxLength: 160
      }),
      limit: integerSchema({
        defaultValue: 50,
        example: 50,
        maximum: 100,
        minimum: 1
      })
    })
  );
}

function registerSpecialContracts(): void {
  registerExactResponseContracts();

  ROUTE_CONTRACTS["GET /admin/rag/documents/:documentId/chunks"] = {
    ...ROUTE_CONTRACTS["GET /admin/rag/documents/:documentId/chunks"],
    params: objectSchema(
      {
        documentId: stringSchema({
          description: "RAG doküman kimliği; UUID değildir.",
          example: "feeding-and-food-safety-canon",
          maxLength: 121,
          minLength: 2,
          pattern: "^[a-z0-9][a-z0-9_-]{1,120}$"
        })
      },
      ["documentId"]
    )
  };

  ROUTE_CONTRACTS["GET /admin/rag/eval/history/:runId"] = {
    ...ROUTE_CONTRACTS["GET /admin/rag/eval/history/:runId"],
    params: objectSchema(
      {
        runId: stringSchema({
          description: "RAG eval çalıştırma kimliği; UUID değildir.",
          example: "rag-eval-20300101",
          maxLength: 81,
          minLength: 8,
          pattern: "^[a-z0-9][a-z0-9-]{7,80}$"
        })
      },
      ["runId"]
    )
  };

  ROUTE_CONTRACTS["POST /listings/:id/images"] = {
    ...ROUTE_CONTRACTS["POST /listings/:id/images"],
    consumes: ["multipart/form-data"],
    body: objectSchema(
      {
        image: {
          type: "string",
          format: "binary",
          description:
            "JPEG, PNG veya WebP gerçek ürün görseli. En fazla 5 görsel."
        }
      },
      ["image"]
    )
  };

  ROUTE_CONTRACTS["POST /listings/ai-draft-suggestions"] = {
    ...ROUTE_CONTRACTS["POST /listings/ai-draft-suggestions"],
    consumes: ["multipart/form-data"],
    body: objectSchema({
      categoryId: uuidSchema("Kategori kimliği"),
      listingType: enumSchema(listingTypeValues),
      title: stringSchema({
        maxLength: 160
      }),
      description: stringSchema({
        maxLength: 2000
      }),
      condition: enumSchema(listingConditionValues),
      priceAmount: decimalStringSchema("6500"),
      currency: enumSchema(["TRY"], {
        defaultValue: "TRY"
      }),
      city: stringSchema({
        maxLength: 120
      }),
      locale: enumSchema(["tr"], {
        defaultValue: "tr"
      }),
      images: {
        type: "array",
        maxItems: 5,
        items: {
          type: "string",
          format: "binary"
        }
      }
    })
  };

  ROUTE_CONTRACTS["GET /uploads/listings/:listingId/:filename"] = {
    ...ROUTE_CONTRACTS["GET /uploads/listings/:listingId/:filename"],
    replaceDefaultResponses: true,
    response: {
      "200": {
        description: "İlan görseli binary içeriği.",
        type: "string",
        format: "binary"
      },
      "404": errorEnvelopeSchema("Görsel bulunamadı.")
    }
  };

  ROUTE_CONTRACTS["POST /listings/:id/share-link"] = {
    ...ROUTE_CONTRACTS["POST /listings/:id/share-link"],
    security: []
  };

  registerCriticalResponseBodyContracts();
}

function productEventBodyContract(): JsonSchema {
  const source = enumSchema(
    [
      "listing_detail",
      "listing_card",
      "listing_recommendations",
      "recently_viewed",
      "favorites",
      "category_grid",
      "search_results",
      "account_saved_searches",
      "seller_dashboard",
      "browse_filters",
      "conversation"
    ],
    { example: "listing_detail" }
  );

  const listingEvent = objectSchema(
    {
      eventType: enumSchema([
        "listing_detail_viewed",
        "listing_card_clicked",
        "listing_recommendation_impression",
        "contact_seller_intent",
        "recently_viewed_listing_clicked"
      ]),
      listingId: uuidSchema("İlgili ilan kimliği", UUID_EXAMPLE),
      source
    },
    ["eventType", "listingId"]
  );

  const listingUpdated = objectSchema(
    {
      eventType: enumSchema(["listing_updated"]),
      listingId: uuidSchema("İlgili ilan kimliği", UUID_EXAMPLE),
      source
    },
    ["eventType", "listingId"]
  );

  const categoryViewed = objectSchema(
    {
      eventType: enumSchema(["category_viewed"]),
      categoryId: uuidSchema("İlgili kategori kimliği", SECOND_UUID_EXAMPLE),
      source
    },
    ["eventType", "categoryId"]
  );

  const searchPerformed = objectSchema(
    {
      eventType: enumSchema(["search_performed"]),
      queryLength: integerSchema({
        example: 14,
        maximum: 200,
        minimum: 1
      }),
      resultCount: integerSchema({
        example: 24,
        maximum: 10000,
        minimum: 0
      }),
      source
    },
    ["eventType", "queryLength"]
  );

  const savedSearch = objectSchema(
    {
      eventType: enumSchema([
        "saved_search_created",
        "saved_search_deleted"
      ]),
      savedSearchId: uuidSchema("Kayıtlı arama kimliği"),
      categoryId: uuidSchema("İlgili kategori kimliği"),
      city: stringSchema({
        example: "İstanbul",
        maxLength: 120,
        minLength: 1
      }),
      sort: enumSchema([
        "newest",
        "oldest",
        "price_asc",
        "price_desc",
        "relevance"
      ]),
      source
    },
    ["eventType", "savedSearchId"]
  );

  const favorite = objectSchema(
    {
      eventType: enumSchema(["favorite_added", "favorite_removed"]),
      listingId: uuidSchema("İlgili ilan kimliği", UUID_EXAMPLE),
      categoryId: uuidSchema("İlgili kategori kimliği"),
      source
    },
    ["eventType", "listingId"]
  );

  const listingStatus = objectSchema(
    {
      eventType: enumSchema(["listing_status_changed"]),
      listingId: uuidSchema("İlgili ilan kimliği", UUID_EXAMPLE),
      status: enumSchema(["active", "reserved", "sold", "archived"]),
      source
    },
    ["eventType", "listingId", "status"]
  );

  const browseFilter = objectSchema(
    {
      eventType: enumSchema(["browse_filter_applied"]),
      categoryId: uuidSchema("İlgili kategori kimliği"),
      city: stringSchema({
        example: "İstanbul",
        maxLength: 120,
        minLength: 1
      }),
      listingType: enumSchema(listingTypeValues),
      condition: enumSchema(listingConditionValues),
      sort: enumSchema([
        "newest",
        "oldest",
        "price_asc",
        "price_desc",
        "relevance"
      ]),
      limit: integerSchema({
        example: 20,
        maximum: 80,
        minimum: 1
      }),
      offset: integerSchema({
        example: 0,
        maximum: 10000,
        minimum: 0
      }),
      source
    },
    ["eventType"]
  );

  const messageSent = objectSchema(
    {
      eventType: enumSchema(["message_sent"]),
      conversationId: uuidSchema("Konuşma kimliği"),
      listingId: uuidSchema("İlgili ilan kimliği"),
      source
    },
    ["eventType", "conversationId"]
  );

  return {
    description:
      "Gizlilik güvenli legacy ürün olayı. eventType, kabul edilen payload varyantını belirler; varyant dışı alanlar reddedilir.",
    discriminator: {
      propertyName: "eventType"
    },
    oneOf: [
      listingUpdated,
      listingEvent,
      categoryViewed,
      searchPerformed,
      savedSearch,
      favorite,
      listingStatus,
      browseFilter,
      messageSent
    ]
  };
}

function registerExactResponseContracts(): void {
  setExactResponses("POST", "/product-events", ["200", "400", "503"]);
  setExactResponses("POST", "/rag/search", ["200", "400", "429", "503"]);

  setExactResponses(
    "POST",
    "/auth/account-deletion/request",
    ["200", "400", "401", "403", "404", "429", "503"]
  );
  setExactResponses(
    "POST",
    "/auth/account-deletion/confirm",
    ["200", "400", "401", "403", "404", "429", "503"]
  );
  setExactResponses("POST", "/auth/register", ["201", "400", "409", "429", "503"]);
  setExactResponses("POST", "/auth/login", ["200", "400", "401", "429", "503"]);
  setExactResponses("POST", "/auth/mfa/verify", ["200", "400", "429", "503"]);
  setExactResponses("POST", "/auth/login-approval/complete", ["200", "202", "400", "503"]);
  setExactResponsesForPaths("GET", [
    "/auth/mfa/status",
    "/auth/login-approval/status",
    "/auth/login-approvals",
    "/auth/sessions",
    "/auth/me"
  ], ["200", "401", "503"]);
  setExactResponsesForPaths("POST", [
    "/auth/mfa/enable",
    "/auth/mfa/disable"
  ], ["200", "400", "401", "403", "429", "503"]);
  setExactResponses("POST", "/auth/refresh", ["200", "401", "429", "503"]);
  setExactResponsesForPaths("POST", [
    "/auth/login-approval/enable",
    "/auth/login-approval/disable"
  ], ["200", "400", "401", "403", "503"]);
  setExactResponsesForPaths("POST", [
    "/auth/login-approvals/:approvalId/approve",
    "/auth/login-approvals/:approvalId/deny",
    "/auth/sessions/:sessionId/revoke"
  ], ["200", "401", "403", "404", "503"]);
  setExactResponses("POST", "/auth/logout", ["200", "403", "503"]);
  setExactResponses("POST", "/auth/sessions/revoke-all", ["200", "400", "401", "403", "503"]);
  setExactResponses("POST", "/auth/backoffice/login", ["200", "400", "401", "403", "429", "503"]);
  setExactResponses("POST", "/auth/backoffice/refresh", ["200", "401", "403", "429", "503"]);
  setExactResponses("POST", "/auth/backoffice/logout", ["200", "403", "503"]);
  setExactResponsesForPaths("GET", [
    "/auth/backoffice/me",
    "/auth/backoffice/csrf"
  ], ["200", "401", "403", "503"]);
  setExactResponses("GET", "/auth/csrf", ["200", "401", "503"]);
  setExactResponsesForPaths("POST", [
    "/auth/password-reset/request",
    "/auth/password-reset/confirm",
    "/auth/email-verification/request",
    "/auth/email-verification/confirm"
  ], ["200", "400", "429", "503"]);
  setExactResponses("POST", "/auth/password/change", ["200", "400", "401", "403", "503"]);
  setExactResponseSchemas("GET", "/auth/google/start", {
    "302": redirectResponseSchema("Google OAuth yetkilendirme sayfasına yönlendirir."),
    "503": errorEnvelopeSchema("Google OAuth yapılandırılmamış.")
  });
  setExactResponseSchemas("GET", "/auth/google/callback", {
    "302": redirectResponseSchema("Başarılı veya hatalı OAuth sonucunu web uygulamasına yönlendirir.")
  });

  setExactResponses("GET", "/listings/:id/share-link", ["200", "400", "404", "503"]);
  setExactResponses("GET", "/share-links/:code/resolve", ["200", "404", "503"]);
  setExactResponses("POST", "/listings/:id/share-link", ["200", "400", "404", "503"]);
  setExactResponses("POST", "/listings", ["201", "400", "401", "403", "500", "503"]);
  setExactResponses("GET", "/listings", ["200", "400", "503"]);
  setExactResponses("POST", "/listings/ai-draft-suggestions", ["200", "400", "401", "403", "413", "503"]);
  setExactResponses("GET", "/me/listings", ["200", "401", "503"]);
  setExactResponses("GET", "/me/listings/:id", ["200", "400", "401", "403", "404", "500", "503"]);
  setExactResponses("GET", "/listings/:id", ["200", "400", "404", "503"]);
  const publicListingDemoMarker = objectSchema(
    { isDemo: booleanSchema(false) },
    ["isDemo"],
    { additionalProperties: true }
  );
  setExactResponseSchema(
    "GET",
    "/listings",
    "200",
    successEnvelopeWithDataSchema(
      "Yayınlanmış ilanları explicit demo işaretiyle döndürür.",
      objectSchema(
        { listings: { type: "array", items: publicListingDemoMarker } },
        ["listings"],
        { additionalProperties: true }
      )
    )
  );
  for (const path of ["/listings/:id", "/me/listings/:id"] as const) {
    setExactResponseSchema(
      "GET",
      path,
      "200",
      successEnvelopeWithDataSchema(
        "İlanı explicit demo işaretiyle döndürür; internal seed anahtarları public sözleşmede yer almaz.",
        objectSchema({ listing: publicListingDemoMarker }, ["listing"], { additionalProperties: true })
      )
    );
  }
  setExactResponsesForPaths("PATCH", [
    "/listings/:id",
    "/listings/:id/status",
    "/listings/:id/images/reorder"
  ], ["200", "400", "401", "403", "404", "500", "503"]);
  setExactResponses("POST", "/listings/:id/images", ["201", "400", "401", "403", "404", "409", "413", "500", "503"]);
  setExactResponses("DELETE", "/listings/:id/images/:imageId", ["200", "400", "401", "403", "404", "503"]);

  setExactResponses("POST", "/favorites", ["200", "400", "401", "403", "503"]);
  setExactResponses("POST", "/cart/items", ["200", "400", "401", "403", "404", "409", "500", "503"]);
  setExactResponses("DELETE", "/favorites", ["200", "400", "401", "403", "503"]);
  setExactResponsesForPaths("GET", ["/favorites", "/cart", "/cart/summary"], ["200", "401", "503"]);
  setExactResponses("GET", "/profiles/:profileId/favorites", ["200", "400", "401", "403", "503"]);
  setExactResponses("DELETE", "/cart/items/:listingId", ["200", "400", "401", "403", "503"]);
  setExactResponses("DELETE", "/cart", ["200", "401", "403", "503"]);
  setExactResponses("POST", "/checkout/mock-iyzico", ["200", "400", "401", "402", "403", "409", "500", "503"]);

  setExactResponses("POST", "/conversations", ["200", "201", "400", "401", "403", "409", "500", "503"]);
  setExactResponses("GET", "/conversations", ["200", "401", "503"]);
  setExactResponsesForPaths("GET", [
    "/conversations/:id",
    "/conversations/:id/messages"
  ], ["200", "400", "401", "403", "404", "503"]);
  setExactResponses("PATCH", "/conversations/:id/read", ["200", "400", "401", "403", "404", "500", "503"]);
  setExactResponses("POST", "/conversations/:id/messages", ["201", "400", "401", "403", "404", "503"]);

  setExactResponsesForPaths("GET", [
    "/child-profiles",
    "/child-profiles/lifecycle-recommendations"
  ], ["200", "401", "503"]);
  setExactResponses("POST", "/child-profiles", ["201", "400", "401", "403", "503"]);
  setExactResponsesForPaths("GET", [
    "/child-profiles/:childProfileId/notes",
    "/child-profiles/:childProfileId/reminders"
  ], ["200", "400", "401", "404", "503"]);
  setExactResponsesForPaths("POST", [
    "/child-profiles/:childProfileId/notes",
    "/child-profiles/:childProfileId/reminders"
  ], ["201", "400", "401", "403", "404", "503"]);
  setExactResponsesForPaths("PATCH", [
    "/child-profiles/:childProfileId",
    "/child-profiles/:childProfileId/notes/:noteId",
    "/child-profiles/:childProfileId/reminders/:reminderId"
  ], ["200", "400", "401", "403", "404", "503"]);
  setExactResponsesForPaths("DELETE", [
    "/child-profiles/:childProfileId",
    "/child-profiles/:childProfileId/notes/:noteId",
    "/child-profiles/:childProfileId/reminders/:reminderId"
  ], ["200", "400", "401", "403", "404", "503"]);

  setExactResponsesForPaths("GET", [
    "/notification-preferences",
    "/notifications/delivery-drafts",
    "/notifications/push-tokens",
    "/notifications",
    "/notifications/unread-count"
  ], ["200", "401", "503"]);
  setExactResponses("PATCH", "/notification-preferences", ["200", "400", "401", "403", "503"]);
  setExactResponses("POST", "/notifications/push-tokens", ["200", "400", "401", "403", "503"]);
  setExactResponses("DELETE", "/notifications/push-tokens", ["200", "400", "401", "403", "404", "503"]);
  setExactResponsesForPaths("POST", [
    "/notifications/child-lifecycle/generate",
    "/notifications/saved-searches/generate"
  ], ["200", "401", "403", "503"]);
  setExactResponses("PATCH", "/notifications/:id/read", ["200", "400", "401", "403", "404", "503"]);
  setExactResponses("PATCH", "/notifications/read-all", ["200", "401", "403", "503"]);

  setExactResponsesForPaths("GET", [
    "/admin/dashboard/summary",
    "/admin/product-analytics/summary",
    "/admin/ai-ops/summary",
    "/admin/analytics/data-quality",
    "/admin/listings/publication-settings",
    "/admin/email/ops-preview",
    "/admin/notifications/ops-preview",
    "/admin/storage/ops-preview",
    "/admin/rag/health",
    "/admin/rag/documents",
    "/admin/rag/reindex/check",
    "/admin/rag/eval/cases",
    "/admin/rag/eval/history",
    "/admin/rag/cache/stats",
    "/admin/rag/metrics",
    "/admin/rag/usage"
  ], ["200", "401", "403", "503"]);
  setExactResponsesForPaths("GET", [
    "/admin/analytics/overview",
    "/admin/analytics/auth",
    "/admin/analytics/users",
    "/admin/analytics/engagement",
    "/admin/analytics/marketplace",
    "/admin/analytics/messaging",
    "/admin/analytics/assistant",
    "/admin/analytics/child",
    "/admin/analytics/funnels",
    "/admin/analytics/pages",
    "/admin/analytics/categories",
    "/admin/ai-ops/runs",
    "/admin/audit/events",
    "/admin/conversations",
    "/admin/listings",
    "/admin/moderation/cases",
    "/admin/profiles"
  ], ["200", "400", "401", "403", "503"]);
  setExactResponsesForPaths("GET", [
    "/admin/conversations/:conversationId",
    "/admin/listings/:listingId",
    "/admin/moderation/cases/:caseId",
    "/admin/moderation/cases/:caseId/insights",
    "/admin/moderation/cases/:caseId/ai-summaries",
    "/admin/profiles/:profileId",
    "/admin/rag/documents/:documentId/chunks",
    "/admin/rag/eval/history/:runId"
  ], ["200", "400", "401", "403", "404", "503"]);
  setExactResponses("PATCH", "/admin/listings/publication-settings", ["200", "400", "401", "403", "503"]);
  setExactResponsesForPaths("POST", [
    "/admin/listings/:listingId/actions",
    "/admin/listings/:listingId/images/:imageId/actions",
    "/admin/profiles/:profileId/enforcement"
  ], ["200", "400", "401", "403", "404", "503"]);
  setExactResponses("PATCH", "/admin/moderation/cases/:caseId/status", ["200", "400", "401", "403", "404", "503"]);
  setExactResponses("POST", "/admin/moderation/cases/:caseId/sensitive-access", ["200", "400", "401", "403", "404", "503"]);
  setExactResponses("POST", "/admin/moderation/cases/:caseId/ai-summary", ["200", "400", "401", "403", "404", "429", "503"]);
  setExactResponses("POST", "/admin/moderation/cases/:caseId/enforcement", ["200", "400", "401", "403", "404", "500", "503"]);
  setExactResponses("POST", "/admin/moderation/cases/:caseId/actions", ["201", "400", "401", "403", "404", "503"]);
  setExactResponses("POST", "/admin/email/test-send", [
    "200",
    "400",
    "401",
    "403",
    "409",
    "429",
    "503"
  ]);
  setExactResponsesForPaths("POST", [
    "/admin/rag/playground/query",
    "/admin/rag/reindex/run",
    "/admin/rag/eval/run"
  ], ["200", "400", "401", "403", "503"]);
  setExactResponses("POST", "/admin/rag/cache/clear", ["200", "401", "403", "503"]);
}

function registerCriticalResponseBodyContracts(): void {
  setExactResponseSchema(
    "POST",
    "/auth/account-deletion/request",
    "200",
    successEnvelopeWithDataSchema(
      "Hesap silme güvenlik kodu oluşturuldu.",
      objectSchema(
        {
          challengeId: uuidSchema("Hesap silme challenge kimliği"),
          expiresAt: dateTimeSchema("2030-01-01T10:05:00.000Z"),
          passwordRequired: booleanSchema(true),
          requested: literalBooleanSchema(true),
          devOtpCode: stringSchema({
            description:
              "Yalnız test veya açıkça etkinleştirilmiş lokal geliştirme ortamında döner.",
            example: "123456",
            maxLength: 6,
            minLength: 6,
            pattern: "^\\d{6}$"
          })
        },
        ["challengeId", "expiresAt", "passwordRequired", "requested"]
      )
    )
  );

  setExactResponseSchema(
    "POST",
    "/auth/account-deletion/confirm",
    "200",
    successEnvelopeWithDataSchema(
      "Hesap silindi ve oturumlar geçersiz hale getirildi.",
      objectSchema(
        {
          accountDeleted: literalBooleanSchema(true),
          profileId: uuidSchema("Anonim tombstone profil kimliği"),
          storageCleanup: objectSchema(
            {
              completedCount: integerSchema({ example: 2, minimum: 0 }),
              failedCount: integerSchema({ example: 0, minimum: 0 }),
              pendingCount: integerSchema({ example: 0, minimum: 0 })
            },
            ["completedCount", "failedCount", "pendingCount"]
          )
        },
        ["accountDeleted", "profileId", "storageCleanup"]
      )
    )
  );

  const shareLink = objectSchema(
    {
      code: stringSchema({ example: "aB3kLm9Q", minLength: 1 }),
      url: stringSchema({ example: "https://babyloop.example/s/aB3kLm9Q", format: "uri" }),
      targetPath: stringSchema({ example: `/listings/${UUID_EXAMPLE}`, minLength: 1 })
    },
    ["code", "url", "targetPath"]
  );

  for (const method of ["GET", "POST"] as const) {
    setExactResponseSchema(
      method,
      "/listings/:id/share-link",
      "200",
      successEnvelopeWithDataSchema(
        "İlan için kalıcı kısa paylaşım linki döner.",
        objectSchema({ shareLink }, ["shareLink"])
      )
    );
  }

  setExactResponseSchema(
    "GET",
    "/share-links/:code/resolve",
    "200",
    successEnvelopeWithDataSchema(
      "Kısa link hedefini döner.",
      objectSchema(
        { targetPath: stringSchema({ example: `/listings/${UUID_EXAMPLE}`, minLength: 1 }) },
        ["targetPath"]
      )
    )
  );

  for (const path of ["/auth/logout", "/auth/backoffice/logout"]) {
    setExactResponseSchema(
      "POST",
      path,
      "200",
      successEnvelopeWithDataSchema(
        "Oturum cookie'leri temizlenir.",
        objectSchema({ loggedOut: literalBooleanSchema(true) }, ["loggedOut"])
      )
    );
  }

  setExactResponseSchema(
    "DELETE",
    "/listings/:id/images/:imageId",
    "200",
    successEnvelopeWithDataSchema(
      "İlan görseli silindi.",
      objectSchema({ deleted: literalBooleanSchema(true) }, ["deleted"])
    )
  );
  setExactResponseSchema(
    "DELETE",
    "/child-profiles/:childProfileId",
    "200",
    successEnvelopeWithDataSchema(
      "Çocuk profili silindi.",
      objectSchema({ deleted: literalBooleanSchema(true) }, ["deleted"])
    )
  );
  setExactResponseSchema(
    "DELETE",
    "/child-profiles/:childProfileId/notes/:noteId",
    "200",
    successEnvelopeWithDataSchema(
      "Not arşivlendi.",
      objectSchema({ archived: literalBooleanSchema(true) }, ["archived"])
    )
  );
  setExactResponseSchema(
    "DELETE",
    "/child-profiles/:childProfileId/reminders/:reminderId",
    "200",
    successEnvelopeWithDataSchema(
      "Hatırlatıcı iptal edildi.",
      objectSchema({ cancelled: literalBooleanSchema(true) }, ["cancelled"])
    )
  );
  setExactResponseSchema(
    "DELETE",
    "/notifications/push-tokens",
    "200",
    successEnvelopeWithDataSchema(
      "Push token iptal edildi.",
      objectSchema({ revoked: literalBooleanSchema(true) }, ["revoked"])
    )
  );
  setExactResponseSchema(
    "GET",
    "/notifications/unread-count",
    "200",
    successEnvelopeWithDataSchema(
      "Okunmamış bildirim sayısını döner.",
      objectSchema(
        { count: integerSchema({ example: 3, minimum: 0 }) },
        ["count"]
      )
    )
  );
  setExactResponseSchema(
    "PATCH",
    "/notifications/read-all",
    "200",
    successEnvelopeWithDataSchema(
      "Tüm bildirimleri okundu olarak işaretler.",
      objectSchema(
        { updatedCount: integerSchema({ example: 3, minimum: 0 }) },
        ["updatedCount"]
      )
    )
  );
}

function setExactResponsesForPaths(
  method: string,
  paths: string[],
  statuses: string[]
): void {
  for (const path of paths) {
    setExactResponses(method, path, statuses);
  }
}

function setExactResponseSchemas(
  method: string,
  path: string,
  response: Record<string, JsonSchema>
): void {
  const key = `${method.toUpperCase()} ${path}`;
  const existing = ROUTE_CONTRACTS[key] ?? {};

  ROUTE_CONTRACTS[key] = {
    ...existing,
    replaceDefaultResponses: true,
    response
  };
}

function setExactResponseSchema(
  method: string,
  path: string,
  status: string,
  schema: JsonSchema
): void {
  const key = `${method.toUpperCase()} ${path}`;
  const existing = ROUTE_CONTRACTS[key] ?? {};

  ROUTE_CONTRACTS[key] = {
    ...existing,
    replaceDefaultResponses: true,
    response: {
      ...(existing.response ?? {}),
      [status]: schema
    }
  };
}

function setExactResponses(
  method: string,
  path: string,
  statuses: string[]
): void {
  const key = `${method.toUpperCase()} ${path}`;
  const existing = ROUTE_CONTRACTS[key] ?? {};

  ROUTE_CONTRACTS[key] = {
    ...existing,
    replaceDefaultResponses: true,
    response: Object.fromEntries(
      statuses.map((status) => [
        status,
        status.startsWith("2")
          ? successEnvelopeSchema(successStatusDescription(status))
          : errorEnvelopeSchema(errorStatusDescription(status))
      ])
    )
  };
}

function successStatusDescription(status: string): string {
  if (status === "201") {
    return "Kaynak başarıyla oluşturuldu.";
  }

  if (status === "202") {
    return "İstek kabul edildi ve işlem sonucu bekleniyor.";
  }

  return "İstek başarıyla tamamlandı.";
}

function errorStatusDescription(status: string): string {
  switch (status) {
    case "400":
      return "İstek doğrulaması başarısız.";
    case "402":
      return "Mock ödeme senaryosu başarısız oldu.";
    case "401":
      return "Kimlik doğrulaması gerekli.";
    case "403":
      return "Bu işlem için yetki yok.";
    case "404":
      return "Kaynak bulunamadı.";
    case "409":
      return "İstek mevcut durumla çakışıyor.";
    case "413":
      return "İstek gövdesi veya yüklenen dosya çok büyük.";
    case "429":
      return "İstek sınırı aşıldı.";
    case "500":
      return "Beklenmeyen sunucu hatası.";
    default:
      return "Bağımlı servis şu anda kullanılamıyor.";
  }
}

function addBody(method: string, path: string, schema: JsonSchema): void {
  BODY_CONTRACTS[`${method.toUpperCase()} ${path}`] = schema;
}

function addQuery(method: string, path: string, schema: JsonSchema): void {
  QUERY_CONTRACTS[`${method.toUpperCase()} ${path}`] = schema;
}

function defaultResponses(path: string): Record<string, JsonSchema> {
  if (path.startsWith("/uploads/")) {
    return {
      "404": errorEnvelopeSchema("Kaynak bulunamadı.")
    };
  }

  return {
    "200": successEnvelopeSchema("İstek başarıyla tamamlandı."),
    "201": successEnvelopeSchema("Kaynak başarıyla oluşturuldu."),
    "400": errorEnvelopeSchema("İstek doğrulaması başarısız."),
    "401": errorEnvelopeSchema("Kimlik doğrulaması gerekli."),
    "403": errorEnvelopeSchema("Bu işlem için yetki yok."),
    "404": errorEnvelopeSchema("Kaynak bulunamadı."),
    "409": errorEnvelopeSchema("İstek mevcut durumla çakışıyor."),
    "429": errorEnvelopeSchema("İstek sınırı aşıldı."),
    "503": errorEnvelopeSchema("Bağımlı servis şu anda kullanılamıyor.")
  };
}

function successEnvelopeWithDataSchema(
  description: string,
  data: JsonSchema
): JsonSchema {
  return {
    description,
    type: "object",
    additionalProperties: false,
    required: ["ok", "data"],
    properties: {
      ok: {
        type: "boolean",
        enum: [true],
        example: true
      },
      data
    }
  };
}

function literalBooleanSchema(value: boolean): JsonSchema {
  return {
    type: "boolean",
    enum: [value],
    example: value
  };
}

function redirectResponseSchema(description: string): JsonSchema {
  return {
    description
  };
}

function successEnvelopeSchema(description: string): JsonSchema {
  return {
    description,
    type: "object",
    additionalProperties: false,
    required: ["ok", "data"],
    properties: {
      ok: {
        type: "boolean",
        enum: [true],
        example: true
      },
      data: {
        type: "object",
        additionalProperties: true,
        description: "Endpoint'e özgü güvenli response verisi."
      }
    }
  };
}

function errorEnvelopeSchema(description: string): JsonSchema {
  return {
    description,
    type: "object",
    additionalProperties: false,
    required: ["ok", "error"],
    properties: {
      ok: {
        type: "boolean",
        enum: [false],
        example: false
      },
      error: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            example: "INVALID_REQUEST"
          },
          message: {
            type: "string",
            example: description
          }
        }
      }
    }
  };
}

function createPathParamsSchema(path: string): JsonSchema | undefined {
  const names = Array.from(
    path.matchAll(/:([A-Za-z0-9_]+)/gu),
    (match) => match[1]
  ).filter((name): name is string => Boolean(name));

  if (names.length === 0) {
    return undefined;
  }

  const properties: Record<string, JsonSchema> = {};

  for (const name of names) {
    const isUuid =
      name === "id" ||
      name.endsWith("Id") ||
      name.endsWith("_id");

    properties[name] = isUuid
      ? uuidSchema(`${name} path parametresi`)
      : stringSchema({
          description: `${name} path parametresi`,
          example: name === "filename" ? "listing-image.webp" : "example"
        });
  }

  return objectSchema(properties, names);
}

function mergeObjectSchemas(...values: unknown[]): JsonSchema | undefined {
  const schemas = values.filter(isRecord);

  if (schemas.length === 0) {
    return undefined;
  }

  const merged = Object.assign({}, ...schemas);
  const properties = Object.assign(
    {},
    ...schemas.map((schema) =>
      isRecord(schema.properties) ? schema.properties : {}
    )
  );

  const required = Array.from(
    new Set(
      schemas.flatMap((schema) =>
        Array.isArray(schema.required)
          ? schema.required.filter(
              (value): value is string => typeof value === "string"
            )
          : []
      )
    )
  );

  return removeUndefinedValues({
    ...merged,
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {})
  });
}

function mergeResponses(
  ...values: unknown[]
): Record<string, JsonSchema> {
  const result: Record<string, JsonSchema> = {};

  for (const value of values) {
    if (!isRecord(value)) {
      continue;
    }

    for (const [status, schema] of Object.entries(value)) {
      if (isRecord(schema)) {
        result[status] = schema;
      }
    }
  }

  return result;
}

function objectSchema(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
  extra: JsonSchema = {}
): JsonSchema {
  return removeUndefinedValues({
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length > 0 ? { required } : {}),
    ...extra
  });
}

function stringSchema(options: {
  defaultValue?: string;
  description?: string;
  example?: string;
  format?: string;
  maxLength?: number;
  minLength?: number;
  nullable?: boolean;
  pattern?: string;
} = {}): JsonSchema {
  return removeUndefinedValues({
    type: "string",
    description: options.description,
    example: options.example,
    format: options.format,
    maxLength: options.maxLength,
    minLength: options.minLength,
    nullable: options.nullable,
    pattern: options.pattern,
    default: options.defaultValue
  });
}

function emailSchema(example: string): JsonSchema {
  return stringSchema({
    example,
    format: "email",
    maxLength: 320,
    minLength: 3
  });
}

function uuidSchema(
  description = "UUID",
  example = UUID_EXAMPLE
): JsonSchema {
  return stringSchema({
    description,
    example,
    format: "uuid"
  });
}

function optionalDecimalInputSchema(example: string): JsonSchema {
  return {
    oneOf: [
      {
        type: "string",
        enum: [""],
        description: "Boş metin fiyat değerini temizler."
      },
      {
        type: "string",
        example,
        pattern: "^(0|[1-9]\\d{0,9})(\\.\\d{1,2})?$"
      }
    ]
  };
}

function currencyCodeSchema(example: string): JsonSchema {
  return stringSchema({
    example,
    maxLength: 3,
    minLength: 3,
    pattern: "^[A-Za-z]{3}$"
  });
}

function decimalStringSchema(example: string): JsonSchema {
  return stringSchema({
    example,
    pattern: "^(0|[1-9]\\d{0,9})(\\.\\d{1,2})?$"
  });
}

function enumSchema(
  values: readonly string[],
  options: {
    defaultValue?: string;
    example?: string;
    nullable?: boolean;
  } = {}
): JsonSchema {
  return removeUndefinedValues({
    type: "string",
    enum: [...values],
    default: options.defaultValue,
    example: options.example,
    nullable: options.nullable
  });
}

function integerSchema(options: {
  defaultValue?: number;
  example?: number;
  maximum?: number;
  minimum?: number;
  nullable?: boolean;
} = {}): JsonSchema {
  return removeUndefinedValues({
    type: "integer",
    default: options.defaultValue,
    example: options.example,
    maximum: options.maximum,
    minimum: options.minimum,
    nullable: options.nullable
  });
}

function booleanSchema(example: boolean): JsonSchema {
  return {
    type: "boolean",
    example
  };
}

function localTimeContract(nullable: boolean): JsonSchema {
  return stringSchema({
    example: "10:00",
    nullable,
    pattern: "^[0-2][0-9]:[0-5][0-9]$"
  });
}

function timezoneContract(): JsonSchema {
  return stringSchema({
    defaultValue: "Europe/Istanbul",
    example: "Europe/Istanbul",
    maxLength: 80,
    minLength: 3,
    pattern: "^[A-Za-z_/-]+$"
  });
}

function dateOnlySchema(example: string): JsonSchema {
  return stringSchema({
    example,
    format: "date",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  });
}

function dateTimeSchema(
  example: string,
  nullable = false
): JsonSchema {
  return stringSchema({
    example,
    format: "date-time",
    nullable
  });
}

function normalizeMethod(method: unknown): string {
  if (Array.isArray(method)) {
    return String(method[0] ?? "GET").toUpperCase();
  }

  return String(method ?? "GET").toUpperCase();
}

function normalizeRoutePath(url: string): string {
  let path = url.split("?")[0] ?? url;

  path = path.replace(/\{([A-Za-z0-9_]+)\}/gu, ":$1");

  if (path === "/api/v1") {
    return "/";
  }

  if (path.startsWith("/api/v1/")) {
    path = path.slice("/api/v1".length);
  }

  if (path.length > 1) {
    path = path.replace(/\/+$/u, "");
  }

  return path || "/";
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
