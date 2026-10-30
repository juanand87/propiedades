export const RETURNS_POLICY_SLUG = "politicas-de-cambios-y-devoluciones";

export type ReturnsPolicySettings = {
  version: number;
  additionalConditions: string;
  withdrawalReturnPaidBy: "buyer";
};

export const DEFAULT_RETURNS_POLICY: ReturnsPolicySettings = {
  version: 1,
  additionalConditions: "",
  withdrawalReturnPaidBy: "buyer",
};

export function getReturnsPolicySettings(policies: any): ReturnsPolicySettings {
  const saved = policies?.returnsPolicy;

  return {
    ...DEFAULT_RETURNS_POLICY,
    ...(saved && typeof saved === "object" ? saved : {}),
    additionalConditions:
      typeof saved?.additionalConditions === "string"
        ? saved.additionalConditions
        : "",
    withdrawalReturnPaidBy: "buyer",
  };
}
