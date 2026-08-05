// Render nothing during navigation.
//
// The homepage is `force-dynamic` and renders fully server-side, so a visible
// "Loading..." spinner just adds a jarring flash on every navigation. Returning
// null keeps the persistent layout (navbar, etc.) on screen while the new page
// content streams in, which feels smoother and avoids an empty white screen.
export default function Loading() {
  return null;
}
