"use client";

/* Minimal shadcn-style Skeleton — a pulsing placeholder used in fetch
   loading states. Keeps the academy admin pages on the light theme so the
   shimmer reads as "loading" rather than dark-mode chrome. */

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
        background: "linear-gradient(90deg, #E2E8F0 0%, #F1F5F9 50%, #E2E8F0 100%)",
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
