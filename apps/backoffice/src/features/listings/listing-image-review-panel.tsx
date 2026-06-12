import type { AdminListingImage } from "./api";

type ListingImageReviewPanelProps = {
  images: AdminListingImage[];
};

export function ListingImageReviewPanel({ images }: ListingImageReviewPanelProps) {
  return (
    <section className="form-card">
      <div>
        <p className="eyebrow">Images</p>
        <h3>Image review foundation</h3>
        <p>
          Listing images are read-only in this MVP. Image approve/reject states
          remain deferred until the schema supports them.
        </p>
      </div>

      {images.length === 0 ? (
        <div className="state-panel">This listing has no uploaded images.</div>
      ) : (
        <div className="image-review-grid">
          {images.map((image) => (
            <article className="image-review-card" key={image.id}>
              <img alt="" src={image.url} />
              <dl className="compact-details">
                <div>
                  <dt>Sort order</dt>
                  <dd>{image.sortOrder}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(image.createdAt)}</dd>
                </div>
                <div className="full-field">
                  <dt>Image ID</dt>
                  <dd>{image.id}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}
