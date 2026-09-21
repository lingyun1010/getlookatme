import type { PlanId, Subscription, SubscriptionStatus } from './subscription.ts'

export type EntitlementId =
  | 'profile.publish'
  | 'cv.parse'
  | 'avatar.generate'
  | 'avatar.regenerate'
  | 'rag.query'
  | 'rag.extended'

export type Entitlement =
  | { enabled: boolean; limit: null }
  | { enabled: true; limit: number }

export type PlanEntitlements = Record<EntitlementId, Entitlement>

const enabled = { enabled: true, limit: null } as const
const disabled = { enabled: false, limit: null } as const
const limited = (limit: number): Entitlement => ({ enabled: true, limit })

export const ENTITLEMENTS: Record<PlanId, PlanEntitlements> = {
  free: {
    'profile.publish': enabled,
    'cv.parse': limited(5),
    'avatar.generate': limited(1),
    'avatar.regenerate': disabled,
    'rag.query': limited(20),
    'rag.extended': disabled,
  },
  pro: {
    'profile.publish': enabled,
    'cv.parse': limited(50),
    'avatar.generate': limited(10),
    'avatar.regenerate': limited(9),
    'rag.query': limited(500),
    'rag.extended': enabled,
  },
  founding: {
    'profile.publish': enabled,
    'cv.parse': limited(50),
    'avatar.generate': limited(25),
    'avatar.regenerate': limited(24),
    'rag.query': limited(1000),
    'rag.extended': enabled,
  },
}

const elevatedStatuses = new Set<SubscriptionStatus>(['active', 'trialing'])

export function effectivePlan(subscription: Pick<Subscription, 'plan' | 'status'>): PlanId {
  return subscription.plan !== 'free' && elevatedStatuses.has(subscription.status) ? subscription.plan : 'free'
}

export function getEntitlement(plan: PlanId, entitlementId: EntitlementId): Entitlement {
  return ENTITLEMENTS[plan][entitlementId]
}

export function getUsageLimit(plan: PlanId, entitlementId: EntitlementId): number | null {
  return getEntitlement(plan, entitlementId).limit
}

export function canUseFeature(plan: PlanId, entitlementId: EntitlementId, usage = 0): boolean {
  const entitlement = getEntitlement(plan, entitlementId)
  return entitlement.enabled && (entitlement.limit === null || usage < entitlement.limit)
}
