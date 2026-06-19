/**
 * Reusable background snippets. The default light Component is the verbatim
 * copy of the source. ComponentDark is the same idea adapted for the dark
 * AthlasX dashboard (white-on-black grid + violet glow).
 *
 * Drop either component inside a relatively-positioned wrapper:
 *
 *   <div className="relative min-h-screen">
 *     <ComponentDark />
 *     <main>… content …</main>
 *   </div>
 */

export const Component = () => {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
      <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_100%_200px,#d5c5ff,transparent)]"></div>
    </div>
  );
};

/**
 * Dark variant — same grid + glow concept tuned for dark dashboards.
 * Black base, very faint white grid (1px every 6rem × 4rem), large violet
 * radial glow anchored top-right.
 */
export const ComponentDark = () => {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-black bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:6rem_4rem]">
      <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_900px_at_100%_200px,rgba(139,92,246,0.28),transparent)]"></div>
    </div>
  );
};

export default Component;
