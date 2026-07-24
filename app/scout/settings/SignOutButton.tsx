"use client";

import { signOut } from "next-auth/react";
import { DsButton } from "@/app/_ds";

export default function SignOutButton() {
  return (
    <DsButton
      variant="outline"
      style={{ borderColor: "rgba(248,113,113,0.4)", color: "#F87171" }}
      onClick={() => signOut({ callbackUrl: "/auth/login" })}
    >
      Sign out
    </DsButton>
  );
}
