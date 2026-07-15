// Product detail skeleton.
//
// This segment previously fell back to the product *listing* skeleton
// (app/products/loading.tsx), which briefly flashed a filters + grid layout
// when opening a product — jarring and slow-feeling. This route-level skeleton
// mirrors the real product detail layout (gallery + buy box), so navigation
// gives instant, correct visual feedback while the server renders.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-muted" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 w-16 flex-shrink-0 animate-pulse rounded-lg bg-muted md:h-20 md:w-20"
              />
            ))}
          </div>
        </div>

        {/* Buy box */}
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="h-8 w-4/5 animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </div>

          {/* Price */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 w-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>

          {/* Quantity + buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="h-12 w-full animate-pulse rounded-xl bg-muted sm:w-32" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>

      {/* Description / details */}
      <div className="mt-10 space-y-4">
        <div className="flex gap-4">
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Related products */}
      <div className="mt-12 space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border">
              <div className="aspect-square w-full animate-pulse bg-muted" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
