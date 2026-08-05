// Keep the previous page visible during product navigation.
// Product pages are statically generated + prefetched from listings, so this
// route usually hydrates instantly. Returning null avoids a jarring skeleton flash.
export default function Loading() {
  return null;
}
