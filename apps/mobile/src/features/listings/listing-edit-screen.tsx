import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { MobileButton, MobileCard, MobileChip, MobileEmptyState, MobileErrorState, MobileSectionHeader, MobileSkeleton } from "../../ui/mobile-primitives";
import { Screen } from "../../ui/screen";
import { colors, radius, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  buildMobileListingImageUploadFile,
  MOBILE_LISTING_IMAGE_LIMIT,
  validateMobileListingImageSelectionCount
} from "../sell/image-upload-model";
import {
  fetchMobileCategories,
  type MobileCategory
} from "../sell/sell-api";
import {
  mobileListingConditionOptions,
  mobileListingTypeOptions
} from "../sell/sell-form-model";
import {
  deleteMobileListingImage,
  fetchMobileEditableListingDetail,
  reorderMobileListingImages,
  updateMobileListing,
  uploadMobileListingEditImage,
  type MobileEditableListingDetail,
  type MobileEditableListingImage
} from "./listings-api";
import {
  buildMobileListingEditPayload,
  createMobileListingEditFormState,
  getMobileListingEditImageLimitMessage,
  moveMobileListingImageId,
  type MobileListingEditFormState
} from "./listing-edit-model";
import { MobileListingAgeRangeField } from "./listing-age-range-field";

type LoadStatus = "loading" | "ready" | "guest" | "error";
type SubmitStatus = "idle" | "saving" | "uploading" | "deleting" | "reordering";

export function ListingEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ listingId?: string }>();
  const authSession = useAuthSession();
  const listingId = typeof params.listingId === "string" ? params.listingId : "";
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [listing, setListing] = useState<MobileEditableListingDetail | null>(null);
  const [formState, setFormState] = useState<MobileListingEditFormState | null>(null);
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const isBusy = submitStatus !== "idle";
  const imageLimitMessage = useMemo(
    () => getMobileListingEditImageLimitMessage({
      currentCount: listing?.editableImages.length ?? 0,
      maxCount: MOBILE_LISTING_IMAGE_LIMIT
    }),
    [listing?.editableImages.length]
  );

  const load = useCallback(async () => {
    if (authSession.status === "checking") {
      setLoadStatus("loading");
      return;
    }

    if (!authSession.currentUser) {
      setLoadStatus("guest");
      return;
    }

    if (!listingId) {
      setLoadStatus("error");
      setMessage("İlan bilgisi bulunamadı.");
      return;
    }

    try {
      setLoadStatus("loading");
      setMessage(null);

      const [nextListing, nextCategories] = await Promise.all([
        fetchMobileEditableListingDetail(listingId),
        fetchMobileCategories()
      ]);

      setListing(nextListing);
      setFormState(createMobileListingEditFormState(nextListing));
      setCategories(nextCategories);
      setLoadStatus("ready");
    } catch (error) {
      setLoadStatus("error");
      setMessage(error instanceof Error ? error.message : "İlan düzenleme bilgileri yüklenemedi.");
    }
  }, [authSession.currentUser, authSession.status, listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!formState || !listing || isBusy) {
      return;
    }

    const validation = buildMobileListingEditPayload(formState);

    if (!validation.ok) {
      setMessage(validation.message);
      return;
    }

    try {
      setSubmitStatus("saving");
      setMessage(null);

      await updateMobileListing(listing.id, validation.payload);

      const refreshed = await fetchMobileEditableListingDetail(listing.id);
      setListing(refreshed);
      setFormState(createMobileListingEditFormState(refreshed));
      setMessage("İlan bilgileri güncellendi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İlan güncellenemedi.");
    } finally {
      setSubmitStatus("idle");
    }
  }

  async function handlePickImages() {
    if (!listing || isBusy) {
      return;
    }

    if (imageLimitMessage) {
      setMessage(imageLimitMessage);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setMessage("Fotoğraf seçmek için galeri izni gerekiyor.");
      return;
    }

    const remainingSlots = MOBILE_LISTING_IMAGE_LIMIT - listing.editableImages.length;
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 0.86,
      selectionLimit: Math.max(1, remainingSlots)
    });

    if (pickerResult.canceled) {
      return;
    }

    const countValidation = validateMobileListingImageSelectionCount(
      listing.editableImages.length,
      pickerResult.assets.length
    );

    if (!countValidation.ok) {
      setMessage(countValidation.message);
      return;
    }

    try {
      setSubmitStatus("uploading");
      setMessage(null);

      for (const asset of pickerResult.assets) {
        const uploadFile = buildMobileListingImageUploadFile({
          fileName: asset.fileName ?? undefined,
          mimeType: asset.mimeType ?? undefined,
          uri: asset.uri
        });

        if (!uploadFile.ok) {
          setMessage(uploadFile.message);
          continue;
        }

        await uploadMobileListingEditImage(listing.id, uploadFile.file);
      }

      const refreshed = await fetchMobileEditableListingDetail(listing.id);
      setListing(refreshed);
      setFormState(createMobileListingEditFormState(refreshed));
      setMessage("Görseller güncellendi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Görsel yüklenemedi.");
    } finally {
      setSubmitStatus("idle");
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!listing || isBusy) {
      return;
    }

    try {
      setSubmitStatus("deleting");
      setMessage(null);

      await deleteMobileListingImage(listing.id, imageId);

      setListing({
        ...listing,
        editableImages: listing.editableImages.filter((image) => image.id !== imageId)
      });
      setMessage("Görsel silindi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Görsel silinemedi.");
    } finally {
      setSubmitStatus("idle");
    }
  }

  async function handleMoveImage(imageId: string, direction: "down" | "up") {
    if (!listing || isBusy) {
      return;
    }

    const nextImageIds = moveMobileListingImageId({
      direction,
      imageId,
      imageIds: listing.editableImages.map((image) => image.id)
    });

    if (nextImageIds.join("|") === listing.editableImages.map((image) => image.id).join("|")) {
      return;
    }

    try {
      setSubmitStatus("reordering");
      setMessage(null);

      const images = await reorderMobileListingImages(listing.id, nextImageIds);

      setListing({
        ...listing,
        editableImages: images
      });
      setMessage("Görsel sırası güncellendi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Görsel sırası güncellenemedi.");
    } finally {
      setSubmitStatus("idle");
    }
  }

  if (loadStatus === "guest") {
    return (
      <Screen eyebrow="Satıcı paneli" title="İlanı düzenle">
        <MobileEmptyState
          actionLabel="Giriş yap"
          message="İlan düzenlemek için hesabına giriş yapmalısın."
          onAction={() => router.push("/login")}
          title="Giriş gerekli"
        />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="Satıcı paneli"
      title="İlanı düzenle"
      subtitle="İlan bilgilerini ve fotoğrafları mobilde güncelle."
    >
      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel="İlanlarıma dön"
          accessibilityRole="button"
          onPress={() => router.replace("/my-listings")}
          style={styles.backButton}
        >
          <Ionicons color={colors.primaryDark} name="chevron-back" size={18} />
          <Text style={styles.backButtonText}>İlanlarım</Text>
        </Pressable>

        {listing ? (
          <Pressable
            accessibilityLabel="İlan detayını aç"
            accessibilityRole="button"
            onPress={() => router.push(`/listing/${encodeURIComponent(listing.id)}`)}
            style={styles.backButton}
          >
            <Ionicons color={colors.primaryDark} name="open-outline" size={18} />
            <Text style={styles.backButtonText}>Detay</Text>
          </Pressable>
        ) : null}
      </View>

      {loadStatus === "loading" ? <MobileSkeleton label="İlan bilgileri yükleniyor..." /> : null}

      {loadStatus === "error" ? (
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={message}
          onAction={() => void load()}
          title="İlan yüklenemedi"
        />
      ) : null}

      {loadStatus === "ready" && listing && formState ? (
        <>
          <MobileCard style={styles.formCard}>
            <MobileSectionHeader
              description="Başlık, açıklama, kategori ve fiyat bilgilerini güncelle."
              title="İlan bilgileri"
            />

            <Field label="Başlık">
              <TextInput
                onChangeText={(title) => setFormState((state) => state ? { ...state, title } : state)}
                placeholder="İlan başlığı"
                style={styles.input}
                value={formState.title}
              />
            </Field>

            <Field label="Açıklama">
              <TextInput
                multiline
                onChangeText={(description) => setFormState((state) => state ? { ...state, description } : state)}
                placeholder="Ürün detayları"
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={formState.description}
              />
            </Field>

            <Field label="Fiyat">
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(priceAmount) => setFormState((state) => state ? { ...state, priceAmount } : state)}
                placeholder="1000 veya 1000.50"
                style={styles.input}
                value={formState.priceAmount}
              />
            </Field>

            <Field label="Kategori">
              <View style={styles.optionGrid}>
                {categories.map((category) => (
                  <OptionChip
                    key={category.id}
                    label={category.name}
                    onPress={() => setFormState((state) => state ? { ...state, categoryId: category.id } : state)}
                    selected={formState.categoryId === category.id}
                  />
                ))}
              </View>
            </Field>

            <Field label="İlan tipi">
              <View style={styles.optionGrid}>
                {mobileListingTypeOptions.map((option) => (
                  <OptionChip
                    key={option.value}
                    label={option.label}
                    onPress={() => setFormState((state) => state ? { ...state, listingType: option.value } : state)}
                    selected={formState.listingType === option.value}
                  />
                ))}
              </View>
            </Field>

            <Field label="Kondisyon">
              <View style={styles.optionGrid}>
                {mobileListingConditionOptions.map((option) => (
                  <OptionChip
                    key={option.value}
                    label={option.label}
                    onPress={() => setFormState((state) => state ? { ...state, condition: option.value } : state)}
                    selected={formState.condition === option.value}
                  />
                ))}
              </View>
            </Field>

            <MobileListingAgeRangeField
              disabled={isBusy}
              onChange={(recommendedAgeRange) =>
                setFormState((state) => state ? { ...state, recommendedAgeRange } : state)
              }
              value={formState.recommendedAgeRange}
            />

            <MobileButton
              disabled={isBusy}
              iconName="save-outline"
              onPress={() => void handleSave()}
            >
              {submitStatus === "saving" ? "Kaydediliyor..." : "Bilgileri kaydet"}
            </MobileButton>
          </MobileCard>

          <MobileCard style={styles.formCard}>
            <MobileSectionHeader
              description="En fazla 5 fotoğraf. İncelemede olan fotoğraflar public ilanda görünmeyebilir."
              title="Fotoğraflar"
            />

            <View style={styles.imageCounterRow}>
              <Text style={styles.imageCounterText}>
                {listing.editableImages.length}/{MOBILE_LISTING_IMAGE_LIMIT} fotoğraf
              </Text>
              <MobileButton
                disabled={isBusy || Boolean(imageLimitMessage)}
                iconName="images-outline"
                onPress={() => void handlePickImages()}
                variant="secondary"
              >
                {submitStatus === "uploading" ? "Yükleniyor..." : "Fotoğraf ekle"}
              </MobileButton>
            </View>

            {imageLimitMessage ? <Text style={styles.helperText}>{imageLimitMessage}</Text> : null}

            {listing.editableImages.length === 0 ? (
              <MobileEmptyState
                actionLabel="Fotoğraf ekle"
                message="Fotoğraflar ilanın güvenilirliğini artırır."
                onAction={() => void handlePickImages()}
                title="Henüz fotoğraf yok"
              />
            ) : null}

            <View style={styles.imageList}>
              {listing.editableImages.map((image, index) => (
                <EditableImageCard
                  disabled={isBusy}
                  image={image}
                  index={index}
                  key={image.id}
                  onDelete={() => void handleDeleteImage(image.id)}
                  onMoveDown={() => void handleMoveImage(image.id, "down")}
                  onMoveUp={() => void handleMoveImage(image.id, "up")}
                  total={listing.editableImages.length}
                />
              ))}
            </View>
          </MobileCard>

          {message ? (
            <MobileCard style={styles.messageCard}>
              <Text style={styles.messageText}>{message}</Text>
            </MobileCard>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Field({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function OptionChip({
  label,
  onPress,
  selected
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.optionChip, selected ? styles.optionChipSelected : null]}
    >
      <Text style={[styles.optionChipText, selected ? styles.optionChipTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function EditableImageCard({
  disabled,
  image,
  index,
  onDelete,
  onMoveDown,
  onMoveUp,
  total
}: {
  disabled: boolean;
  image: MobileEditableListingImage;
  index: number;
  onDelete: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  total: number;
}) {
  return (
    <View style={styles.imageCard}>
      <Image source={{ uri: image.url }} style={styles.previewImage} />
      <View style={styles.imageMeta}>
        <Text style={styles.imageTitle}>Fotoğraf {index + 1}</Text>
        <MobileChip tone={image.reviewStatus === "approved" ? "success" : "warning"}>
          {image.reviewStatusText}
        </MobileChip>
      </View>
      <View style={styles.imageActions}>
        <MobileButton
          disabled={disabled || index === 0}
          iconName="arrow-up-outline"
          onPress={onMoveUp}
          variant="secondary"
        >
          Yukarı
        </MobileButton>
        <MobileButton
          disabled={disabled || index === total - 1}
          iconName="arrow-down-outline"
          onPress={onMoveDown}
          variant="secondary"
        >
          Aşağı
        </MobileButton>
        <MobileButton
          disabled={disabled}
          iconName="trash-outline"
          onPress={onDelete}
          variant="danger"
        >
          Sil
        </MobileButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  formCard: {
    gap: spacing.md
  },
  field: {
    gap: spacing.xs
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "700"
  },
  textArea: {
    minHeight: 118
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  optionChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft
  },
  optionChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  optionChipTextSelected: {
    color: colors.primaryDark
  },
  imageCounterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  imageCounterText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  helperText: {
    color: colors.subtle,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  imageList: {
    gap: spacing.md
  },
  imageCard: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm
  },
  previewImage: {
    width: "100%",
    height: 190,
    borderRadius: radius.md,
    backgroundColor: colors.cream
  },
  imageMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  imageTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  imageActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  messageCard: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft
  },
  messageText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  }
});
