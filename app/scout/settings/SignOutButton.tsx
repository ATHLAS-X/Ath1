"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      className="btn"
      style={{ borderColor: "rgba(248,113,113,0.4)", color: "#F87171" }}
      onClick={() => signOut({ callbackUrl: "/auth/login" })}
    >
      Sign out
    </button>
  );
}
