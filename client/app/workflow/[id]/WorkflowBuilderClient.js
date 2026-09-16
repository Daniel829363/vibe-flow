"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkflowBuilder, useTranslation } from "workflow-builder";
import { useAuth } from "../../lib/auth";

const WorkflowBuilderClient = ({ initialWorkflowData, initialNodeSchemas }) => {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const redirectId = initialWorkflowData?.workflow_id || "";
      const path = redirectId ? `/workflow/${redirectId}` : "/workflow";
      router.replace(`/auth/login?redirect=${encodeURIComponent(path)}`);
    }
  }, [isAuthenticated, authLoading, router, initialWorkflowData]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="h-dvh w-full flex flex-col items-center justify-center bg-[#030303]">
        <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
        <span className="mt-4 text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">
          {t("listing.checkingAccess", {}, "Проверка доступа...")}
        </span>
      </div>
    );
  }

  return (
    <WorkflowBuilder 
      initialWorkflowData={initialWorkflowData} 
      initialNodeSchemas={initialNodeSchemas} 
    />
  );
};

export default WorkflowBuilderClient;

