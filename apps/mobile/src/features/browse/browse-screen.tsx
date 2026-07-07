import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "../../ui/screen";
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
import {
  fetchMobileListings,
  type FetchMobileListingsParams,
  type MobileListingConditionFilter,
  type MobileListingCreatedSinceFilter,
  type MobileListingSummary
} from "../listings/listings-api";
import { fetchMobileCategories, type MobileCategory } from "../sell/sell-api";
import { DiscoverHeroBanner } from "./discover-hero-banner";

type HomeListingFilters = {
  categoryId: string;
  city: string;
  condition: "" | MobileListingConditionFilter;
  createdSince: "" | MobileListingCreatedSinceFilter;
  listingType: "" | "sale" | "donation" | "swap";
  priceMax: string;
  priceMin: string;
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

export function BrowseScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<MobileListingSummary[]>([]);
  const [heroListings, setHeroListings] = useState<MobileListingSummary[]>([]);
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [draftFilters, setDraftFilters] = useState<HomeListingFilters>(emptyHomeListingFilters);
  const [appliedFilters, setAppliedFilters] = useState<HomeListingFilters>(emptyHomeListingFilters);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const loadListings = useCallback(async (query: string, filters: HomeListingFilters) => {
    try {
      setStatus("loading");
      setError(null);

      const nextListings = await fetchMobileListings({
        q: query,
        limit: 20,
        ...toListingQueryFilters(filters)
      });

      setListings(nextListings);
      setStatus(nextListings.length > 0 ? "ready" : "empty");
    } catch (loadError) {
      setListings([]);
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "İlanlar yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    void loadListings(appliedQuery, appliedFilters);
  }, [appliedFilters, appliedQuery, loadListings]);

  useEffect(() => {
    let active = true;

    async function loadHomeData() {
      try {
        const [latestListings, nextCategories] = await Promise.all([
          fetchMobileListings({
            limit: 10
          }),
          fetchMobileCategories()
        ]);

        if (active) {
          setHeroListings(latestListings);
          setCategories(nextCategories);
        }
      } catch {
        if (active) {
          setHeroListings([]);
          setCategories([]);
        }
      }
    }

    void loadHomeData();

    return () => {
      active = false;
    };
  }, []);

  function handleSearch() {
    setAppliedQuery(draftQuery.trim());
    setSearchOpen(false);
  }

  function handleClearSearch() {
    setDraftQuery("");
    setAppliedQuery("");
  }

  function handleApplyFilters() {
    setAppliedFilters(draftFilters);
    setFilterOpen(false);
  }

  function handleClearFilters() {
    setDraftFilters(emptyHomeListingFilters);
    setAppliedFilters(emptyHomeListingFilters);
  }

  return (
    <Screen
      title="Keşfet"
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
            style={[styles.searchIconButton, hasActiveFilters(appliedFilters) ? styles.searchIconButtonActive : null]}
          >
            <Ionicons color={colors.primaryDark} name="options-outline" size={21} />
          </Pressable>
        </View>
      }
    >
      <DiscoverHeroBanner
        listings={heroListings}
        onListingPress={(listingId) => router.push(`/listing/${encodeURIComponent(listingId)}`)}
      />

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

      <MobileSectionHeader title={appliedQuery ? `"${appliedQuery}" için sonuçlar` : "Son eklenenler"} />

      {status === "loading" ? <MobileSkeleton label="İlanlar yükleniyor..." /> : null}

      {status === "error" ? (
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={error}
          onAction={() => void loadListings(appliedQuery, appliedFilters)}
          title="İlanlar yüklenemedi"
        />
      ) : null}

      {status === "empty" ? (
        <MobileEmptyState
          message="Farklı bir arama dene ya da daha sonra tekrar bak."
          title="Eşleşen ilan yok"
        />
      ) : null}

      <View style={styles.list}>
        {listings.map((listing) => (
          <MobileListingCard
            accessibilityLabel={`İlanı aç: ${listing.title}`}
            chips={buildMobileListingChips({
              conditionText: listing.conditionText,
              listingTypeText: listing.listingTypeText,
              statusText: listing.statusText
            })}
            imageUrl={listing.imageUrl}
            key={listing.id}
            locationText={listing.locationText}
            onPress={() => router.push(`/listing/${encodeURIComponent(listing.id)}`)}
            priceText={listing.priceText}
            title={listing.title}
            variant="vertical"
          />
        ))}
      </View>
    </Screen>
  );
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
          <Text style={styles.filterLabel}>Kategori</Text>
          <View style={styles.chipGrid}>
            <FilterChip
              label="Hepsi"
              onPress={() => patchFilters({ categoryId: "" })}
              selected={!filters.categoryId}
            />
            {categories.slice(0, 8).map((category) => (
              <FilterChip
                key={category.id}
                label={category.name}
                onPress={() => patchFilters({ categoryId: category.id })}
                selected={filters.categoryId === category.id}
              />
            ))}
          </View>

          <Text style={styles.filterLabel}>İlan tipi</Text>
          <View style={styles.chipGrid}>
            {[
              ["", "Hepsi"],
              ["sale", "Satılık"],
              ["donation", "Bağış"],
              ["swap", "Takas"]
            ].map(([value, label]) => (
              <FilterChip
                key={value || "all-types"}
                label={label}
                onPress={() => patchFilters({ listingType: value as HomeListingFilters["listingType"] })}
                selected={filters.listingType === value}
              />
            ))}
          </View>

          <Text style={styles.filterLabel}>Konum</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={(city) => patchFilters({ city })}
            placeholder="Şehir"
            placeholderTextColor={colors.subtle}
            style={styles.searchInput}
            value={filters.city}
          />

          <Text style={styles.filterLabel}>Ürün eklenmesi</Text>
          <View style={styles.chipGrid}>
            {[
              ["today", "Bugün"],
              ["last_7_days", "Son 1 hafta"],
              ["", "Hepsi"]
            ].map(([value, label]) => (
              <FilterChip
                key={value || "all-dates"}
                label={label}
                onPress={() => patchFilters({ createdSince: value as HomeListingFilters["createdSince"] })}
                selected={filters.createdSince === value}
              />
            ))}
          </View>

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

          <Text style={styles.filterLabel}>Ürün durumu</Text>
          <View style={styles.chipGrid}>
            {[
              ["", "Hepsi"],
              ["new", "Yeni"],
              ["like_new", "Yeni gibi"],
              ["good", "İyi"],
              ["fair", "Kullanılmış"],
              ["needs_repair", "Tamir gerekir"]
            ].map(([value, label]) => (
              <FilterChip
                key={value || "all-conditions"}
                label={label}
                onPress={() => patchFilters({ condition: value as HomeListingFilters["condition"] })}
                selected={filters.condition === value}
              />
            ))}
          </View>
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

function FilterChip({
  label,
  onPress,
  selected
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, selected ? styles.filterChipSelected : null]}>
      <Text style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}>{label}</Text>
    </Pressable>
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
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  filterChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  filterChipTextSelected: {
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
  list: {
    gap: spacing.md
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
  return Object.values(filters).some((value) => value.trim().length > 0);
}
