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
      <Select label={dictionary.listings.category} name="categoryId" required disabled={!hasCategories}>
          {hasCategories ? (
            categories.map((category) => (
              <option key={category.id} value={category.id}>
                {formatCategoryName(category, dictionary)}
              </option>
            ))
          ) : (
            <option value="">{dictionary.listings.noCategoriesAvailable}</option>
          )}
      </Select>

      <Select label={dictionary.listings.listingType} name="listingType" defaultValue="sale" required>
          {listingTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {formatListingType(type.value, dictionary)}
            </option>
          ))}
      </Select>

      <TextInput
        label={dictionary.listings.title}
        name="title"
        type="text"
        minLength={4}
        maxLength={160}
        required
        placeholder={dictionary.listings.titlePlaceholder}
        wide
      />

      <Textarea
        label={dictionary.listings.description}
        name="description"
        maxLength={2000}
        rows={5}
        placeholder={dictionary.listings.descriptionPlaceholder}
        wide
      />

      <TextInput
        label={dictionary.listings.priceAmount}
        name="priceAmount"
        type="text"
        inputMode="decimal"
        placeholder="6500.00"
      />

      <TextInput
        label={dictionary.listings.currency}
        name="currency"
        type="text"
        defaultValue="TRY"
        maxLength={3}
        required
      />

      <Select label={dictionary.listings.condition} name="condition" defaultValue="good" required>
          {conditions.map((conditionOption) => (
            <option key={conditionOption.value} value={conditionOption.value}>
              {formatListingCondition(conditionOption.value, dictionary)}
            </option>
          ))}
      </Select>

      <Textarea
        label={dictionary.listings.imageUrls}
        name="imageUrls"
        rows={3}
        placeholder={dictionary.listings.imageUrlsPlaceholder}
        wide
      />
      <p className="muted form-field-wide">
        {dictionary.listings.imageUrlsHelp}
      </p>
    </div>
  );
}
