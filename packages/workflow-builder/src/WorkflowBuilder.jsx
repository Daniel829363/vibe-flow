"use client"

import React from "react";
import { ReactFlowProvider } from "reactflow";
import NodeFlow from "./components/NodeFlow";
import { I18nProvider } from "./i18n";

export default function Home({ initialNodeSchemas, initialWorkflowData }) {
  return (
    <I18nProvider>
      <div className="flex flex-col items-center justify-center h-screen w-full">
        <ReactFlowProvider>
          <NodeFlow 
            initialNodeSchemas={initialNodeSchemas} 
            initialWorkflowData={initialWorkflowData} 
          />
        </ReactFlowProvider>
      </div>
    </I18nProvider>
  );
}
