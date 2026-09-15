import React from "react";
import MediaManagerClient from "./MediaManagerClient";

export const metadata = {
  title: "Медиа-менеджер | Workflow Pro",
  description: "Управление загруженными и сгенерированными медиа-материалами",
};

export default function MediaPage() {
  return <MediaManagerClient />;
}
