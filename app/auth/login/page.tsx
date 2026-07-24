import { Suspense } from "react";
import { Component } from "@/components/ui/sign-in-flo";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense>
      <Component initialMode="signin" />
    </Suspense>
  );
}
