import { analyticsDailyOverview, analyticsEvents, authAccounts, productCategories, users } from "@babyloop/database/schema";
import type { AnalyticsEventName } from "@babyloop/shared";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { FastifyInstance } from "fastify";

export type AdminAnalyticsQuery = {
  from?: string;
  to?: string;
  platform?: "web" | "mobile";
};

export type AdminAnalyticsOverview = {
  totalRegisteredUsers: number;
  demoSystemAccounts: number;
  loginDisabledAccounts: number;
  verifiedUsers: number;
  verifiedRate: number;
  googleLinkedUsers: number;
  googleLinkedRate: number;
  passwordUsers: number;
  dau: number;
  activeUsers: number;
  activeCustomerUsers: number;
  sessions: number;
  averageSessionEngagementMs: number;
  pageViews: number;
  screenViews: number;
  listingViews: number;
  uniqueListingViewers: number;
  favoriteUsers: number;
  chatUsers: number;
  messageSenders: number;
  conversationsStarted: number;
  assistantUsers: number;
  assistantQuestions: number;
  assistantAnswers: number;
  assistantErrors: number;
  assistantGroundedAnswers: number;
  assistantGroundedRate: number;
  registrations: number;
  successfulLogins: number;
  failedLogins: number;
  googleSuccessfulLogins: number;
  emailVerifications: number;
  mfaCompletions: number;
  checkoutUsers: number;
  searches: number;
  contactIntents: number;
  messagesSent: number;
  messagesRead: number;
  activeMessagingParticipants: number;
  childProfilesCreated: number;
  childNotesCreated: number;
  childRemindersCreated: number;
  rawEventsInRange: number;
  lastRawEventAt: string | null;
  lastRollupAt: string | null;
  aggregationStatus: "current" | "pending" | "empty";
  dataSource: "raw_recent";
};

export type AdminAnalyticsPageRow = {
  surface: string;
  platform: string;
  views: number;
  uniqueUsers: number;
  uniqueSessions: number;
  averageEngagementMs: number;
  p50EngagementMs: number;
  p90EngagementMs: number;
  exits: number;
};

export type AdminAnalyticsCategoryRow = {
  categoryId: string;
  categoryName: string;
  platform: string;
  impressions: number;
  listingViews: number;
  uniqueViewers: number;
  favorites: number;
  conversationsStarted: number;
  cartAdds: number;
  checkoutCompleted: number;
};

export type AdminAnalyticsAuthRow = {
  platform: string;
  authProvider: string;
  registrations: number;
  successfulLogins: number;
  failedLogins: number;
  emailVerifications: number;
  mfaCompletions: number;
  approvalCompletions: number;
};

export type AdminAnalyticsDataQuality = {
  duplicateEventsLast7Days: number;
  rejectedEventsLast7Days: number;
  missingSessionIdsLast7Days: number;
  unknownEventVersionsLast7Days: number;
  rawEventsLast7Days: number;
};

export type AdminAnalyticsSection = {
  title: string;
  metrics: Array<{
    label: string;
    value: number;
    unit?: "count" | "percent" | "milliseconds";
  }>;
};

export async function getAdminAnalyticsOverview(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsOverview> {
  const range = normalizeAnalyticsRange(query);
  const [userSnapshot, googleSnapshot, passwordSnapshot, raw, daily] = await Promise.all([
    getUserSnapshot(app, query, range),
    getProviderSnapshot(app, "google"),
    getProviderSnapshot(app, "password"),
    app.db
      .select({
        activeUsers: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash}))::int`,
        assistantAnswers: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'assistant_answer_received')::int`,
        assistantGroundedAnswers: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'assistant_answer_received' and ${analyticsEvents.properties}->>'grounded' = 'true')::int`,
        assistantErrors: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'assistant_error')::int`,
        assistantQuestions: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'assistant_question_submitted')::int`,
        assistantUsers: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash})) filter (where ${analyticsEvents.eventName} in ('assistant_opened', 'assistant_question_submitted', 'assistant_answer_received'))::int`,
        checkoutUsers: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash})) filter (where ${analyticsEvents.eventName} in ('checkout_started', 'checkout_completed'))::int`,
        contactIntents: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'seller_contact_clicked')::int`,
        conversationsStarted: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'conversation_started')::int`,
        emailVerifications: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'email_verification_completed')::int`,
        engagedMs: sql<number>`coalesce(sum(${analyticsEvents.engagementMs}) filter (where ${analyticsEvents.eventName} = 'engagement_heartbeat'), 0)::int`,
        failedLogins: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'login_failed')::int`,
        favorites: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash})) filter (where ${analyticsEvents.eventName} = 'listing_favorited')::int`,
        lastRawEventAt: sql<Date | null>`max(${analyticsEvents.receivedAt})`,
        listingViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'listing_opened')::int`,
        googleSuccessfulLogins: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'login_completed' and ${analyticsEvents.authProvider} = 'google')::int`,
        mfaCompletions: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'mfa_completed')::int`,
        registrations: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'registration_completed')::int`,
        successfulLogins: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'login_completed')::int`,
        activeMessagingParticipants: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash})) filter (where ${analyticsEvents.eventName} in ('conversation_started', 'message_sent', 'message_marked_read'))::int`,
        messageSenders: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash})) filter (where ${analyticsEvents.eventName} = 'message_sent')::int`,
        messagesSent: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'message_sent')::int`,
        messagesRead: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'message_marked_read')::int`,
        childProfilesCreated: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'child_profile_created')::int`,
        childNotesCreated: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'child_note_created')::int`,
        childRemindersCreated: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'child_reminder_created')::int`,
        pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'page_viewed')::int`,
        rawEvents: sql<number>`count(*)::int`,
        screenViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'screen_viewed')::int`,
        searches: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'search_submitted')::int`,
        sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
        uniqueListingViewers: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash})) filter (where ${analyticsEvents.eventName} = 'listing_opened')::int`
      })
      .from(analyticsEvents)
      .leftJoin(users, eq(analyticsEvents.userId, users.id))
      .where(buildRawWhere(query, range, customerOrAnonymousWhere())),
    app.db
      .select({
        lastRollupAt: sql<Date | null>`max(${analyticsDailyOverview.updatedAt})`
      })
      .from(analyticsDailyOverview)
      .where(buildDailyWhere(query, range))
  ]);

  const rawRow = raw[0];
  const dailyRow = daily[0];
  const sessions = rawRow?.sessions ?? 0;
  const lastRawEventAt = formatDateLike(rawRow?.lastRawEventAt);
  const lastRollupAt = formatDateLike(dailyRow?.lastRollupAt);
  const aggregationStatus = (rawRow?.rawEvents ?? 0) === 0
    ? "empty"
    : !lastRollupAt || (lastRawEventAt && lastRollupAt < lastRawEventAt)
      ? "pending"
      : "current";

  return {
    activeCustomerUsers: userSnapshot.activeCustomerUsers,
    activeUsers: rawRow?.activeUsers ?? 0,
    aggregationStatus,
    assistantAnswers: rawRow?.assistantAnswers ?? 0,
    assistantGroundedAnswers: rawRow?.assistantGroundedAnswers ?? 0,
    assistantGroundedRate: calculateRate(rawRow?.assistantGroundedAnswers ?? 0, rawRow?.assistantAnswers ?? 0),
    assistantErrors: rawRow?.assistantErrors ?? 0,
    assistantQuestions: rawRow?.assistantQuestions ?? 0,
    assistantUsers: rawRow?.assistantUsers ?? 0,
    averageSessionEngagementMs: sessions > 0 ? Math.round((rawRow?.engagedMs ?? 0) / sessions) : 0,
    chatUsers: rawRow?.messageSenders ?? 0,
    checkoutUsers: rawRow?.checkoutUsers ?? 0,
    contactIntents: rawRow?.contactIntents ?? 0,
    conversationsStarted: rawRow?.conversationsStarted ?? 0,
    emailVerifications: rawRow?.emailVerifications ?? 0,
    failedLogins: rawRow?.failedLogins ?? 0,
    dataSource: "raw_recent",
    dau: rawRow?.activeUsers ?? 0,
    demoSystemAccounts: userSnapshot.demoSystemAccounts,
    favoriteUsers: rawRow?.favorites ?? 0,
    googleLinkedRate: calculateRate(googleSnapshot, userSnapshot.totalRegisteredUsers),
    googleLinkedUsers: googleSnapshot,
    googleSuccessfulLogins: rawRow?.googleSuccessfulLogins ?? 0,
    lastRawEventAt,
    lastRollupAt,
    listingViews: rawRow?.listingViews ?? 0,
    loginDisabledAccounts: userSnapshot.loginDisabledAccounts,
    messageSenders: rawRow?.messageSenders ?? 0,
    messagesSent: rawRow?.messagesSent ?? 0,
    messagesRead: rawRow?.messagesRead ?? 0,
    activeMessagingParticipants: rawRow?.activeMessagingParticipants ?? 0,
    childProfilesCreated: rawRow?.childProfilesCreated ?? 0,
    childNotesCreated: rawRow?.childNotesCreated ?? 0,
    childRemindersCreated: rawRow?.childRemindersCreated ?? 0,
    mfaCompletions: rawRow?.mfaCompletions ?? 0,
    pageViews: rawRow?.pageViews ?? 0,
    passwordUsers: passwordSnapshot,
    rawEventsInRange: rawRow?.rawEvents ?? 0,
    registrations: rawRow?.registrations ?? 0,
    screenViews: rawRow?.screenViews ?? 0,
    searches: rawRow?.searches ?? 0,
    sessions,
    successfulLogins: rawRow?.successfulLogins ?? 0,
    totalRegisteredUsers: userSnapshot.totalRegisteredUsers,
    uniqueListingViewers: rawRow?.uniqueListingViewers ?? 0,
    verifiedRate: calculateRate(userSnapshot.verifiedUsers, userSnapshot.totalRegisteredUsers),
    verifiedUsers: userSnapshot.verifiedUsers
  };
}

export async function listAdminAnalyticsPages(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsPageRow[]> {
  const range = normalizeAnalyticsRange(query);
  const rows = await app.db
    .select({
      averageEngagedMs: sql<number>`coalesce(avg(${analyticsEvents.engagementMs}) filter (where ${analyticsEvents.engagementMs} is not null), 0)::int`,
      exits: sql<number>`0::int`,
      p50EngagedMs: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${analyticsEvents.engagementMs}) filter (where ${analyticsEvents.engagementMs} is not null), 0)::int`,
      p90EngagedMs: sql<number>`coalesce(percentile_cont(0.9) within group (order by ${analyticsEvents.engagementMs}) filter (where ${analyticsEvents.engagementMs} is not null), 0)::int`,
      platform: analyticsEvents.platform,
      surface: sql<string>`coalesce(${analyticsEvents.routeTemplate}, ${analyticsEvents.screenName}, 'Bilinmeyen yüzey')`,
      uniqueSessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
      uniqueUsers: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash}))::int`,
      views: sql<number>`count(*) filter (where ${analyticsEvents.eventName} in ('page_viewed', 'screen_viewed'))::int`
    })
    .from(analyticsEvents)
    .leftJoin(users, eq(analyticsEvents.userId, users.id))
    .where(buildRawWhere(query, range, customerOrAnonymousWhere()))
    .groupBy(analyticsEvents.platform, sql`coalesce(${analyticsEvents.routeTemplate}, ${analyticsEvents.screenName}, 'Bilinmeyen yüzey')`)
    .having(sql`count(*) filter (where ${analyticsEvents.eventName} in ('page_viewed', 'screen_viewed')) > 0`)
    .orderBy(desc(sql`count(*) filter (where ${analyticsEvents.eventName} in ('page_viewed', 'screen_viewed'))`))
    .limit(50);

  return rows.map((row) => ({
    averageEngagementMs: row.averageEngagedMs,
    exits: row.exits,
    p50EngagementMs: row.p50EngagedMs,
    p90EngagementMs: row.p90EngagedMs,
    platform: row.platform,
    surface: row.surface,
    uniqueSessions: row.uniqueSessions,
    uniqueUsers: row.uniqueUsers,
    views: row.views
  }));
}

export async function listAdminAnalyticsCategories(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsCategoryRow[]> {
  const range = normalizeAnalyticsRange(query);
  const rows = await app.db
    .select({
      cartAdds: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'cart_item_added')::int`,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      checkoutCompleted: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'checkout_completed')::int`,
      conversationsStarted: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'conversation_started')::int`,
      favorites: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'listing_favorited')::int`,
      impressions: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'listing_impression')::int`,
      listingViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'listing_opened')::int`,
      platform: analyticsEvents.platform,
      uniqueViewers: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash})) filter (where ${analyticsEvents.eventName} = 'listing_opened')::int`
    })
    .from(analyticsEvents)
    .innerJoin(productCategories, eq(analyticsEvents.categoryId, productCategories.id))
    .leftJoin(users, eq(analyticsEvents.userId, users.id))
    .where(buildRawWhere(query, range, customerOrAnonymousWhere()))
    .groupBy(productCategories.id, productCategories.name, analyticsEvents.platform)
    .orderBy(desc(sql`count(*) filter (where ${analyticsEvents.eventName} = 'listing_opened')`))
    .limit(50);

  return rows;
}

export async function listAdminAnalyticsAuth(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsAuthRow[]> {
  const range = normalizeAnalyticsRange(query);
  return app.db
    .select({
      approvalCompletions: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'login_approval_completed')::int`,
      authProvider: sql<string>`coalesce(${analyticsEvents.authProvider}, 'unknown')`,
      emailVerifications: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'email_verification_completed')::int`,
      failedLogins: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'login_failed')::int`,
      mfaCompletions: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'mfa_completed')::int`,
      platform: analyticsEvents.platform,
      registrations: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'registration_completed')::int`,
      successfulLogins: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'login_completed')::int`
    })
    .from(analyticsEvents)
    .leftJoin(users, eq(analyticsEvents.userId, users.id))
    .where(buildRawWhere(query, range, customerOrAnonymousWhere()))
    .groupBy(analyticsEvents.platform, sql`coalesce(${analyticsEvents.authProvider}, 'unknown')`)
    .having(sql`count(*) filter (where ${analyticsEvents.eventName} in ('registration_completed', 'login_completed', 'login_failed', 'email_verification_completed', 'mfa_completed', 'login_approval_completed')) > 0`)
    .orderBy(analyticsEvents.platform, sql`coalesce(${analyticsEvents.authProvider}, 'unknown')`);
}

export async function getAdminAnalyticsDataQuality(
  app: FastifyInstance
): Promise<AdminAnalyticsDataQuality> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [row] = await app.db
    .select({
      missingSessionIds: sql<number>`count(*) filter (where ${analyticsEvents.sessionId} = '')::int`,
      rawEvents: sql<number>`count(*)::int`,
      unknownVersions: sql<number>`count(*) filter (where ${analyticsEvents.eventVersion} <> 1)::int`
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.receivedAt, since));

  return {
    duplicateEventsLast7Days: 0,
    missingSessionIdsLast7Days: row?.missingSessionIds ?? 0,
    rawEventsLast7Days: row?.rawEvents ?? 0,
    rejectedEventsLast7Days: 0,
    unknownEventVersionsLast7Days: row?.unknownVersions ?? 0
  };
}

export async function getAdminAnalyticsUsers(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsSection> {
  const overview = await getAdminAnalyticsOverview(app, query);

  return {
    title: "Kullanıcılar",
    metrics: [
      { label: "Toplam kullanıcı", value: overview.totalRegisteredUsers },
      { label: "Doğrulanmış kullanıcı", value: overview.verifiedUsers },
      { label: "Doğrulama oranı", value: overview.verifiedRate, unit: "percent" },
      { label: "Aktif kullanıcı", value: overview.activeUsers },
      { label: "Google bağlantılı", value: overview.googleLinkedUsers },
      { label: "Şifre hesabı", value: overview.passwordUsers }
    ]
  };
}

export async function getAdminAnalyticsEngagement(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<{
  pages: AdminAnalyticsPageRow[];
  summary: AdminAnalyticsSection;
}> {
  const overview = await getAdminAnalyticsOverview(app, query);

  return {
    pages: await listAdminAnalyticsPages(app, query),
    summary: {
      title: "Etkileşim",
      metrics: [
        { label: "Oturum", value: overview.sessions },
        { label: "Sayfa görüntüleme", value: overview.pageViews },
        { label: "Ekran görüntüleme", value: overview.screenViews },
        { label: "Ortalama etkileşim", value: overview.averageSessionEngagementMs, unit: "milliseconds" }
      ]
    }
  };
}

export async function getAdminAnalyticsMarketplace(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<{
  categories: AdminAnalyticsCategoryRow[];
  summary: AdminAnalyticsSection;
}> {
  const overview = await getAdminAnalyticsOverview(app, query);

  return {
    categories: await listAdminAnalyticsCategories(app, query),
    summary: {
      title: "Pazaryeri",
      metrics: [
        { label: "İlan görüntüleme", value: overview.listingViews },
        { label: "Tekil ilan izleyici", value: overview.uniqueListingViewers },
        { label: "Favori", value: overview.favoriteUsers },
        { label: "Ödeme adımına geçen", value: overview.checkoutUsers },
        { label: "Arama", value: overview.searches },
        { label: "İletişim niyeti", value: overview.contactIntents }
      ]
    }
  };
}

export async function getAdminAnalyticsMessaging(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsSection> {
  const overview = await getAdminAnalyticsOverview(app, query);

  return {
    title: "Mesajlaşma",
    metrics: [
      { label: "Sohbet kullanıcıları", value: overview.chatUsers },
      { label: "Mesaj gönderenler", value: overview.messageSenders },
      { label: "Gönderilen mesaj", value: overview.messagesSent },
      { label: "Başlatılan konuşmalar", value: overview.conversationsStarted }
    ]
  };
}

export async function getAdminAnalyticsAssistant(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsSection> {
  const range = normalizeAnalyticsRange(query);
  const counts = await countEventsByNames(app, query, range, [
    "assistant_opened",
    "assistant_question_submitted",
    "assistant_answer_received",
    "assistant_error",
    "assistant_suggested_action_clicked"
  ]);

  return {
    title: "Asistan ve RAG",
    metrics: [
      { label: "Asistan açılışı", value: counts.get("assistant_opened") ?? 0 },
      { label: "Soru", value: counts.get("assistant_question_submitted") ?? 0 },
      { label: "Yanıt", value: counts.get("assistant_answer_received") ?? 0 },
      { label: "Hata", value: counts.get("assistant_error") ?? 0 },
      { label: "Aksiyon tıklaması", value: counts.get("assistant_suggested_action_clicked") ?? 0 }
    ]
  };
}

export async function getAdminAnalyticsChild(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsSection> {
  const range = normalizeAnalyticsRange(query);
  const counts = await countEventsByNames(app, query, range, [
    "child_profile_created",
    "child_profile_opened",
    "child_note_created",
    "child_reminder_created",
    "child_reminder_updated",
    "child_reminder_deleted"
  ]);

  return {
    title: "Çocuk & Hatırlatıcılar",
    metrics: [
      { label: "Çocuk profili", value: counts.get("child_profile_created") ?? 0 },
      { label: "Profil açılışı", value: counts.get("child_profile_opened") ?? 0 },
      { label: "Not", value: counts.get("child_note_created") ?? 0 },
      { label: "Hatırlatıcı oluşturma", value: counts.get("child_reminder_created") ?? 0 },
      { label: "Hatırlatıcı güncelleme", value: counts.get("child_reminder_updated") ?? 0 },
      { label: "Hatırlatıcı silme", value: counts.get("child_reminder_deleted") ?? 0 }
    ]
  };
}

export async function getAdminAnalyticsFunnels(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<Array<{
  name: string;
  steps: Array<{
    label: string;
    users: number;
  }>;
}>> {
  const range = normalizeAnalyticsRange(query);
  const counts = await countEventsByNames(app, query, range, [
    "registration_completed",
    "email_verification_completed",
    "login_completed",
    "browse_viewed",
    "listing_opened",
    "listing_favorited",
    "conversation_started",
    "sell_flow_started",
    "sell_image_added",
    "ai_listing_draft_generated",
    "listing_created",
    "cart_viewed",
    "checkout_started",
    "checkout_completed",
    "assistant_opened",
    "assistant_question_submitted",
    "assistant_answer_received",
    "assistant_suggested_action_clicked"
  ]);

  return [
    {
      name: "Kayıt → doğrulama → giriş",
      steps: [
        { label: "Kayıt", users: counts.get("registration_completed") ?? 0 },
        { label: "Doğrulama", users: counts.get("email_verification_completed") ?? 0 },
        { label: "Giriş", users: counts.get("login_completed") ?? 0 }
      ]
    },
    {
      name: "Keşfet → ilan → favori → sohbet",
      steps: [
        { label: "Keşfet", users: counts.get("browse_viewed") ?? 0 },
        { label: "İlan", users: counts.get("listing_opened") ?? 0 },
        { label: "Favori", users: counts.get("listing_favorited") ?? 0 },
        { label: "Sohbet", users: counts.get("conversation_started") ?? 0 }
      ]
    },
    {
      name: "Satış → AI taslağı → ilan",
      steps: [
        { label: "Satış başlangıcı", users: counts.get("sell_flow_started") ?? 0 },
        { label: "Görsel", users: counts.get("sell_image_added") ?? 0 },
        { label: "AI taslağı", users: counts.get("ai_listing_draft_generated") ?? 0 },
        { label: "İlan oluşturma", users: counts.get("listing_created") ?? 0 }
      ]
    },
    {
      name: "Sepet → ödeme",
      steps: [
        { label: "Sepet", users: counts.get("cart_viewed") ?? 0 },
        { label: "Ödeme başlangıcı", users: counts.get("checkout_started") ?? 0 },
        { label: "Ödeme tamamlandı", users: counts.get("checkout_completed") ?? 0 }
      ]
    },
    {
      name: "Asistan → yanıt → aksiyon",
      steps: [
        { label: "Açılış", users: counts.get("assistant_opened") ?? 0 },
        { label: "Soru", users: counts.get("assistant_question_submitted") ?? 0 },
        { label: "Yanıt", users: counts.get("assistant_answer_received") ?? 0 },
        { label: "Aksiyon", users: counts.get("assistant_suggested_action_clicked") ?? 0 }
      ]
    }
  ];
}

function normalizeAnalyticsRange(query: AdminAnalyticsQuery): { from: string; to: string } {
  const today = new Date();
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric"
  });
  const defaultTo = dateFormatter.format(today);
  const defaultFrom = dateFormatter.format(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
  return {
    from: query.from ?? defaultFrom,
    to: query.to ?? defaultTo
  };
}

function buildDailyWhere(
  query: AdminAnalyticsQuery,
  range: { from: string; to: string },
  dateColumn: AnyPgColumn = analyticsDailyOverview.date,
  platformColumn: AnyPgColumn = analyticsDailyOverview.platform
): SQL | undefined {
  const clauses: SQL[] = [
    gte(dateColumn, range.from),
    lte(dateColumn, range.to)
  ];

  if (query.platform) {
    clauses.push(eq(platformColumn, query.platform));
  }

  return and(...clauses);
}

function buildRawWhere(
  query: AdminAnalyticsQuery,
  range: { from: string; to: string },
  extra?: SQL
): SQL | undefined {
  const clauses: SQL[] = [
    gte(analyticsEvents.occurredAt, new Date(`${range.from}T00:00:00+03:00`)),
    lte(analyticsEvents.occurredAt, new Date(`${range.to}T23:59:59.999+03:00`))
  ];

  if (query.platform) clauses.push(eq(analyticsEvents.platform, query.platform));
  if (extra) clauses.push(extra);
  return and(...clauses);
}

async function countEventsByNames(
  app: FastifyInstance,
  query: AdminAnalyticsQuery,
  range: { from: string; to: string },
  eventNames: AnalyticsEventName[]
): Promise<Map<AnalyticsEventName, number>> {
  const clauses: SQL[] = [inArray(analyticsEvents.eventName, eventNames)];
  const rawWhere = buildRawWhere(query, range, customerOrAnonymousWhere());
  if (rawWhere) clauses.push(rawWhere);

  const rows = await app.db
    .select({
      eventName: analyticsEvents.eventName,
      users: sql<number>`count(distinct coalesce(${analyticsEvents.userId}::text, ${analyticsEvents.anonymousIdHash}))::int`
    })
    .from(analyticsEvents)
    .leftJoin(users, eq(analyticsEvents.userId, users.id))
    .where(and(...clauses))
    .groupBy(analyticsEvents.eventName);

  return new Map(rows.map((row) => [row.eventName as AnalyticsEventName, row.users]));
}

async function getUserSnapshot(app: FastifyInstance, query: AdminAnalyticsQuery, range: { from: string; to: string }): Promise<{
  totalRegisteredUsers: number;
  demoSystemAccounts: number;
  loginDisabledAccounts: number;
  activeCustomerUsers: number;
  verifiedUsers: number;
}> {
  const [[row], [active]] = await Promise.all([
    app.db.select({
      totalRegisteredUsers: sql<number>`count(*) filter (where ${users.isDemoSystemAccount} = false)::int`,
      demoSystemAccounts: sql<number>`count(*) filter (where ${users.isDemoSystemAccount} = true)::int`,
      loginDisabledAccounts: sql<number>`count(*) filter (where ${users.isDemoSystemAccount} = false and ${users.loginDisabled} = true)::int`,
      verifiedUsers: sql<number>`count(*) filter (where ${users.isDemoSystemAccount} = false and ${users.emailVerifiedAt} is not null)::int`
    }).from(users),
    app.db.select({
      activeCustomerUsers: sql<number>`count(distinct ${analyticsEvents.userId})::int`
    })
      .from(analyticsEvents)
      .innerJoin(users, eq(analyticsEvents.userId, users.id))
      .where(buildRawWhere(query, range, eq(users.isDemoSystemAccount, false)))
  ]);

  return {
    activeCustomerUsers: active?.activeCustomerUsers ?? 0,
    demoSystemAccounts: row?.demoSystemAccounts ?? 0,
    loginDisabledAccounts: row?.loginDisabledAccounts ?? 0,
    totalRegisteredUsers: row?.totalRegisteredUsers ?? 0,
    verifiedUsers: row?.verifiedUsers ?? 0
  };
}

async function getProviderSnapshot(app: FastifyInstance, provider: "google" | "password"): Promise<number> {
  const [row] = await app.db
    .select({ itemCount: sql<number>`count(distinct ${authAccounts.userId})::int` })
    .from(authAccounts)
    .innerJoin(users, eq(authAccounts.userId, users.id))
    .where(and(eq(authAccounts.provider, provider), eq(users.isDemoSystemAccount, false)));

  return row?.itemCount ?? 0;
}

function customerOrAnonymousWhere(): SQL {
  return or(
    isNull(analyticsEvents.userId),
    eq(users.isDemoSystemAccount, false)
  )!;
}

function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function formatDateLike(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}
