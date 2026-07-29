import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem
} from "react-native";

import { MobileVirtualizedScreen } from "../../ui/mobile-virtualized-screen";
import {
  MobileButton,
  MobileEmptyState,
  MobileErrorState,
  MobileSectionHeader,
  MobileSkeleton
} from "../../ui/mobile-primitives";
import {
  buildMobileListingChips,
  MobileListingCard
} from "../../ui/mobile-listing-card";
import { colors, radius, spacing } from "../../ui/theme";
import { useMobileReducedMotion } from "../../lib/use-mobile-reduced-motion";
import {
  fetchMobileListingsPage,
  type FetchMobileListingsParams,
  type MobileListingConditionFilter,
  type MobileListingCreatedSinceFilter,
  type MobileListingSummary
} from "../listings/listings-api";
import { formatMobileListingAgeRange } from "../listings/listing-age-range-model";
import { fetchMobileCategories, type MobileCategory } from "../sell/sell-api";
import { DiscoverHeroBanner } from "./discover-hero-banner";
import { getDiscoverHeroListings } from "./discover-performance-model";

type HomeListingFilters = {
  categoryId: string;
  city: string;
  condition: "" | MobileListingConditionFilter;
  createdSince: "" | MobileListingCreatedSinceFilter;
  listingType: "" | "sale" | "donation" | "swap";
  priceMax: string;
  priceMin: string;
};

type DropdownOption<TValue extends string> = {
  label: string;
  value: TValue;
};

const emptyHomeListingFilters: HomeListingFilters = {
  categoryId: "",
  city: "",
  condition: "",
  createdSince: "",
  listingType: "",
  priceMax: "",
  priceMin: ""
};

const DISCOVER_PAGE_SIZE = 20;

type BrowseLoadMode = "append" | "refresh" | "replace";

const emptyPagination = {
  hasNextPage: false,
  limit: DISCOVER_PAGE_SIZE,
  offset: 0,
  total: 0,
  nextOffset: null as number | null
};


export function BrowseScreen() {
  const router = useRouter();
  const prefersReducedMotion = useMobileReducedMotion();
  const listingRequestIdRef = useRef(0);
  const listingAbortControllerRef = useRef<AbortController | null>(null);
  const listingsRef = useRef<MobileListingSummary[]>([]);
  const nextOffsetRef = useRef<number | null>(0);
  const loadMoreInFlightRef = useRef(false);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [listings, setListings] = useState<MobileListingSummary[]>([]);
  const [heroListings, setHeroListings] = useState<MobileListingSummary[]>([]);
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [draftFilters, setDraftFilters] = useState<HomeListingFilters>(emptyHomeListingFilters);
  const [appliedFilters, setAppliedFilters] = useState<HomeListingFilters>(emptyHomeListingFilters);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = getActiveFilterCount(appliedFilters);
  const hasSearchOrFilters = appliedQuery.length > 0 || activeFilterCount > 0;

  const loadListings = useCallback(async (
    query: string,
    filters: HomeListingFilters,
    offset = 0,
    mode: BrowseLoadMode = "replace"
  ) => {
    if (mode === "append" && loadMoreInFlightRef.current) {
      return;
    }

    if (mode !== "append") {
      listingAbortControllerRef.current?.abort();
      loadMoreInFlightRef.current = false;
      setIsLoadingMore(false);
    }

    if (mode === "append") {
      loadMoreInFlightRef.current = true;
    }

    const controller = new AbortController();
    listingAbortControllerRef.current = controller;
    const requestId = ++listingRequestIdRef.current;

    if (mode === "replace") {
      setStatus("loading");
    } else if (mode === "append") {
      setIsLoadingMore(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      const page = await fetchMobileListingsPage({
        q: query,
        limit: DISCOVER_PAGE_SIZE,
        offset,
        includeTotal: mode !== "append",
        ...toListingQueryFilters(filters)
      }, {
        signal: controller.signal
      });

      if (controller.signal.aborted || requestId !== listingRequestIdRef.current) {
        return;
      }

      const nextListings = mode === "append"
        ? mergeUniqueListings(listingsRef.current, page.listings)
        : page.listings;

      listingsRef.current = nextListings;
      nextOffsetRef.current = page.pagination.nextOffset;
      setListings(nextListings);
      setPagination((currentPagination) => ({
        ...page.pagination,
        total: page.pagination.total ?? currentPagination.total
      }));

      if (mode !== "append") {
        setHeroListings(getDiscoverHeroListings({
          activeFilterCount: getActiveFilterCount(filters),
          listings: page.listings,
          query
        }));
      }

      setStatus(nextListings.length > 0 ? "ready" : "empty");
    } catch (loadError) {
      if (
        controller.signal.aborted ||
        requestId !== listingRequestIdRef.current ||
        (loadError instanceof Error && loadError.name === "AbortError")
      ) {
        return;
      }

      if (mode === "replace") {
        listingsRef.current = [];
        setListings([]);
        nextOffsetRef.current = 0;
        setPagination(emptyPagination);
        setStatus("error");
      }

      setError(loadError instanceof Error ? loadError.message : "İlanlar yüklenemedi.");
    } finally {
      if (mode === "append") {
        loadMoreInFlightRef.current = false;
      }

      if (listingAbortControllerRef.current === controller) {
        listingAbortControllerRef.current = null;
      }

      if (requestId === listingRequestIdRef.current) {
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadListings(appliedQuery, appliedFilters, 0, "replace");
  }, [appliedFilters, appliedQuery, loadListings]);

  useEffect(() => () => listingAbortControllerRef.current?.abort(), []);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const nextCategories = await fetchMobileCategories();

        if (active) {
          setCategories(nextCategories);
        }
      } catch {
        if (active) {
          setCategories([]);
        }
      }
    }

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);

      return () => setIsScreenFocused(false);
    }, [])
  );

  function handleSearch() {
    setAppliedQuery(draftQuery.trim());
    setSearchOpen(false);
  }

  function handleClearSearch() {
    setDraftQuery("");
    setAppliedQuery("");
    setSearchOpen(false);
  }

  function handleApplyFilters() {
    setAppliedFilters(draftFilters);
    setFilterOpen(false);
  }

  function handleClearFilters() {
    setDraftFilters(emptyHomeListingFilters);
    setAppliedFilters(emptyHomeListingFilters);
    setFilterOpen(false);
  }

  function handleClearDiscovery() {
    setDraftQuery("");
    setAppliedQuery("");
    setDraftFilters(emptyHomeListingFilters);
    setAppliedFilters(emptyHomeListingFilters);
    setSearchOpen(false);
    setFilterOpen(false);
  }

  function handleLoadMore() {
    const nextOffset = nextOffsetRef.current;

    if (
      status !== "ready" ||
      isLoadingMore ||
      loadMoreInFlightRef.current ||
      !pagination.hasNextPage ||
      nextOffset === null
    ) {
      return;
    }

    void loadListings(appliedQuery, appliedFilters, nextOffset, "append");
  }

  const handleOpenListing = useCallback((listingId: string) => {
    router.push(`/listing/${encodeURIComponent(listingId)}`);
  }, [router]);
  const keyExtractor = useCallback((listing: MobileListingSummary) => listing.id, []);
  const renderListing = useCallback<ListRenderItem<MobileListingSummary>>(
    ({ item }) => <BrowseListingRow listing={item} onOpenListing={handleOpenListing} />,
    [handleOpenListing]
  );

  const listHeader = (
    <>
      {!hasSearchOrFilters ? (
        <DiscoverHeroBanner
          autoAdvanceEnabled={isScreenFocused && !prefersReducedMotion}
          listings={heroListings}
          onListingPress={(listingId) => router.push(`/listing/${encodeURIComponent(listingId)}`)}
        />
      ) : null}

      <MobileSectionHeader
        description={getBrowseSectionDescription(appliedQuery, activeFilterCount)}
        title={appliedQuery ? `"${appliedQuery}" için sonuçlar` : "Son eklenenler"}
      />

      {hasSearchOrFilters ? (
        <View style={styles.activeDiscoveryBar}>
          <Text style={styles.activeDiscoveryText}>
            {appliedQuery ? `Arama: ${appliedQuery}` : "Tüm aramalar"}
            {activeFilterCount > 0 ? ` · ${activeFilterCount} filtre aktif` : ""}
          </Text>
          <Pressable
            accessibilityLabel="Arama ve filtreleri temizle"
            onPress={handleClearDiscovery}
            style={styles.activeDiscoveryClearButton}
          >
            <Text style={styles.activeDiscoveryClearText}>Temizle</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );

  const listEmpty = status === "loading" ? (
    <MobileSkeleton label="İlanlar yükleniyor..." />
  ) : status === "error" ? (
    <MobileErrorState
      actionLabel="Tekrar dene"
      message={error}
      onAction={() => void loadListings(appliedQuery, appliedFilters, 0, "replace")}
      title="İlanlar yüklenemedi"
    />
  ) : status === "empty" ? (
    <MobileEmptyState
      actionLabel={hasSearchOrFilters ? "Arama ve filtreleri temizle" : "Tekrar dene"}
      message={
        hasSearchOrFilters
          ? "Arama veya filtreler çok dar olabilir. Hepsini temizleyip son ilanlara dönebilirsin."
          : "Şu an gösterilecek ilan yok. Biraz sonra tekrar dene."
      }
      onAction={hasSearchOrFilters
        ? handleClearDiscovery
        : () => void loadListings(appliedQuery, appliedFilters, 0, "replace")}
      title="Eşleşen ilan yok"
    />
  ) : null;

  const listFooter = listings.length > 0 ? (
    <View style={styles.listFooter}>
      {isLoadingMore ? <MobileSkeleton label="Daha fazla ilan yükleniyor..." /> : null}
      {pagination.hasNextPage && !isLoadingMore ? (
        <MobileButton onPress={handleLoadMore} variant="secondary">
          Daha fazla ilan göster
        </MobileButton>
      ) : null}
      {!pagination.hasNextPage ? (
        <Text style={styles.paginationEndText}>
          {pagination.total > 0 ? `${pagination.total} ilanın tamamı gösterildi.` : "Tüm ilanlar gösterildi."}
        </Text>
      ) : null}
      {error && status === "ready" ? <Text style={styles.paginationErrorText}>{error}</Text> : null}
    </View>
  ) : null;

  return (
    <MobileVirtualizedScreen
      data={listings}
      headerAction={
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Başlığa göre ilan ara"
            onPress={() => setSearchOpen(true)}
            style={styles.searchIconButton}
          >
            <Ionicons color={colors.primaryDark} name="search" size={21} />
          </Pressable>
          <Pressable
            accessibilityLabel="İlan filtrelerini aç"
            onPress={() => setFilterOpen(true)}
            style={[styles.searchIconButton, activeFilterCount > 0 ? styles.searchIconButtonActive : null]}
          >
            <Ionicons color={colors.primaryDark} name="options-outline" size={21} />
          </Pressable>
        </View>
      }
      initialNumToRender={4}
      keyboardAvoiding={false}
      keyExtractor={keyExtractor}
      listEmpty={listEmpty}
      listFooter={listFooter}
      listHeader={listHeader}
      maxToRenderPerBatch={4}
      onEndReached={handleLoadMore}
      onRefresh={() => void loadListings(appliedQuery, appliedFilters, 0, "refresh")}
      overlay={
        <>
          <SearchSheet
            appliedQuery={appliedQuery}
            draftQuery={draftQuery}
            onChangeQuery={setDraftQuery}
            onClear={handleClearSearch}
            onClose={() => setSearchOpen(false)}
            onSearch={handleSearch}
            visible={searchOpen}
          />
          <FilterSheet
            categories={categories}
            filters={draftFilters}
            onApply={handleApplyFilters}
            onChangeFilters={setDraftFilters}
            onClear={handleClearFilters}
            onClose={() => setFilterOpen(false)}
            visible={filterOpen}
          />
        </>
      }
      refreshing={isRefreshing}
      renderItem={renderListing}
      title="Keşfet"
      updateCellsBatchingPeriod={50}
      windowSize={5}
    />
  );
}


const BrowseListingRow = memo(function BrowseListingRow({
  listing,
  onOpenListing
}: {
  listing: MobileListingSummary;
  onOpenListing: (listingId: string) => void;
}) {
  const handlePress = useCallback(() => {
    onOpenListing(listing.id);
  }, [listing.id, onOpenListing]);

  return (
    <MobileListingCard
      accessibilityLabel={`İlanı aç: ${listing.title}`}
      chips={buildMobileListingChips({
        isDemo: listing.isDemo,
        conditionText: listing.conditionText,
        listingTypeText: listing.listingTypeText,
        statusText: listing.statusText
      })}
      footerText={formatMobileListingAgeRange(
        listing.recommendedAgeMinMonths,
        listing.recommendedAgeMaxMonths
      )}
      imageUrl={listing.imageUrl}
      locationText={listing.locationText}
      onPress={handlePress}
      priceText={listing.priceText}
      title={listing.title}
      variant="vertical"
    />
  );
});

function mergeUniqueListings(
  current: MobileListingSummary[],
  incoming: MobileListingSummary[]
): MobileListingSummary[] {
  const byId = new Map(current.map((listing) => [listing.id, listing]));

  for (const listing of incoming) {
    byId.set(listing.id, listing);
  }

  return [...byId.values()];
}

function FilterSheet({
  categories,
  filters,
  onApply,
  onChangeFilters,
  onClear,
  onClose,
  visible
}: {
  categories: MobileCategory[];
  filters: HomeListingFilters;
  onApply: () => void;
  onChangeFilters: (filters: HomeListingFilters) => void;
  onClear: () => void;
  onClose: () => void;
  visible: boolean;
}) {
  const [openDropdown, setOpenDropdown] = useState<
    "category" | "listingType" | "createdSince" | "condition" | null
  >(null);

  const categoryOptions: DropdownOption<HomeListingFilters["categoryId"]>[] = [
    { label: "Hepsi", value: "" },
    ...categories.map((category) => ({
      label: category.name,
      value: category.id
    }))
  ];

  const listingTypeOptions: DropdownOption<HomeListingFilters["listingType"]>[] = [
    { label: "Hepsi", value: "" },
    { label: "Satılık", value: "sale" },
    { label: "Bağış", value: "donation" },
    { label: "Takas", value: "swap" }
  ];

  const createdSinceOptions: DropdownOption<HomeListingFilters["createdSince"]>[] = [
    { label: "Hepsi", value: "" },
    { label: "Bugün", value: "today" },
    { label: "Son 1 hafta", value: "last_7_days" }
  ];

  const conditionOptions: DropdownOption<HomeListingFilters["condition"]>[] = [
    { label: "Hepsi", value: "" },
    { label: "Yeni", value: "new" },
    { label: "Yeni gibi", value: "like_new" },
    { label: "İyi", value: "good" },
    { label: "Kullanılmış", value: "fair" },
    { label: "Tamir gerekir", value: "needs_repair" }
  ];

  function patchFilters(patch: Partial<HomeListingFilters>) {
    onChangeFilters({
      ...filters,
      ...patch
    });
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityLabel="Filtre penceresini kapat" onPress={onClose} style={styles.modalBackdrop} />
      <View style={styles.filterSheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.searchTitle}>Filtre</Text>
          <Pressable accessibilityLabel="Filtreyi kapat" onPress={onClose} style={styles.sheetCloseButton}>
            <Ionicons color={colors.muted} name="close" size={20} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.filterContent} showsVerticalScrollIndicator={false}>
          <DropdownSelect
            label="Kategori"
            onChange={(categoryId) => patchFilters({ categoryId })}
            onToggle={() => setOpenDropdown(openDropdown === "category" ? null : "category")}
            open={openDropdown === "category"}
            options={categoryOptions}
            value={filters.categoryId}
          />

          <DropdownSelect
            label="İlan tipi"
            onChange={(listingType) => patchFilters({ listingType })}
            onToggle={() => setOpenDropdown(openDropdown === "listingType" ? null : "listingType")}
            open={openDropdown === "listingType"}
            options={listingTypeOptions}
            value={filters.listingType}
          />

          <Text style={styles.filterLabel}>Konum</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={(city) => patchFilters({ city })}
            placeholder="Şehir"
            placeholderTextColor={colors.subtle}
            style={styles.searchInput}
            value={filters.city}
          />

          <DropdownSelect
            label="Ürün eklenmesi"
            onChange={(createdSince) => patchFilters({ createdSince })}
            onToggle={() => setOpenDropdown(openDropdown === "createdSince" ? null : "createdSince")}
            open={openDropdown === "createdSince"}
            options={createdSinceOptions}
            value={filters.createdSince}
          />

          <Text style={styles.filterLabel}>Fiyat aralığı</Text>
          <View style={styles.priceRow}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(priceMin) => patchFilters({ priceMin })}
              placeholder="Min"
              placeholderTextColor={colors.subtle}
              style={[styles.searchInput, styles.priceInput]}
              value={filters.priceMin}
            />
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(priceMax) => patchFilters({ priceMax })}
              placeholder="Max"
              placeholderTextColor={colors.subtle}
              style={[styles.searchInput, styles.priceInput]}
              value={filters.priceMax}
            />
          </View>

          <DropdownSelect
            label="Ürün durumu"
            onChange={(condition) => patchFilters({ condition })}
            onToggle={() => setOpenDropdown(openDropdown === "condition" ? null : "condition")}
            open={openDropdown === "condition"}
            options={conditionOptions}
            value={filters.condition}
          />
        </ScrollView>

        <View style={styles.searchActions}>
          <MobileButton onPress={onApply} style={styles.searchButton}>
            Uygula
          </MobileButton>
          <MobileButton onPress={onClear} style={styles.searchButton} variant="secondary">
            Temizle
          </MobileButton>
        </View>
      </View>
    </Modal>
  );
}

function DropdownSelect<TValue extends string>({
  label,
  onChange,
  onToggle,
  open,
  options,
  value
}: {
  label: string;
  onChange: (value: TValue) => void;
  onToggle: () => void;
  open: boolean;
  options: DropdownOption<TValue>[];
  value: TValue;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <View style={styles.dropdownBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label} seç`}
        onPress={onToggle}
        style={styles.dropdownButton}
      >
        <Text numberOfLines={1} style={styles.dropdownButtonText}>
          {selectedOption?.label ?? "Hepsi"}
        </Text>
        <Ionicons color={colors.muted} name={open ? "chevron-up" : "chevron-down"} size={18} />
      </Pressable>

      {open ? (
        <View style={styles.dropdownMenu}>
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <Pressable
                accessibilityRole="button"
                key={`${label}-${option.value || "all"}`}
                onPress={() => {
                  onChange(option.value);
                  onToggle();
                }}
                style={[styles.dropdownOption, selected ? styles.dropdownOptionSelected : null]}
              >
                <Text style={[styles.dropdownOptionText, selected ? styles.dropdownOptionTextSelected : null]}>
                  {option.label}
                </Text>
                {selected ? <Ionicons color={colors.primaryDark} name="checkmark" size={17} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}


function SearchSheet({
  appliedQuery,
  draftQuery,
  onChangeQuery,
  onClear,
  onClose,
  onSearch,
  visible
}: {
  appliedQuery: string;
  draftQuery: string;
  onChangeQuery: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
  onSearch: () => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityLabel="Arama penceresini kapat" onPress={onClose} style={styles.modalBackdrop} />
      <View style={styles.searchSheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.searchTitle}>Başlığı Ara</Text>
          <Pressable accessibilityLabel="Aramayı kapat" onPress={onClose} style={styles.sheetCloseButton}>
            <Ionicons color={colors.muted} name="close" size={20} />
          </Pressable>
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onChangeText={onChangeQuery}
          onSubmitEditing={onSearch}
          placeholder="Bebek arabası, oto koltuğu, oyuncak..."
          placeholderTextColor={colors.subtle}
          returnKeyType="search"
          style={styles.searchInput}
          value={draftQuery}
        />

        <View style={styles.searchActions}>
          <MobileButton onPress={onSearch} style={styles.searchButton}>
            Ara
          </MobileButton>

          <MobileButton
            disabled={!draftQuery && !appliedQuery}
            onPress={onClear}
            style={styles.searchButton}
            variant="secondary"
          >
            Temizle
          </MobileButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  searchIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface
  },
  searchIconButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.34)"
  },
  activeDiscoveryBar: {
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  activeDiscoveryText: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  activeDiscoveryClearButton: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7
  },
  activeDiscoveryClearText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  searchSheet: {
    position: "absolute",
    right: 14,
    bottom: 18,
    left: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: spacing.sm
  },
  filterSheet: {
    position: "absolute",
    right: 14,
    bottom: 18,
    left: 14,
    maxHeight: "86%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: spacing.sm
  },
  filterContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  sheetCloseButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft
  },
  searchTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  dropdownBlock: {
    gap: 7
  },
  dropdownButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  dropdownButtonText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  dropdownMenu: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface
  },
  dropdownOption: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  dropdownOptionSelected: {
    backgroundColor: colors.surfaceSoft
  },
  dropdownOptionText: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  dropdownOptionTextSelected: {
    color: colors.primaryDark,
    fontWeight: "900"
  },
  priceRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  priceInput: {
    flex: 1
  },
  searchActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  searchButton: {
    flex: 1
  },
  listFooter: {
    gap: spacing.md,
    paddingTop: spacing.lg
  },
  paginationEndText: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  paginationErrorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  }
});

function toListingQueryFilters(filters: HomeListingFilters): FetchMobileListingsParams {
  return {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.city.trim() ? { city: filters.city } : {}),
    ...(filters.condition ? { condition: filters.condition } : {}),
    ...(filters.createdSince ? { createdSince: filters.createdSince } : {}),
    ...(filters.listingType ? { listingType: filters.listingType } : {}),
    ...(filters.priceMax.trim() ? { priceMax: filters.priceMax } : {}),
    ...(filters.priceMin.trim() ? { priceMin: filters.priceMin } : {})
  };
}

function hasActiveFilters(filters: HomeListingFilters): boolean {
  return getActiveFilterCount(filters) > 0;
}

function getActiveFilterCount(filters: HomeListingFilters): number {
  return Object.values(filters).filter((value) => value.trim().length > 0).length;
}

function getBrowseSectionDescription(query: string, activeFilterCount: number): string {
  if (query && activeFilterCount > 0) {
    return "Arama ve filtrelere göre listeleniyor.";
  }

  if (query) {
    return "Başlığa göre arama sonuçları.";
  }

  if (activeFilterCount > 0) {
    return "Seçtiğin filtrelere göre listeleniyor.";
  }

  return "En yeni aktif ve rezerve ilanlar.";
}
