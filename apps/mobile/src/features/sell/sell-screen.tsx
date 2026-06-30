import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Paragraph, Screen, SectionHeader } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import { createMobileListing, fetchMobileCategories, type MobileCategory } from "./sell-api";
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
  const [message, setMessage] = useState<string | null>(null);
  const [createdListingTitle, setCreatedListingTitle] = useState<string | null>(null);

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

        if (nextCategories[0]) {
          setFormState((currentState) => ({
            ...currentState,
            categoryId: currentState.categoryId || nextCategories[0]!.id
          }));
        }
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
        eyebrow="İlan Ver"
        title="Ürününü satmaya başla"
        subtitle="İlan hazırlamak için giriş yapman gerekiyor."
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
    setFormState((currentState) => ({
      ...currentState,
      [key]: value
    }));
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

    try {
      setSubmitStatus("submitting");
      setMessage(null);
      setCreatedListingTitle(null);

      const listing = await createMobileListing(validation.payload);

      setCreatedListingTitle(listing.title);
      setFormState(createDefaultMobileSellFormState());

      router.push(`/listing/${encodeURIComponent(listing.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İlan şu an oluşturulamadı.");
    } finally {
      setSubmitStatus("idle");
    }
  }

  const selectedCategory = categories.find((category) => category.id === formState.categoryId);
  const isSubmitting = submitStatus === "submitting";

  return (
    <Screen
      eyebrow="İlan Ver"
      title="İlanını oluştur"
      subtitle="Fotoğraf yükleme sonraki pakette; bu akış şimdilik aktif ilanı güvenli şekilde oluşturur."
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Release minimum ilan formu</Text>
        <Text style={styles.heroText}>
          Başlık, kategori, durum, fiyat ve açıklamayı gir; ilan aktif olarak oluşturulup detay ekranına yönlenir.
        </Text>
      </View>

      <SectionHeader
        title="Kategori"
        description={
          selectedCategory
            ? `Seçili kategori: ${selectedCategory.name}`
            : "Ürüne en yakın kategoriyi seç."
        }
      />

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
        <View style={styles.optionGrid}>
          {categories.slice(0, 12).map((category) => {
            const selected = formState.categoryId === category.id;

            return (
              <Pressable
                key={category.id}
                onPress={() => updateFormField("categoryId", category.id)}
                style={[styles.optionChip, selected ? styles.optionChipSelected : null]}
              >
                <Text style={[styles.optionChipText, selected ? styles.optionChipTextSelected : null]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <SectionHeader title="İlan bilgileri" description="Kısa, net ve doğrulanabilir bilgi gir." />

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
      </View>

      <SectionHeader title="Satış tipi" />
      <View style={styles.optionGrid}>
        {mobileListingTypeOptions.map((option) => {
          const selected = formState.listingType === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => updateFormField("listingType", option.value as MobileListingType)}
              style={[styles.optionChip, selected ? styles.optionChipSelected : null]}
            >
              <Text style={[styles.optionChipText, selected ? styles.optionChipTextSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Ürün durumu" />
      <View style={styles.optionGrid}>
        {mobileListingConditionOptions.map((option) => {
          const selected = formState.condition === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => updateFormField("condition", option.value as MobileListingCondition)}
              style={[styles.optionChip, selected ? styles.optionChipSelected : null]}
            >
              <Text style={[styles.optionChipText, selected ? styles.optionChipTextSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>Güvenli ilan notu</Text>
        <Text style={styles.safetyText}>
          Telefon, e-posta, açık adres, ödeme linki veya emin olmadığın güvenlik iddialarını açıklamaya yazma.
        </Text>
      </View>

      {message ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>{message}</Text>
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

const styles = StyleSheet.create({
  heroCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 8
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21
  },
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
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9
  },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  optionChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft
  },
  optionChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  optionChipTextSelected: {
    color: colors.primaryDark
  },
  safetyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: 16,
    gap: 7
  },
  safetyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  safetyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  alertCard: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: radius.lg,
    backgroundColor: "#fff1f2",
    padding: 14
  },
  alertText: {
    color: "#b42318",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  successCard: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: radius.lg,
    backgroundColor: "#f0fdf4",
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
  disabledButton: {
    opacity: 0.55
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  }
});
