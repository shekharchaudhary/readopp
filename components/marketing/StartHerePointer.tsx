/**
 * Small hand-drawn "start here" pointer that floats off the upper-right
 * corner of the URL input card. Same "marker on napkin" energy as the
 * bottom-page CTA arrow, scaled down. Hidden on mobile since the form
 * is already the first thing in view there — the pointer only earns
 * its keep on wide screens where the form competes with the hero post
 * mockup for attention.
 */
export function StartHerePointer() {
  return (
    <div
      aria-hidden
      // Positioned absolutely against the parent (the form card needs
      // position: relative). On md+ it floats just outside the card's
      // top-right corner so the arrow lands on the URL input row.
      className="pointer-events-none absolute -right-2 -top-10 hidden select-none md:flex md:items-end md:gap-1 lg:-right-6 lg:-top-12"
    >
      <span
        className="-rotate-[8deg] whitespace-nowrap font-medium text-ink"
        // Inline style keeps us off the tailwind font-family treadmill —
        // we want a handwritten feel even if the project hasn't loaded
        // a script font.
        style={{
          fontFamily:
            "'Caveat', 'Reenie Beanie', 'Bradley Hand', 'Comic Sans MS', cursive",
          fontSize: 26,
          lineHeight: 1,
          letterSpacing: "0.01em",
        }}
      >
        start here
      </span>
      <Squiggle />
    </div>
  );
}

function Squiggle() {
  return (
    <svg
      viewBox="0 0 90 80"
      className="h-16 w-20 text-ink"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* A short squiggle that loops once then dives down-left toward
          the URL input. Drawn as a single Bézier so the arrow reads as
          hand-drawn, not vector-perfect. */}
      <path d="M82 10 C 70 6, 58 22, 70 30 C 82 38, 60 52, 38 60" />
      {/* Arrowhead on the down-left end */}
      <path d="M48 56 L 34 64 L 42 50" />
    </svg>
  );
}
