"use client";

import React from "react";
import { useAuth } from "./auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

// Paths that should NOT trigger verification redirect
const EXEMPT_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/verify-email",
  "/auth/email-confirmation",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/google-callback",
];

/**
 * Wraps children and redirects unverified users to the email confirmation page
 * when REQUIRE_EMAIL_VERIFICATION is enabled on the server.
 */
export default function EmailVerificationGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !user) return;

    // Don't redirect if on an exempt path
    const isExempt = EXEMPT_PATHS.some((p) => pathname.startsWith(p));
    if (isExempt) return;

    // Check if verification is required and user is unverified
    if (user.require_email_verification && !user.is_email_verified) {
      router.replace("/auth/email-confirmation");
    }
  }, [user, loading, pathname, router]);

  return <>{children}</>;
}
