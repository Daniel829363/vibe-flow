"use client";

import React from "react";
import { Toaster } from "react-hot-toast";
import { I18nProvider } from "workflow-builder";
import { AuthProvider } from "./lib/auth";
import EmailVerificationGuard from "./lib/EmailVerificationGuard";

export default function Providers({ children }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <EmailVerificationGuard>
          {children}
        </EmailVerificationGuard>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#121214",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: "500",
            },
          }}
        />
      </AuthProvider>
    </I18nProvider>
  );
}

