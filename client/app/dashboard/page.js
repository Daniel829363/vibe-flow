import React from "react";
import DashboardClient from "./DashboardClient";

export const metadata = {
  title: "Аналитика и Статистика | VibeFlow",
  description:
    "Комплексный аналитический дашборд использования AI-моделей, рабочих процессов, расхода токенов и сгенерированного медиа-контента.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
