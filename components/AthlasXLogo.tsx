/**
 * Shared AthlasX wordmark — matches the cream-tile design.
 * Used in the landing hero and every dashboard sidebar so a future tweak
 * happens in one place.
 *
 * `size="sm"` fits the sidebar header (~28px). `size="md"` for the landing hero.
 */

interface Props {
  size?: "sm" | "md";
}

export default function AthlasXLogo({ size = "sm" }: Props) {
  const h = size === "sm" ? 28 : 40;
  const px = size === "sm" ? 12 : 18;
  const fs = size === "sm" ? 13.5 : 19;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: h,
        padding: `0 ${px}px`,
        borderRadius: 8,
        background: "linear-gradient(180deg, #E8DCC4, #D8C8A6)",
        color: "#1A1410",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        fontSize: fs,
        fontWeight: 800,
        letterSpacing: "-0.01em",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.35)",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      AthlasX
    </span>
  );
}
