"use client";

import React from "react";

export interface StubContent {
  playerHeading: string;
  playerBody: React.ReactNode;
  systemHeading: string;
  systemBody: React.ReactNode;
}

export function PlayerPanel({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold" style={{ color: "#E2E8F0" }}>{heading}</h2>
      <div style={{ color: "#94A3B8" }}>{children}</div>
      <p className="text-xs" style={{ color: "#475569" }}>
        UI to be implemented. This stub registers the route so navigation works end-to-end.
      </p>
    </div>
  );
}

export function SystemPanel({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold" style={{ color: "#E2E8F0" }}>{heading}</h3>
      <div>{children}</div>
    </div>
  );
}
