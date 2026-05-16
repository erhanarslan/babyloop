import type { Category } from "../../lib/api";
import { conditions, listingTypes } from "./listing-form-options";

type SellListingFieldsProps = {
  categories: Category[];
};

export function SellListingFields({ categories }: SellListingFieldsProps) {
  const hasCategories = categories.length > 0;

  return (
    <div className="form-grid">
      <label className="form-field">
        <span>Category</span>
        <select name="categoryId" required disabled={!hasCategories}>
          {hasCategories ? (
            categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))
          ) : (
            <option value="">No categories available</option>
          )}
        </select>
      </label>

      <label className="form-field">
        <span>Listing type</span>
        <select name="listingType" defaultValue="sale" required>
          {listingTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field form-field-wide">
        <span>Title</span>
        <input
          name="title"
          type="text"
          minLength={4}
          maxLength={160}
          required
          placeholder="Stokke stroller in good condition"
        />
      </label>

      <label className="form-field form-field-wide">
        <span>Description</span>
        <textarea
          name="description"
          maxLength={2000}
          rows={5}
          placeholder="Add condition notes, included pieces, and pickup details."
        />
      </label>

      <label className="form-field">
        <span>Price amount</span>
        <input name="priceAmount" type="text" inputMode="decimal" placeholder="6500.00" />
      </label>

      <label className="form-field">
        <span>Currency</span>
        <input name="currency" type="text" defaultValue="TRY" maxLength={3} required />
      </label>

      <label className="form-field">
        <span>Condition</span>
        <select name="condition" defaultValue="good" required>
          {conditions.map((conditionOption) => (
            <option key={conditionOption.value} value={conditionOption.value}>
              {conditionOption.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field form-field-wide">
        <span>Image URLs</span>
        <textarea
          name="imageUrls"
          rows={3}
          placeholder="https://example.com/stroller-front.jpg"
        />
      </label>
    </div>
  );
}

