import React from "react";
import MediaManagerClient from "./MediaManagerClient";

export const metadata = {
  title: "Медиа-менеджер | VibeFlow",
  description: "Управление загруженными и сгенерированными медиа-материалами",
};

export default function MediaPage() {
  return <MediaManagerClient />;
}
