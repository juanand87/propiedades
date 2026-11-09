export const membershipPlans = {
  free: { properties: 1, videos: 10, name: 'Gratis' },
  basic: { properties: 10, videos: null, name: 'Básico' },
  pro: { properties: 50, videos: null, name: 'Pro' },
} as const;

export type MembershipPlan = keyof typeof membershipPlans;
