import { ENTITLEMENTS, type PlanEntitlements } from './entitlements.ts'
import type { PlanId } from './subscription.ts'

export interface PlanPrice {
  amount: number
  currency: 'AUD'
  interval: 'month'
}

export interface PlanConfig {
  id: PlanId
  name: string
  description: string
  ctaLabel: string
  publiclyListed: boolean
  price: PlanPrice | null
  highlights: string[]
  entitlements: PlanEntitlements
}

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Build, publish, and share a useful professional profile.',
    ctaLabel: 'Current plan',
    publiclyListed: true,
    price: { amount: 0, currency: 'AUD', interval: 'month' },
    highlights: ['CV-powered profile creation', 'Public profile publishing', '1 Avatar generation', '20 AI profile questions each month'],
    entitlements: ENTITLEMENTS.free,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Expand your Avatar and AI profile allowance.',
    ctaLabel: 'Upgrade to Pro',
    publiclyListed: true,
    price: { amount: 12, currency: 'AUD', interval: 'month' },
    highlights: ['Everything in Free', '10 Avatar generations each month', '500 AI profile questions each month', 'Extended AI profile usage'],
    entitlements: ENTITLEMENTS.pro,
  },
  founding: {
    id: 'founding',
    name: 'Founding',
    description: 'Elevated Beta access granted manually by the Get Look At Me team.',
    ctaLabel: 'Founding access',
    publiclyListed: false,
    price: null,
    highlights: ['Everything in Pro', 'Elevated Beta usage limits'],
    entitlements: ENTITLEMENTS.founding,
  },
}

export const PUBLIC_PLAN_IDS = (Object.keys(PLAN_CONFIG) as PlanId[])
  .filter((planId) => PLAN_CONFIG[planId].publiclyListed)

export function formatPlanPrice(plan: PlanConfig): string {
  if (!plan.price) return 'Not publicly available'
  if (plan.price.amount === 0) return '$0'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: plan.price.currency,
    maximumFractionDigits: 0,
  }).format(plan.price.amount)
}
