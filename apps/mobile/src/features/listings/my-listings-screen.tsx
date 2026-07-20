import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../ui/screen";
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileSkeleton
} from "../../ui/mobile-primitives";
import {
  buildMobileListingChips,
  MobileListingCard
} from "../../ui/mobile-listing-card";
import { formatMobileListingAgeRange } from "./listing-age-range-model";
import { colors, radius, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  fetchMobileMyListings,
  updateMobileListingStatus,
  type MobileListingStatus,
  type MobileMyListingSummary
} from "./listings-api";
import {
  canSubmitMobileListingStatusAction,
  filterMobileMyListings,
  getMobileListingPublicationDisplay,
  getMobileListingStatusActionMessage,
  getMobileListingStatusActions,
  hasPendingMobileListingPublication,
  getMobileMyListingStats,
  getMobileMyListingStatusFilterLabel,
  MOBILE_MY_LISTING_STATUS_FILTERS,
  type MobileListingStatusAction,
  type MobileMyListingStatusFilter
} from "./my-listings-model";
import { MobilePublicationWaitIndicator } from "./mobile-publication-wait-indicator";
import {
  getMobilePendingPublicationPollDelay,
  shouldPollMobilePendingPublication
} from "./my-listings-runtime-model";

type LoadStatus = "idle" | "loading" | "ready" | "guest" | "error";

export function MyListingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ publication?: string }>();
  const authSession = useAuthSession();
  const [listings, setListings] = useState<MobileMyListingSummary[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<MobileMyListingStatusFilter>("all");
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPublicationConfirmation, setShowPublicationConfirmation] = useState(
    params.publication === "review",
  );
  const [isFocused, setIsFocused] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const loadRequestIdRef = useRef(0);

  const stats = useMemo(() => getMobileMyListingStats(listings), [listings]);
  const visibleListings = useMemo(
    () => filterMobileMyListings(listings, selectedFilter),
    [listings, selectedFilter]
  );
  const hasPendingPublication = useMemo(
    () => hasPendingMobileListingPublication(listings),
    [listings]
  );

  useEffect(() => {
    if (params.publication === "review") {
      setShowPublicationConfirmation(true);
    }
  }, [params.publication]);

  useEffect(() => {
    if (status === "ready" && showPublicationConfirmation && !hasPendingPublication) {
      setShowPublicationConfirmation(false);
    }
  }, [hasPendingPublication, showPublicationConfirmation, status]);

  const loadListings = useCallback(async () => {
    if (authSession.status === "checking") {
      setStatus("loading");
      return;
    }

    if (!authSession.currentUser) {
      loadRequestIdRef.current += 1;
      setListings([]);
      setStatus("guest");
      setError(null);
      return;
    }

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    try {
      setStatus("loading");
      setError(null);
      setSuccessMessage(null);

      const nextListings = await fetchMobileMyListings();

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setListings(nextListings);
      setStatus("ready");
    } catch (loadError) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "İlanların yüklenemedi.");
    }
  }, [authSession.currentUser, authSession.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      void loadListings();

      return () => {
        setIsFocused(false);
        loadRequestIdRef.current += 1;
      };
    }, [loadListings])
  );

  useEffect(() => {
    if (!shouldPollMobilePendingPublication({
      appState,
      hasCurrentUser: Boolean(authSession.currentUser),
      hasPendingPublication,
      isFocused,
      status
    })) {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const schedule = () => {
      timer = setTimeout(() => {
        void poll();
      }, getMobilePendingPublicationPollDelay(attempt));
    };

    const poll = async () => {
      try {
        const nextListings = await fetchMobileMyListings();

        if (!active) {
          return;
        }

        setListings(nextListings);
        attempt += 1;
      } catch {
        attempt += 1;
      }

      if (active) {
        schedule();
      }
    };

    schedule();

    return () => {
      active = false;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [appState, authSession.currentUser, hasPendingPublication, isFocused, status]);

  async function handleStatusAction(
    listingId: string,
    nextStatus: MobileListingStatus
  ) {
    if (!canSubmitMobileListingStatusAction({ listingId, nextStatus, pendingListingId })) {
      return;
    }

    try {
      setPendingListingId(listingId);
      setError(null);
      setSuccessMessage(null);

      const currentStatus = listings.find((listing) => listing.id === listingId)?.status ?? null;
      const updatedListing = await updateMobileListingStatus(listingId, nextStatus);

      setListings((currentListings) =>
        currentListings.map((listing) => (listing.id === listingId ? updatedListing : listing))
      );
      setSuccessMessage(getMobileListingStatusActionMessage(nextStatus, currentStatus));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "İlan durumu güncellenemedi.");
    } finally {
      setPendingListingId(null);
    }
  }

  if (status === "guest") {
    return (
      <Screen
        eyebrow="Satıcı paneli"
        title="İlanlarım"
        subtitle="İlanlarını yönetmek için hesabına giriş yap."
      >
        <MobileEmptyState
          actionLabel="Giriş yap"
          message="Aktif, rezerve, satıldı ve arşivdeki ilanlarını buradan yönetebilirsin."
          onAction={() => router.push("/login")}
          title="Giriş gerekli"
        />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="Satıcı paneli"
      title="İlanlarım"
      subtitle="Yayındaki ve kapanan ilanlarını mobilde yönet."
    >
      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel="Hesaba dön"
          accessibilityRole="button"
          onPress={() => router.replace("/account")}
          style={styles.backButton}
        >
          <Ionicons color={colors.primaryDark} name="chevron-back" size={18} />
          <Text style={styles.backButtonText}>Hesap</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Yeni ilan ver"
          accessibilityRole="button"
          onPress={() => router.push("/sell")}
          style={styles.primaryIconButton}
        >
          <Ionicons color={colors.primaryDark} name="add-circle-outline" size={18} />
          <Text style={styles.primaryIconButtonText}>Yeni ilan</Text>
        </Pressable>
      </View>

      {status === "loading" ? <MobileSkeleton label="İlanların yükleniyor..." /> : null}

      {status === "error" ? (
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={error}
          onAction={() => void loadListings()}
          title="İlanlar yüklenemedi"
        />
      ) : null}

      {status === "ready" ? (
        <>
          <View style={styles.summaryGrid}>
            <SummaryPill label="Toplam" value={stats.total} />
            <SummaryPill label="Yayında değil" value={stats.draft} />
            <SummaryPill label="Yayında" value={stats.active} />
            <SummaryPill label="Rezerve" value={stats.reserved} />
            <SummaryPill label="Satıldı" value={stats.sold} />
            <SummaryPill label="Arşivde" value={stats.archived} />
          </View>

          <View accessibilityLabel="İlan durumu filtreleri" style={styles.filterRow}>
            {MOBILE_MY_LISTING_STATUS_FILTERS.map((filter) => {
              const selected = selectedFilter === filter;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={filter}
                  onPress={() => setSelectedFilter(filter)}
                  style={[styles.filterChip, selected ? styles.filterChipSelected : null]}
                >
                  <Text style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}>
                    {getMobileMyListingStatusFilterLabel(filter)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {showPublicationConfirmation ? (
            <MobileCard style={styles.publicationConfirmationCard}>
              <View style={styles.publicationMessageRow}>
                <MobilePublicationWaitIndicator />
                <View style={styles.publicationMessageContent}>
                  <Text style={styles.publicationMessageTitle}>İlanın onay sürecinde</Text>
                </View>
              </View>
            </MobileCard>
          ) : null}

          {successMessage ? (
            <MobileCard style={styles.successCard}>
              <Text style={styles.successText}>{successMessage}</Text>
            </MobileCard>
          ) : null}

          {error ? (
            <MobileCard style={styles.inlineErrorCard}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </MobileCard>
          ) : null}

          {listings.length === 0 ? (
            <MobileEmptyState
              actionLabel="İlan ver"
              message="İlk ilanını oluşturduğunda burada durumunu ve aksiyonlarını göreceksin."
              onAction={() => router.push("/sell")}
              title="Henüz ilanın yok"
            />
          ) : null}

          {listings.length > 0 && visibleListings.length === 0 ? (
            <MobileEmptyState
              actionLabel="Tümünü göster"
              message="Bu durumda ilan yok. Diğer durumları görmek için tüm ilanlara dönebilirsin."
              onAction={() => setSelectedFilter("all")}
              title="Bu filtre boş"
            />
          ) : null}

          <View style={styles.list}>
            {visibleListings.map((listing) => (
              <MyListingCard
                key={listing.id}
                listing={listing}
                onEdit={() => router.push(`/edit-listing/${encodeURIComponent(listing.id)}`)}
                onOpen={() => router.push(`/listing/${encodeURIComponent(listing.id)}`)}
                onStatusAction={(nextStatus) => void handleStatusAction(listing.id, nextStatus)}
                pending={pendingListingId === listing.id}
              />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function SummaryPill({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <MobileCard style={styles.summaryPill}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </MobileCard>
  );
}

function MyListingCard({
  listing,
  onEdit,
  onOpen,
  onStatusAction,
  pending
}: {
  listing: MobileMyListingSummary;
  onEdit: () => void;
  onOpen: () => void;
  onStatusAction: (status: MobileListingStatus) => void;
  pending: boolean;
}) {
  const actions = getMobileListingStatusActions(listing.status);
  const publicationDisplay = getMobileListingPublicationDisplay(listing);
  const isPublic =
    (listing.status === "active" || listing.status === "reserved") &&
    listing.publicationState === "published";
  const ageRangeLabel = formatMobileListingAgeRange(
    listing.recommendedAgeMinMonths,
    listing.recommendedAgeMaxMonths
  );

  return (
    <View style={styles.cardShell}>
      <MobileListingCard
        accessibilityLabel={`İlanı aç: ${listing.title}`}
        chips={buildMobileListingChips({
          conditionText: listing.conditionText,
          listingTypeText: listing.listingTypeText,
          statusText: listing.statusText
        })}
        favoriteText={
          typeof listing.favoriteCount === "number"
            ? `${listing.favoriteCount} favori`
            : null
        }
        footerText={listing.createdAt
          ? `${ageRangeLabel} · Oluşturulma: ${formatDate(listing.createdAt)}`
          : ageRangeLabel}
        imageUrl={listing.imageUrl}
        locationText={listing.locationText}
        onPress={isPublic ? onOpen : undefined}
        priceText={listing.priceText}
        title={listing.title}
      />

      {publicationDisplay.title ? (
        <MobileCard
          style={
            publicationDisplay.needsAttention
              ? styles.publicationAttentionCard
              : styles.publicationPendingCard
          }
        >
          <View style={styles.publicationMessageRow}>
            {publicationDisplay.isPending ? <MobilePublicationWaitIndicator /> : null}
            <View style={styles.publicationMessageContent}>
              <Text style={styles.publicationMessageTitle}>{publicationDisplay.title}</Text>
              {publicationDisplay.message ? (
                <Text style={styles.publicationMessageText}>{publicationDisplay.message}</Text>
              ) : null}
            </View>
          </View>
        </MobileCard>
      ) : null}

      <View style={styles.cardActions}>
        {isPublic ? (
          <MobileButton iconName="open-outline" onPress={onOpen} variant="secondary">
            Detay
          </MobileButton>
        ) : null}

        <MobileButton
          iconName="create-outline"
          onPress={onEdit}
          variant="secondary"
        >
          Düzenle
        </MobileButton>

        {actions.map((action) => (
          <MobileButton
            disabled={pending}
            iconName={getActionIconName(action)}
            key={`${listing.id}-${action.status}`}
            onPress={() => onStatusAction(action.status)}
            variant={action.tone === "primary" ? undefined : action.tone}
          >
            {pending ? "Güncelleniyor..." : action.label}
          </MobileButton>
        ))}
      </View>
    </View>
  );
}

function getActionIconName(
  action: MobileListingStatusAction
): "archive-outline" | "checkmark-done-outline" | "refresh-outline" {
  if (action.status === "sold") {
    return "checkmark-done-outline";
  }

  if (action.status === "active") {
    return "refresh-outline";
  }

  return "archive-outline";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("tr-TR");
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  primaryIconButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 11
  },
  primaryIconButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryPill: {
    minWidth: 96,
    flexGrow: 1,
    gap: 3,
    padding: spacing.sm
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  filterChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  filterChipTextSelected: {
    color: colors.primaryDark
  },
  publicationConfirmationCard: {
    borderColor: "#f4c66d",
    backgroundColor: "#fff8e8"
  },
  publicationPendingCard: {
    borderColor: "#f4c66d",
    backgroundColor: "#fff8e8",
    padding: spacing.sm
  },
  publicationAttentionCard: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    padding: spacing.sm
  },
  publicationMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  publicationMessageContent: {
    minWidth: 0,
    flex: 1,
    gap: 3
  },
  publicationMessageTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  publicationMessageText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  successCard: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4"
  },
  successText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  inlineErrorCard: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2"
  },
  inlineErrorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  list: {
    gap: spacing.md
  },
  cardShell: {
    gap: spacing.sm
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
