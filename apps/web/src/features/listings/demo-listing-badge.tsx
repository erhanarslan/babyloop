export function DemoListingBadge({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;

  return (
    <span
      aria-label="Demo ilan"
      className="inline-flex items-center rounded-full border border-amber-700 bg-amber-50 px-2 py-1 text-xs font-black text-amber-950"
    >
      <span aria-hidden="true">◆&nbsp;</span>
      Demo ilan
    </span>
  );
}
