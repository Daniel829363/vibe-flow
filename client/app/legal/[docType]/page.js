"use client";

import { useParams } from "next/navigation";
import LegalPage from "../page";

export default function DynamicLegalPage() {
  const params = useParams();
  const rawType = params?.docType || "user_agreement";

  const typeMap = {
    "user-agreement": "user_agreement",
    "user_agreement": "user_agreement",
    "agreement": "user_agreement",
    "privacy-policy": "privacy_policy",
    "privacy_policy": "privacy_policy",
    "privacy": "privacy_policy",
    "offer": "offer",
    "terms": "offer",
  };

  const resolvedType = typeMap[rawType] || rawType;

  return <LegalPage initialType={resolvedType} />;
}
