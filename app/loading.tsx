// Intentionally minimal — avoids React streaming issues on Render.
// The home page uses force-dynamic and renders fully server-side.
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-400">Loading...</div>
    </div>
  );
}
