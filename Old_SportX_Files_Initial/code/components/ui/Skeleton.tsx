"use client";

/* Minimal shadcn-style Skeleton — a pulsing placeholder used in fetch
   loading states across the academy admin's --ax-* dark theme. */

import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  circle?: boolean;
}

export function Skeleton({ width, height, circle, style, ...rest }: SkeletonProps) {
  return (
    <div
      {...rest}
      style={{
        width: width ?? "100%",
        height: height ?? 12,
        background: "linear-gradient(90deg, var(--ax-field) 0%, var(--ax-bg-elevated) 50%, var(--ax-field) 100%)",
        backgroundSize: "200% 100%",
        borderRadius: circle ? "50%" : 8,
        animation: "sx-skeleton-pulse 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

export function SkeletonStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes sx-skeleton-pulse {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    ` }} />
  );
}
