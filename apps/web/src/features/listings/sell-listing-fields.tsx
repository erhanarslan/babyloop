"use client";

import { Select, Textarea, TextInput } from "../../components/ui";
import type { Category } from "../../lib/api";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { formatCategoryName, formatListingCondition, formatListingType } from "./listing-display";
import { conditions, listingTypes } from "./listing-form-options";

type SellListingFieldsProps = {
  categories: Category[];
};

export function SellListingFields({ categories }: SellListingFieldsProps) {
  const { dictionary } = useI18n();
  const hasCategories = categories.length > 0;

  return (
    <div className="form-grid">
      <Select label="Kategori" name="categoryId" required disabled={!hasCategories}>
          {hasCategories ? (
            categories.map((category) => (
              <option key={category.id} value={category.id}>
                {formatCategoryName(category, dictionary)}
              </option>
            ))
          ) : (
            <option value="">Kategori bulunamadı</option>
          )}
      </Select>

      <Select label="İlan tipi" name="listingType" defaultValue="sale" required>
          {listingTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {formatListingType(type.value, dictionary)}
            </option>
          ))}
      </Select>

      <TextInput
        label="Başlık"
        name="title"
        type="text"
        minLength={4}
        maxLength={160}
        required
        placeholder="Örn. temiz bebek arabası"
        wide
      />

      <Textarea
        label="Açıklama"
        name="description"
        maxLength={2000}
        rows={5}
        placeholder="Ürünün durumu, kullanım süresi, eksik parça ve teslim bilgisini yaz."
        wide
      />

      <TextInput
        label="Fiyat"
        name="priceAmount"
        type="text"
        inputMode="decimal"
        placeholder="6500.00"
      />

      <TextInput
        label="Para birimi"
        name="currency"
        type="text"
        defaultValue="TRY"
        maxLength={3}
        required
      />

      <Select label="Durum" name="condition" defaultValue="good" required>
          {conditions.map((conditionOption) => (
            <option key={conditionOption.value} value={conditionOption.value}>
              {formatListingCondition(conditionOption.value, dictionary)}
            </option>
          ))}
      </Select>

      <TextInput
        label="Şehir"
        name="city"
        type="text"
        maxLength={120}
        placeholder="Örn. İstanbul"
      />

    </div>
  );
}
