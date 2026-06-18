"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, LoadingBlock } from "../../components/ui";
import type { Category } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { useAuthPrompt } from "../auth/auth-prompt-provider";
import {
  createListingRequest,
  requestListingDraftSuggestion,
  uploadListingImageRequest,
  type AiListingDraftSuggestion,
  type CreateListingRequest
} from "./api";
import {
  formatCategoryName,
  formatListingCondition
} from "./listing-display";
import type { ListingCondition, ListingType } from "./listing-form-options";
import styles from "./sell-listing-form.module.css";
import { SellListingFields } from "./sell-listing-fields";

type SellListingFormProps = {
  categories: Category[];
  apiBaseUrl: string;
};

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_IMAGE_COUNT = 5;

export function SellListingForm({ categories, apiBaseUrl }: SellListingFormProps) {
  const { dictionary } = useI18n();
  const router = useRouter();
  const { openAuthPrompt } = useAuthPrompt();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [draftSuggestion, setDraftSuggestion] = useState<AiListingDraftSuggestion | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasCategories = categories.length > 0;
  const clearSelectedImages = useCallback(() => {
    setSelectedImages((currentImages) => {
      currentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  }, []);
  const clearProtectedState = useCallback(() => {
    setErrorMessage(null);
    setAiErrorMessage(null);
    setDraftSuggestion(null);
    clearSelectedImages();
    setIsSuggesting(false);
    setIsSubmitting(false);
  }, [clearSelectedImages]);
  const { isCheckingAuth, isAuthenticated, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState,
    redirectTo: null
  });

  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated) {
      openAuthPrompt({
        title: "İlan oluşturmak için giriş yap",
        returnTo: "/sell",
        onAuthenticated: () => {
          void requireAuth();
        }
      });
    }
  }, [isCheckingAuth, isAuthenticated, openAuthPrompt, requireAuth]);

  useEffect(() => clearSelectedImages, [clearSelectedImages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const payload = buildCreateListingPayload(new FormData(event.currentTarget));

    if (!payload) {
      setErrorMessage("Zorunlu alanları kontrol et.");
      return;
    }

    if (!(await requireAuth())) {
      openAuthPrompt({
        title: "İlan oluşturmak için giriş yap",
        returnTo: "/sell",
        onAuthenticated: () => {
          void requireAuth();
        }
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if ((payload.imageUrls?.length ?? 0) + selectedImages.length > MAX_IMAGE_COUNT) {
        setErrorMessage("En fazla 5 görsel ekleyebilirsin.");
        return;
      }

      const body = await createListingRequest(apiBaseUrl, payload);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      for (const selectedImage of selectedImages) {
        const uploadBody = await uploadListingImageRequest(apiBaseUrl, body.data.listing.id, selectedImage.file);

        if (!uploadBody.ok) {
          setErrorMessage(getApiErrorMessage(uploadBody.error, dictionary, "Görsel yüklenemedi."));
          return;
        }
      }

      clearSelectedImages();
      router.push(`/listings/${body.data.listing.id}`);
      router.refresh();
    } catch {
      setErrorMessage("İlan şu an oluşturulamadı. Biraz sonra tekrar dene.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (selectedImages.length + files.length > MAX_IMAGE_COUNT) {
      setErrorMessage("En fazla 5 görsel ekleyebilirsin.");
      return;
    }

    setErrorMessage(null);
    setAiErrorMessage(null);
    setDraftSuggestion(null);
    setSelectedImages((currentImages) => [
      ...currentImages,
      ...files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ]);
  }

  function removeSelectedImage(id: string) {
    setSelectedImages((currentImages) => {
      const image = currentImages.find((currentImage) => currentImage.id === id);

      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }

      return currentImages.filter((currentImage) => currentImage.id !== id);
    });
    setDraftSuggestion(null);
  }

  async function handleGenerateDraftSuggestion(form: HTMLFormElement | null) {
    if (!form) {
      return;
    }

    setAiErrorMessage(null);
    setDraftSuggestion(null);

    if (!(await requireAuth())) {
      openAuthPrompt({
        title: "AI önerisi için giriş yap",
        returnTo: "/sell",
        onAuthenticated: () => {
          void requireAuth();
        }
      });
      return;
    }

    const formData = buildDraftSuggestionFormData(form, selectedImages);

    if (!hasDraftSuggestionContext(formData)) {
      setAiErrorMessage("AI önerisi için en az bir bilgi veya görsel ekle.");
      return;
    }

    setIsSuggesting(true);

    try {
      const body = await requestListingDraftSuggestion(apiBaseUrl, formData);

      if (!body.ok) {
        setAiErrorMessage(getApiErrorMessage(body.error, dictionary, "AI önerisi şu an kullanılamıyor. Bilgileri manuel girebilirsin."));
        return;
      }

      setDraftSuggestion(body.data.suggestion);
    } catch {
      setAiErrorMessage("AI önerisi şu an kullanılamıyor. Bilgileri manuel girebilirsin.");
    } finally {
      setIsSuggesting(false);
    }
  }

  if (isCheckingAuth) {
    return <LoadingBlock title="Yükleniyor" />;
  }

  return (
    <form className={styles.workspace} ref={formRef} onSubmit={handleSubmit}>
      <section className={styles.fields} aria-label="İlan bilgileri">
        {!hasCategories ? (
          <Alert
            title="Kategoriler yüklenemedi"
            message="Kategori seçimi olmadan ilan oluşturulamaz. Biraz sonra tekrar dene."
          />
        ) : null}

        <div className={styles.sectionHeading}>
          <h2>İlan bilgileri</h2>
          <p>Yayınlamadan önce bilgileri kontrol et.</p>
        </div>
        <SellListingFields categories={categories} />

        {errorMessage ? (
          <Alert title="İlan oluşturulamadı" message={errorMessage} />
        ) : null}

        <div className="form-actions form-actions-product">
          <p className="form-note">Telefon, e-posta veya açık adres yazmana gerek yok.</p>
          <div className="form-button-row">
            <Button type="submit" disabled={isSubmitting || !hasCategories}>
              {isSubmitting ? "Kaydediliyor..." : "İlanı oluştur"}
            </Button>
          </div>
        </div>
      </section>

      <aside className={styles.sidePanel} aria-label="Görseller ve AI önerileri">
        <section className={styles.imagePanel} aria-label="Görseller">
          <div className="image-upload-header">
            <div>
              <h2>Görseller</h2>
              <p>En fazla 5 görsel ekleyebilirsin.</p>
            </div>
            <Badge>{selectedImages.length}/{MAX_IMAGE_COUNT} görsel</Badge>
          </div>

          <label className={`file-upload-label ${styles.fileUploadLabel}`}>
            <span>Görsel ekle</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={isSubmitting || selectedImages.length >= MAX_IMAGE_COUNT}
              multiple
              type="file"
              onChange={handleImageSelection}
            />
          </label>

          {selectedImages.length === 0 ? (
            <div className={styles.imageEmpty}>
              <strong>Ürünü net gösteren fotoğraflar ekle.</strong>
              <span>Ön, yan, kullanım izi ve varsa aksesuarları göstermek ailelerin kararını kolaylaştırır.</span>
            </div>
          ) : (
            <ul className={styles.previewGrid}>
              {selectedImages.map((image) => (
                <li key={image.id}>
                  <img src={image.previewUrl} alt="" />
                  <div>
                    <span>{image.file.name}</span>
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => removeSelectedImage(image.id)}
                    >
                      Kaldır
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.aiPanel} aria-label="AI önerileri">
          <div className={styles.sectionHeading}>
            <h2>AI önerileri</h2>
            <p>Görselleri ve mevcut alanları inceler; önerileri sen onaylamadan forma yazmaz.</p>
          </div>

          <Button
            variant="secondary"
            type="button"
            disabled={isSuggesting}
            onClick={() => {
              void handleGenerateDraftSuggestion(formRef.current);
            }}
          >
            {isSuggesting ? "AI inceliyor..." : "AI ile düzenle"}
          </Button>

          {aiErrorMessage ? (
            <Alert title="AI önerisi alınamadı" message={aiErrorMessage} />
          ) : null}

          {draftSuggestion ? (
            <AiDraftSuggestionReview
              categories={categories}
              suggestion={draftSuggestion}
              onApplySuggestion={() => {
                if (formRef.current) {
                  applyDraftSuggestion(formRef.current, draftSuggestion);
                }
              }}
              onDismiss={() => setDraftSuggestion(null)}
            />
          ) : (
            <p className="muted">AI önerisi başlık, açıklama, kategori, durum ve görsel kontrol notlarını önerebilir.</p>
          )}
        </section>
      </aside>
    </form>
  );
}

function AiDraftSuggestionReview({
  categories,
  suggestion,
  onApplySuggestion,
  onDismiss
}: {
  categories: Category[];
  suggestion: AiListingDraftSuggestion;
  onApplySuggestion: () => void;
  onDismiss: () => void;
}) {
  const { dictionary } = useI18n();
  const category = suggestion.categoryId
    ? categories.find((candidate) => candidate.id === suggestion.categoryId)
    : undefined;

  return (
    <div className={styles.suggestionReview}>
      <div className={styles.suggestionHeader}>
        <strong>Öneri güveni: {formatConfidence(suggestion.confidence)}</strong>
      </div>

      <dl>
        {suggestion.title ? (
          <div>
            <dt>Başlık</dt>
            <dd>{suggestion.title}</dd>
          </div>
        ) : null}

        {suggestion.description ? (
          <div>
            <dt>Açıklama</dt>
            <dd>{suggestion.description}</dd>
          </div>
        ) : null}

        {category ? (
          <div>
            <dt>Kategori</dt>
            <dd>{formatCategoryName(category, dictionary)}</dd>
          </div>
        ) : null}

        {suggestion.condition ? (
          <div>
            <dt>Durum</dt>
            <dd>{formatListingCondition(suggestion.condition, dictionary)}</dd>
          </div>
        ) : null}

        {suggestion.priceSuggestion ? (
          <div>
            <dt>Fiyat aralığı</dt>
            <dd>
              {suggestion.priceSuggestion.min.toLocaleString("tr-TR")} - {suggestion.priceSuggestion.max.toLocaleString("tr-TR")} TRY
              <span>{suggestion.priceSuggestion.reason}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      {suggestion.imageFeedback.length > 0 ? (
        <div className={styles.listBlock}>
          <strong>Görsel notları</strong>
          <ul>
            {suggestion.imageFeedback.map((item, index) => (
              <li key={`${item.imageIdOrUrl}-${index}`}>
                {item.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestion.missingDetails.length > 0 ? (
        <div className={styles.listBlock}>
          <strong>Eksik bilgiler</strong>
          <ul>
            {suggestion.missingDetails.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestion.warnings.length > 0 ? (
        <div className={styles.listBlock}>
          <strong>Kontrol et</strong>
          <ul>
            {suggestion.warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="form-button-row">
        <Button type="button" onClick={onApplySuggestion}>
          Önerileri uygula
        </Button>
        <Button variant="ghost" type="button" onClick={onDismiss}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

function buildCreateListingPayload(formData: FormData): CreateListingRequest | null {
  const categoryId = getString(formData, "categoryId");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const priceAmount = getString(formData, "priceAmount");
  const currency = getString(formData, "currency").toUpperCase() || "TRY";
  const listingType = getString(formData, "listingType") as ListingType;
  const condition = getString(formData, "condition") as ListingCondition;
  const imageUrls = getString(formData, "imageUrls")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!categoryId || !title || !listingType || !condition) {
    return null;
  }

  return {
    categoryId,
    title,
    currency,
    listingType,
    condition,
    ...(description ? { description } : {}),
    ...(priceAmount ? { priceAmount } : {}),
    ...(imageUrls.length > 0 ? { imageUrls } : {})
  };
}

function buildDraftSuggestionFormData(form: HTMLFormElement, images: SelectedImage[]): FormData {
  const source = new FormData(form);
  const formData = new FormData();
  const fieldKeys = [
    "categoryId",
    "listingType",
    "title",
    "description",
    "condition",
    "priceAmount",
    "currency",
    "city"
  ];

  for (const key of fieldKeys) {
    const value = getString(source, key);

    if (value) {
      formData.append(key, value);
    }
  }

  formData.append("locale", "tr");

  for (const image of images) {
    formData.append("images", image.file, image.file.name);
  }

  return formData;
}

function hasDraftSuggestionContext(formData: FormData): boolean {
  for (const [, value] of formData.entries()) {
    if (value instanceof File) {
      return true;
    }

    if (typeof value === "string" && value.trim() && value !== "tr" && value !== "TRY") {
      return true;
    }
  }

  return false;
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function applyDraftSuggestion(form: HTMLFormElement, suggestion: AiListingDraftSuggestion): void {
  if (suggestion.title) {
    setTextInputValue(form, "title", suggestion.title);
  }

  if (suggestion.description) {
    setTextareaValue(form, "description", suggestion.description);
  }

  if (suggestion.categoryId) {
    setSelectValue(form, "categoryId", suggestion.categoryId);
  }

  if (suggestion.condition) {
    setSelectValue(form, "condition", suggestion.condition);
  }
}

function setTextInputValue(form: HTMLFormElement, key: string, value: string): void {
  const field = form.elements.namedItem(key);

  if (field instanceof HTMLInputElement) {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function setTextareaValue(form: HTMLFormElement, key: string, value: string): void {
  const field = form.elements.namedItem(key);

  if (field instanceof HTMLTextAreaElement) {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function setSelectValue(form: HTMLFormElement, key: string, value: string): void {
  const field = form.elements.namedItem(key);

  if (field instanceof HTMLSelectElement) {
    field.value = value;
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function formatConfidence(confidence: AiListingDraftSuggestion["confidence"]): string {
  const labels: Record<AiListingDraftSuggestion["confidence"], string> = {
    low: "düşük",
    medium: "orta",
    high: "yüksek"
  };

  return labels[confidence];
}
