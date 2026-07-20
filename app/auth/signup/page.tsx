import { Suspense } from "react";
import { Component } from "@/components/ui/sign-in-flo";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <Suspense>
      <Component initialMode="signup" />
    </Suspense>
  );
}
