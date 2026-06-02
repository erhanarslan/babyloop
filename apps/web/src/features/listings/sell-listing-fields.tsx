import { Select, Textarea, TextInput } from "../../components/ui";
import type { Category } from "../../lib/api";
import { conditions, listingTypes } from "./listing-form-options";

type SellListingFieldsProps = {
  categories: Category[];
};

export function SellListingFields({ categories }: SellListingFieldsProps) {
  const hasCategories = categories.length > 0;

  return (
    <div className="form-grid">
      <Select label="Category" name="categoryId" required disabled={!hasCategories}>
          {hasCategories ? (
            categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))
          ) : (
            <option value="">No categories available</option>
          )}
      </Select>

      <Select label="Listing type" name="listingType" defaultValue="sale" required>
          {listingTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
      </Select>

      <TextInput
        label="Title"
        name="title"
        type="text"
        minLength={4}
        maxLength={160}
        required
        placeholder="Stokke stroller in good condition"
        wide
      />

      <Textarea
        label="Description"
        name="description"
        maxLength={2000}
        rows={5}
        placeholder="Add condition notes, included pieces, and pickup details."
        wide
      />

      <TextInput
        label="Price amount"
        name="priceAmount"
        type="text"
        inputMode="decimal"
        placeholder="6500.00"
      />

      <TextInput label="Currency" name="currency" type="text" defaultValue="TRY" maxLength={3} required />

      <Select label="Condition" name="condition" defaultValue="good" required>
          {conditions.map((conditionOption) => (
            <option key={conditionOption.value} value={conditionOption.value}>
              {conditionOption.label}
            </option>
          ))}
      </Select>

      <Textarea
        label="Image URLs (temporary until upload is implemented)"
        name="imageUrls"
        rows={3}
        placeholder="https://example.com/stroller-front.jpg"
        wide
      />
      <p className="muted form-field-wide">
        Development-only bridge: production listings will use real photo upload with storage,
        file type checks, and size limits.
      </p>
    </div>
  );
}
