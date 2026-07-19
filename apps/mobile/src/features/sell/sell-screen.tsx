import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import { MobileListingAgeRangeField } from "../listings/listing-age-range-field";
import {
  createMobileListing,
  fetchMobileCategories,
  uploadMobileListingImage,
  type MobileCategory
} from "./sell-api";
import {
  fetchMobileAiListingDraftSuggestion
} from "./ai-listing-draft-api";
import {
  applyMobileAiListingDraftToEmptyFields,
  formatMobileAiListingDraftPriceRange,
  getMobileAiListingDraftCategoryLabel,
  getMobileAiListingDraftConfidenceLabel,
  type MobileAiListingDraftStatus,
  type MobileAiListingDraftSuggestion
} from "./ai-listing-draft-model";
import {
  MOBILE_LISTING_IMAGE_LIMIT,
  buildMobileListingImageUploadFile,
  getRemainingMobileListingImageSlots,
  validateMobileListingImageSelectionCount,
  type MobilePickedImageInput
} from "./image-upload-model";
import {
  buildMobileCreateListingPayload,
  createDefaultMobileSellFormState,
  mobileListingConditionOptions,
  mobileListingTypeOptions,
  type MobileListingCondition,
  type MobileListingType,
  type MobileSellFormState
} from "./sell-form-model";

type CategoryStatus = "loading" | "ready" | "empty" | "error";
type SubmitStatus = "idle" | "submitting";

export function SellScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const [formState, setFormState] = useState<MobileSellFormState>(() =>
    createDefaultMobileSellFormState()
  );
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [categoryStatus, setCategoryStatus] = useState<CategoryStatus>("loading");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [selectedImages, setSelectedImages] = useState<MobilePickedImageInput[]>([]);
  const [categorySelectOpen, setCategorySelectOpen] = useState(false);
  const [listingTypeSelectOpen, setListingTypeSelectOpen] = useState(false);
  const [conditionSelectOpen, setConditionSelectOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createdListingTitle, setCreatedListingTitle] = useState<string | null>(null);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [aiDraftStatus, setAiDraftStatus] = useState<MobileAiListingDraftStatus>("idle");
  const [aiDraftSuggestion, setAiDraftSuggestion] = useState<MobileAiListingDraftSuggestion | null>(null);
  const [aiDraftMessage, setAiDraftMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        setCategoryStatus("loading");

        const nextCategories = await fetchMobileCategories();

        if (!active) {
          return;
        }

        setCategories(nextCategories);
        setCategoryStatus(nextCategories.length > 0 ? "ready" : "empty");
      } catch {
        if (!active) {
          return;
        }

        setCategories([]);
        setCategoryStatus("error");
      }
    }

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  if (!authSession.currentUser) {
    return (
      <Screen
        title="İlan ver"
      >
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Hesabınla ilanlarını yönetebilirsin.</Text>
          <Text style={styles.stateText}>
            Giriş yaptıktan sonra favoriler, mesajlar ve ilan yönetimi aynı hesapta toplanır.
          </Text>
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Giriş yap</Text>
            </Pressable>
          </Link>
        </View>
      </Screen>
    );
  }

  function updateFormField<Key extends keyof MobileSellFormState>(
    key: Key,
    value: MobileSellFormState[Key]
  ) {
    setMessage(null);
    setCreatedListingTitle(null);
    setCreatedListingId(null);
    setFormState((currentState) => ({
      ...currentState,
      [key]: value
    }));

    if (key === "categoryId") {
      setCategorySelectOpen(false);
    }
  }

  async function handlePickImage() {
    setMessage(null);

    const remainingSlots = getRemainingMobileListingImageSlots(selectedImages.length);

    if (remainingSlots <= 0) {
      setMessage(`En fazla ${MOBILE_LISTING_IMAGE_LIMIT} fotoğraf ekleyebilirsin.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setMessage("Fotoğraf seçmek için galeri izni vermelisin.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.86,
      selectionLimit: remainingSlots
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const pickedMoreThanRemaining = result.assets.length > remainingSlots;
    const assets = result.assets.slice(0, remainingSlots);
    const countValidation = validateMobileListingImageSelectionCount(selectedImages.length, assets.length);

    if (!countValidation.ok) {
      setMessage(countValidation.message);
      return;
    }

    const nextImages: MobilePickedImageInput[] = [];

    for (const asset of assets) {
      const imageFile = buildMobileListingImageUploadFile({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType
      });

      if (!imageFile.ok) {
        setMessage(imageFile.message);
        return;
      }

      nextImages.push({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType
      });
    }

    const nextImageCount = Math.min(selectedImages.length + nextImages.length, MOBILE_LISTING_IMAGE_LIMIT);
    markAiDraftStaleIfImagesChanged(selectedImages.length, nextImageCount);
    setSelectedImages((currentImages) => [...currentImages, ...nextImages].slice(0, MOBILE_LISTING_IMAGE_LIMIT));

    if (pickedMoreThanRemaining || selectedImages.length + nextImages.length >= MOBILE_LISTING_IMAGE_LIMIT) {
      setMessage(`En fazla ${MOBILE_LISTING_IMAGE_LIMIT} fotoğraf ekleyebilirsin.`);
    }
  }

  function handleRemoveImage(index: number) {
    markAiDraftStaleIfImagesChanged(selectedImages.length, Math.max(0, selectedImages.length - 1));
    setSelectedImages((currentImages) => currentImages.filter((_, currentIndex) => currentIndex !== index));
    setMessage(null);
  }

  function markAiDraftStaleIfImagesChanged(previousImageCount: number, nextImageCount: number) {
    if (previousImageCount !== nextImageCount) {
      setAiDraftStatus((currentStatus) => currentStatus === "success" ? "stale" : currentStatus);
    }
  }

  async function handleCreateAiDraft() {
    if (aiDraftStatus === "pending") {
      return;
    }

    try {
      setAiDraftStatus("pending");
      setAiDraftMessage(null);
      const suggestion = await fetchMobileAiListingDraftSuggestion({
        city: authSession.currentUser?.profile.locationCity ?? null,
        formState,
        selectedImages
      });
      setAiDraftSuggestion(suggestion);
      setAiDraftStatus("success");
    } catch (draftError) {
      setAiDraftMessage(
        draftError instanceof Error
          ? draftError.message
          : "AI taslağı şu an hazırlanamadı. Bilgileri manuel girebilirsin."
      );
      setAiDraftStatus("error");
    }
  }

  function handleApplyAiDraft() {
    if (!aiDraftSuggestion) {
      return;
    }

    setFormState((currentState) => applyMobileAiListingDraftToEmptyFields(currentState, aiDraftSuggestion));
    setAiDraftMessage("Boş alanlara öneriler uygulandı. Yayınlamadan önce kontrol et.");
  }

  function handleDismissAiDraft() {
    setAiDraftStatus("idle");
    setAiDraftSuggestion(null);
    setAiDraftMessage(null);
  }

  async function handleSubmit() {
    if (submitStatus === "submitting") {
      return;
    }

    const validation = buildMobileCreateListingPayload(formState);

    if (!validation.ok) {
      setMessage(validation.message);
      return;
    }

    if (selectedImages.length === 0) {
      setMessage("İlanı yayınlamak için en az bir gerçek ürün fotoğrafı eklemelisin.");
      return;
    }

    const imageUploadFiles = selectedImages.map((image) => buildMobileListingImageUploadFile(image));
    const invalidImageUploadFile = imageUploadFiles.find((imageUploadFile) => !imageUploadFile.ok);

    if (invalidImageUploadFile && !invalidImageUploadFile.ok) {
      setMessage(invalidImageUploadFile.message);
      return;
    }

    try {
      setSubmitStatus("submitting");
      setMessage(null);
      setCreatedListingTitle(null);
      setCreatedListingId(null);

      const listing = await createMobileListing(validation.payload);

      if (imageUploadFiles.length > 0) {
        try {
          for (const imageUploadFile of imageUploadFiles) {
            if (imageUploadFile.ok) {
              await uploadMobileListingImage(listing.id, imageUploadFile.file);
            }
          }
        } catch (imageUploadError) {
          setCreatedListingTitle(listing.title);
          setCreatedListingId(listing.id);
          setMessage(
            imageUploadError instanceof Error
              ? `İlan oluşturuldu fakat görsel yüklenemedi: ${imageUploadError.message}`
              : "İlan oluşturuldu fakat görsel yüklenemedi."
          );
          return;
        }
      }

      setSelectedImages([]);
      setFormState(createDefaultMobileSellFormState());

      router.replace("/my-listings?publication=review");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İlan şu an oluşturulamadı.");
    } finally {
      setSubmitStatus("idle");
    }
  }

  const selectedCategory = categories.find((category) => category.id === formState.categoryId);
  const selectedListingType = mobileListingTypeOptions.find((option) => option.value === formState.listingType);
  const selectedCondition = mobileListingConditionOptions.find((option) => option.value === formState.condition);
  const isSubmitting = submitStatus === "submitting";

  return (
    <Screen title="İlan ver">
      {categoryStatus === "loading" ? <Paragraph>Kategoriler yükleniyor...</Paragraph> : null}

      {categoryStatus === "error" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Kategoriler yüklenemedi</Text>
          <Text style={styles.stateText}>API bağlantısını kontrol edip tekrar dene.</Text>
        </View>
      ) : null}

      {categoryStatus === "empty" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Kategori bulunamadı</Text>
          <Text style={styles.stateText}>İlan oluşturmak için önce kategori seed’i gerekiyor.</Text>
        </View>
      ) : null}

      {categories.length > 0 ? (
        <View style={styles.categoryCard}>
          <Text style={styles.label}>Kategori</Text>
          <Pressable
            accessibilityLabel="Kategori seç"
            onPress={() => setCategorySelectOpen((currentValue) => !currentValue)}
            style={styles.categorySelectButton}
          >
            <Text
              numberOfLines={1}
              style={[styles.categorySelectText, selectedCategory ? null : styles.categorySelectPlaceholder]}
            >
              {selectedCategory?.name ?? "Kategori seç"}
            </Text>
            <Ionicons
              color={colors.muted}
              name={categorySelectOpen ? "chevron-up" : "chevron-down"}
              size={19}
            />
          </Pressable>

          {categorySelectOpen ? (
            <View style={styles.categoryMenu}>
              {categories.map((category) => {
                const selected = formState.categoryId === category.id;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={category.id}
                    onPress={() => updateFormField("categoryId", category.id)}
                    style={[styles.categoryRow, selected ? styles.categoryRowSelected : null]}
                  >
                    <Text style={[styles.categoryRowText, selected ? styles.categoryRowTextSelected : null]}>
                      {category.name}
                    </Text>
                    {selected ? <Ionicons color={colors.primaryDark} name="checkmark" size={18} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.imageCard}>
        <Text style={styles.label}>Fotoğraf</Text>
        {selectedImages.length > 0 ? (
          <>
            <View style={styles.previewGrid}>
              {selectedImages.map((image, index) => (
                <View key={`${image.uri ?? "image"}-${index}`} style={styles.previewTile}>
                  {image.uri ? <Image source={{ uri: image.uri }} style={styles.previewImage} /> : null}
                  <Pressable
                    accessibilityLabel={`${index + 1}. fotoğrafı kaldır`}
                    onPress={() => handleRemoveImage(index)}
                    style={styles.removeImageButton}
                  >
                    <Ionicons color={colors.primaryForeground} name="close" size={15} />
                  </Pressable>
                </View>
              ))}
            </View>

            <Text style={styles.imageCountText}>
              {selectedImages.length}/{MOBILE_LISTING_IMAGE_LIMIT} fotoğraf seçildi
            </Text>

            <Pressable
              disabled={selectedImages.length >= MOBILE_LISTING_IMAGE_LIMIT}
              onPress={handlePickImage}
              style={[
                styles.secondaryButton,
                selectedImages.length >= MOBILE_LISTING_IMAGE_LIMIT ? styles.disabledButton : null
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {selectedImages.length >= MOBILE_LISTING_IMAGE_LIMIT ? "Maksimuma ulaşıldı" : "Fotoğraf ekle"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderTitle}>Fotoğraf seçilmedi</Text>
              <Text style={styles.imagePlaceholderText}>JPG, PNG veya WEBP; en fazla 5 fotoğraf.</Text>
            </View>
            <Pressable onPress={handlePickImage} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Fotoğraf seç</Text>
            </Pressable>
          </>
        )}
      </View>

      <AiListingDraftCard
        categories={categories}
        onApply={handleApplyAiDraft}
        onDismiss={handleDismissAiDraft}
        onRequestDraft={() => void handleCreateAiDraft()}
        suggestion={aiDraftSuggestion}
        message={aiDraftMessage}
        status={aiDraftStatus}
      />

      <View style={styles.formCard}>
        <Text style={styles.label}>Başlık</Text>
        <TextInput
          autoCorrect
          maxLength={160}
          onChangeText={(value) => updateFormField("title", value)}
          placeholder="Örn. Temiz bebek arabası"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          value={formState.title}
        />

        <Text style={styles.label}>Açıklama</Text>
        <TextInput
          maxLength={2000}
          multiline
          onChangeText={(value) => updateFormField("description", value)}
          placeholder="Kullanım süresi, durum, eksik parça ve teslim notu..."
          placeholderTextColor={colors.subtle}
          style={[styles.input, styles.textArea]}
          textAlignVertical="top"
          value={formState.description}
        />

        <Text style={styles.label}>Fiyat</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={(value) => updateFormField("priceAmount", value)}
          placeholder="Örn. 6500"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          value={formState.priceAmount}
        />
        <Text style={styles.helperText}>Boş bırakırsan “fiyat belirtilmedi” olarak görünür.</Text>

        <Text style={styles.label}>Satış tipi</Text>
        <SelectButton
          label={selectedListingType?.label ?? "Satış tipi seç"}
          onPress={() => setListingTypeSelectOpen((currentValue) => !currentValue)}
          open={listingTypeSelectOpen}
        />
        {listingTypeSelectOpen ? (
          <View style={styles.categoryMenu}>
            {mobileListingTypeOptions.map((option) => (
              <SelectRow
                key={option.value}
                label={option.label}
                onPress={() => {
                  updateFormField("listingType", option.value as MobileListingType);
                  setListingTypeSelectOpen(false);
                }}
                selected={formState.listingType === option.value}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>Ürün durumu</Text>
        <SelectButton
          label={selectedCondition?.label ?? "Ürün durumu seç"}
          onPress={() => setConditionSelectOpen((currentValue) => !currentValue)}
          open={conditionSelectOpen}
        />
        {conditionSelectOpen ? (
          <View style={styles.categoryMenu}>
            {mobileListingConditionOptions.map((option) => (
              <SelectRow
                key={option.value}
                label={option.label}
                onPress={() => {
                  updateFormField("condition", option.value as MobileListingCondition);
                  setConditionSelectOpen(false);
                }}
                selected={formState.condition === option.value}
              />
            ))}
          </View>
        ) : null}

        <MobileListingAgeRangeField
          disabled={isSubmitting}
          onChange={(recommendedAgeRange) => updateFormField("recommendedAgeRange", recommendedAgeRange)}
          value={formState.recommendedAgeRange}
        />
      </View>

      {message ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>{message}</Text>
          {createdListingId ? (
            <Pressable
              onPress={() => router.push(`/listing/${encodeURIComponent(createdListingId)}`)}
              style={styles.alertAction}
            >
              <Text style={styles.alertActionText}>Oluşturulan ilana git</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {createdListingTitle ? (
        <View style={styles.successCard}>
          <Text style={styles.successText}>{createdListingTitle} oluşturuldu.</Text>
        </View>
      ) : null}

      <Pressable
        disabled={isSubmitting || categoryStatus !== "ready"}
        onPress={handleSubmit}
        style={[
          styles.primaryButton,
          isSubmitting || categoryStatus !== "ready" ? styles.disabledButton : null
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {isSubmitting ? "İlan oluşturuluyor..." : "İlanı oluştur"}
        </Text>
      </Pressable>
    </Screen>
  );
}

function SelectButton({
  label,
  onPress,
  open
}: {
  label: string;
  onPress: () => void;
  open: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.categorySelectButton}>
      <Text numberOfLines={1} style={styles.categorySelectText}>
        {label}
      </Text>
      <Ionicons color={colors.muted} name={open ? "chevron-up" : "chevron-down"} size={19} />
    </Pressable>
  );
}

function AiListingDraftCard({
  categories,
  message,
  onApply,
  onDismiss,
  onRequestDraft,
  status,
  suggestion
}: {
  categories: MobileCategory[];
  message: string | null;
  onApply: () => void;
  onDismiss: () => void;
  onRequestDraft: () => void;
  status: MobileAiListingDraftStatus;
  suggestion: MobileAiListingDraftSuggestion | null;
}) {
  const categoryLabel = getMobileAiListingDraftCategoryLabel(suggestion?.categoryId, categories);
  const priceRange = suggestion ? formatMobileAiListingDraftPriceRange(suggestion) : null;
  const conditionLabel = suggestion?.condition
    ? mobileListingConditionOptions.find((option) => option.value === suggestion.condition)?.label
    : null;

  return (
    <View style={styles.aiCard}>
      <View style={styles.aiHeaderRow}>
        <View style={styles.aiHeaderText}>
          <Text style={styles.label}>Görsellerden ilan taslağı</Text>
          <Text style={styles.helperText}>
            Fotoğraflar ve yazdığın bilgilerden öneri üretir. Sonucu sen kontrol et; AI güvenlik,
            kaza geçmişi, sertifika, marka/model veya ürün uygunluğu garantisi vermez.
          </Text>
        </View>
        {status === "success" || status === "stale" ? (
          <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.aiDismissButton}>
            <Text style={styles.aiDismissText}>Kapat</Text>
          </Pressable>
        ) : null}
      </View>

      {message ? <Text style={status === "error" ? styles.aiErrorText : styles.aiMessageText}>{message}</Text> : null}
      {status === "stale" ? (
        <Text style={styles.aiMessageText}>Fotoğraflar değişti. Güncel öneri için yeniden analiz et.</Text>
      ) : null}

      {suggestion ? (
        <View style={styles.aiSuggestionBlock}>
          <Text style={styles.aiMetaText}>{getMobileAiListingDraftConfidenceLabel(suggestion.confidence)}</Text>
          {suggestion.title ? <Text style={styles.aiSuggestionText}>Başlık: {suggestion.title}</Text> : null}
          {suggestion.description ? <Text style={styles.aiSuggestionText}>Açıklama: {suggestion.description}</Text> : null}
          {categoryLabel ? <Text style={styles.aiSuggestionText}>Kategori: {categoryLabel}</Text> : null}
          {conditionLabel ? <Text style={styles.aiSuggestionText}>Durum önerisi: {conditionLabel}</Text> : null}
          {priceRange && suggestion.priceSuggestion ? (
            <Text style={styles.aiSuggestionText}>
              Fiyat aralığı: {priceRange} · {suggestion.priceSuggestion.reason}
            </Text>
          ) : null}

          {suggestion.missingDetails.length > 0 ? (
            <View style={styles.aiListBlock}>
              <Text style={styles.aiMetaText}>Eksik bilgiler</Text>
              {suggestion.missingDetails.map((item) => (
                <Text key={item} style={styles.aiListItem}>• {item}</Text>
              ))}
            </View>
          ) : null}

          {suggestion.warnings.length > 0 ? (
            <View style={styles.aiListBlock}>
              <Text style={styles.aiMetaText}>Uyarılar</Text>
              {suggestion.warnings.map((item) => (
                <Text key={item} style={styles.aiListItem}>• {item}</Text>
              ))}
            </View>
          ) : null}

          {suggestion.imageFeedback.length > 0 ? (
            <View style={styles.aiListBlock}>
              <Text style={styles.aiMetaText}>Fotoğraf geri bildirimi</Text>
              {suggestion.imageFeedback.map((item, index) => (
                <Text key={`${item.status}-${index}`} style={styles.aiListItem}>• {item.message}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.aiActionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={status === "pending"}
          onPress={onRequestDraft}
          style={[styles.secondaryButton, status === "pending" ? styles.disabledButton : null]}
        >
          <Text style={styles.secondaryButtonText}>
            {status === "pending"
              ? "Görseller inceleniyor..."
              : suggestion
                ? "Yeniden analiz et"
                : "AI taslağı oluştur"}
          </Text>
        </Pressable>

        {suggestion ? (
          <Pressable
            accessibilityRole="button"
            onPress={onApply}
            style={styles.aiApplyButton}
          >
            <Text style={styles.aiApplyButtonText}>Boş alanlara uygula</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SelectRow({
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
      onPress={onPress}
      style={[styles.categoryRow, selected ? styles.categoryRowSelected : null]}
    >
      <Text style={[styles.categoryRowText, selected ? styles.categoryRowTextSelected : null]}>{label}</Text>
      {selected ? <Ionicons color={colors.primaryDark} name="checkmark" size={18} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stateCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10
  },
  stateTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  categoryCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 10
  },
  categorySelectButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    paddingHorizontal: 14
  },
  categorySelectText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  categorySelectPlaceholder: {
    color: colors.subtle,
    fontWeight: "800"
  },
  categoryMenu: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background
  },
  categoryRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  categoryRowSelected: {
    backgroundColor: colors.surfaceSoft
  },
  categoryRowText: {
    flex: 1,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  categoryRowTextSelected: {
    color: colors.primaryDark,
    fontWeight: "900"
  },
  imageCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12
  },
  aiCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12
  },
  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  aiHeaderText: {
    flex: 1,
    gap: 6
  },
  aiDismissButton: {
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  aiDismissText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  aiSuggestionBlock: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10
  },
  aiMetaText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  aiSuggestionText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  aiListBlock: {
    gap: 4
  },
  aiListItem: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  aiMessageText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  aiErrorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  aiActionRow: {
    gap: 9
  },
  aiApplyButton: {
    width: "100%",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 12
  },
  aiApplyButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "900"
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9
  },
  previewTile: {
    position: "relative",
    width: "31.5%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: colors.cream
  },
  previewImage: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.cream
  },
  removeImageButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.72)"
  },
  imageCountText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 170,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    gap: 5
  },
  imagePlaceholderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  imagePlaceholderText: {
    color: colors.muted,
    fontSize: 13
  },
  formCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 9
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  textArea: {
    minHeight: 116
  },
  helperText: {
    color: colors.subtle,
    fontSize: 12,
    lineHeight: 17
  },
  alertCard: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
    padding: 14,
    gap: 10
  },
  alertText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  alertAction: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingVertical: 11
  },
  alertActionText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900"
  },
  successCard: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
    padding: 14
  },
  successText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 14
  },
  secondaryButton: {
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.55
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: "900"
  }
});
