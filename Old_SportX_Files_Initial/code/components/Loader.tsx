/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

interface Props {
  /** Optional label shown next to / under the gif. */
  label?: string;
  /** Pixel size of the gif. */
  size?: number;
  /** Center the loader vertically inside the parent. */
  fullScreen?: boolean;
  /** Stack label below the gif instead of beside it. */
  stacked?: boolean;
}

/**
 * Cricket-themed loading indicator.
 *
 * Uses /loading.gif when present; falls back to a CSS spinner if the file
 * isn't deployed yet, so the UI never shows a broken-image icon.
 */
export default function Loader({
  label = "Loading",
  size = 56,
  fullScreen = false,
  stacked = true,
}: Props) {
  const [broken, setBroken] = useState(false);

  const inner = (
    <div
      className="flex items-center justify-center gap-3"
      style={{ flexDirection: stacked ? "column" : "row" }}
    >
      {!broken ? (
        <img
          src="/loading.gif"
          alt="Loading"
          width={size}
          height={size}
          style={{ width: size, height: size, imageRendering: "auto" }}
          onError={() => setBroken(true)}
        />
      ) : (
        <Spinner size={size} />
      )}
      {label ? (
        <span className="text-sm" style={{ color: "var(--muted)" }}>{label}</span>
      ) : null}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "60vh", width: "100%" }}
      >
        {inner}
      </div>
    );
  }
  return inner;
}

function Spinner({ size }: { size: number }) {
  const border = Math.max(2, Math.round(size / 14));
  return (
    <>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `${border}px solid var(--border)`,
          borderTopColor: "var(--accent)",
          animation: "sxspin 0.9s linear infinite",
        }}
      />
      <style>{`@keyframes sxspin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
