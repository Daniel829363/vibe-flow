"use client";

import React, { use } from "react";
import TermsPage from "../page";

export default function DynamicTermsPage({ params }) {
  // In Next.js 15+, params is a Promise
  const resolvedParams = typeof params?.then === "function" ? use(params) : params;
  const lang = resolvedParams?.lang || "ru";

  return <TermsPage initialLang={lang} />;
}
