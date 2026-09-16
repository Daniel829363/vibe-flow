/**
 * Utility to localize dynamic transaction descriptions & activity titles
 * across Russian and English locales.
 */
export function localizeTransactionDescription(description, type, t) {
  if (!t || typeof t !== "function") return description || "";

  if (!description) {
    if (type === "topup") return t("activity.topupDefault", {}, "Пополнение баланса");
    if (type === "deduction") return t("activity.deductionDefault", {}, "Списание баланса");
    if (type === "usage") return t("activity.usageDefault", {}, "Генерация");
    return t("activity.default", {}, "Операция с токенами");
  }

  const desc = String(description).trim();

  // 1. Run workflow: "Запуск процесса: <name>" / "Workflow run: <name>"
  const runMatch = desc.match(/^(?:Запуск процесса|Workflow run|Workflow Run):\s*(.+)$/i);
  if (runMatch) {
    return t("activity.runWorkflow", { name: runMatch[1] }, `Запуск процесса: ${runMatch[1]}`);
  }
  if (desc === "Запуск процесса" || desc.toLowerCase() === "workflow run") {
    return t("activity.runWorkflowDefault", {}, "Запуск процесса");
  }

  // 2. Generation in workflow: "Генерация (<node>) в процессе <workflow>" / "Generation (<node>) in workflow <workflow>"
  const genWfMatch = desc.match(/^(?:Генерация|Generation)\s*\(([^)]+)\)\s*(?:в процессе|in workflow)\s*(.+)$/i);
  if (genWfMatch) {
    return t(
      "activity.generationInWorkflow",
      { node: genWfMatch[1], workflow: genWfMatch[2] },
      `Генерация (${genWfMatch[1]}) в процессе ${genWfMatch[2]}`
    );
  }

  // 3. Node Generation only: "Генерация (<node>)" / "Generation (<node>)"
  const genNodeMatch = desc.match(/^(?:Генерация|Generation)\s*\(([^)]+)\)$/i);
  if (genNodeMatch) {
    return t("activity.generationNode", { node: genNodeMatch[1] }, `Генерация (${genNodeMatch[1]})`);
  }

  // 4. Admin top-up: "Пополнение баланса администратором" / "Пополнение администратором (<email>): <details>"
  if (
    desc === "Пополнение баланса администратором" ||
    desc.toLowerCase() === "balance top-up by administrator" ||
    desc.toLowerCase() === "top-up by administrator"
  ) {
    return t("activity.adminTopup", {}, "Пополнение баланса администратором");
  }
  const adminTopupMatch = desc.match(/^(?:Пополнение администратором|Admin top-up)\s*\(([^)]+)\)(?::\s*(.+))?$/i);
  if (adminTopupMatch) {
    const adminEmail = adminTopupMatch[1];
    const details = adminTopupMatch[2] ? `: ${adminTopupMatch[2]}` : "";
    return t(
      "activity.adminTopupWithDetails",
      { admin: adminEmail, details },
      `Пополнение администратором (${adminEmail})${details}`
    );
  }

  // 5. Admin deduction: "Списание баланса администратором" / "Списание администратором (<email>): <details>"
  if (
    desc === "Списание баланса администратором" ||
    desc.toLowerCase() === "balance deduction by administrator" ||
    desc.toLowerCase() === "deduction by administrator"
  ) {
    return t("activity.adminDeduction", {}, "Списание баланса администратором");
  }
  const adminDeductMatch = desc.match(/^(?:Списание администратором|Admin deduction)\s*\(([^)]+)\)(?::\s*(.+))?$/i);
  if (adminDeductMatch) {
    const adminEmail = adminDeductMatch[1];
    const details = adminDeductMatch[2] ? `: ${adminDeductMatch[2]}` : "";
    return t(
      "activity.adminDeductionWithDetails",
      { admin: adminEmail, details },
      `Списание администратором (${adminEmail})${details}`
    );
  }

  // 6. FINIK top-up: "Пополнение через FINIK: $X.XX (коэф. Y)"
  const finikMatch = desc.match(/^(?:Пополнение через|Top-up via)\s*FINIK:\s*(\$?[0-9.]+)\s*(?:\((?:коэф\.|coeff\.)\s*([0-9.]+)\))?/i);
  if (finikMatch) {
    const amount = finikMatch[1];
    const coeff = finikMatch[2];
    if (coeff) {
      return t("activity.finikTopupCoeff", { amount, coeff }, `Пополнение через FINIK: ${amount} (коэф. ${coeff})`);
    }
    return t("activity.finikTopup", { amount }, `Пополнение через FINIK: ${amount}`);
  }

  // 7. Promo code cashback: "Кешбек по промокоду: +X токенов"
  const cashbackMatch = desc.match(/^(?:Кешбек по промокоду|Promo code cashback):\s*\+?([0-9.]+)\s*(?:токенов|tokens)?/i);
  if (cashbackMatch) {
    return t("activity.promoCashback", { tokens: cashbackMatch[1] }, `Кешбек по промокоду: +${cashbackMatch[1]} токенов`);
  }

  // 8. Welcome bonus: "Стартовый баланс при создании аккаунта"
  if (
    desc.includes("Стартовый баланс") ||
    desc.toLowerCase().includes("welcome bonus") ||
    desc.toLowerCase().includes("initial balance")
  ) {
    return t("activity.welcomeBonus", {}, "Стартовый баланс при создании аккаунта");
  }

  // 9. Simple exact phrases
  if (desc === "Пополнение баланса" || desc.toLowerCase() === "balance top-up") {
    return t("activity.topupDefault", {}, "Пополнение баланса");
  }
  if (desc === "Списание баланса" || desc.toLowerCase() === "balance deduction") {
    return t("activity.deductionDefault", {}, "Списание баланса");
  }
  if (desc === "Операция с токенами" || desc.toLowerCase() === "token transaction") {
    return t("activity.default", {}, "Операция с токенами");
  }
  if (desc === "Генерация" || desc.toLowerCase() === "generation") {
    return t("activity.usageDefault", {}, "Генерация");
  }

  return desc;
}
