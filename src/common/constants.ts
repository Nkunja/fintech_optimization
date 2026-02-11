import { CustomerTypeEnum } from '@prisma/client';


export const TEST_USER_IDS = [
  'user-dev-001',
  'user-dev-002',
  'user-dev-003',
  'user-dev-004',
  'user-dev-005',
] as const;


   // Customer type hierarchy mapping
  //Higher numbers = higher tier in the loyalty program

export const CUSTOMER_TYPE_HIERARCHY: Record<CustomerTypeEnum, number> = {
  [CustomerTypeEnum.NonCustomer]: 0,
  [CustomerTypeEnum.New]: 1,
  [CustomerTypeEnum.Infrequent]: 2,
  [CustomerTypeEnum.Occasional]: 3,
  [CustomerTypeEnum.Regular]: 4,
  [CustomerTypeEnum.Vip]: 5,
};


 // Get all customer types that are eligible for a given minimum tier
 // E.g., if minType is "Occasional", returns ["Occasional", "Regular", "Vip"]

export function getEligibleCustomerTypes(minType: CustomerTypeEnum): CustomerTypeEnum[] {
  const minLevel = CUSTOMER_TYPE_HIERARCHY[minType];
  return Object.entries(CUSTOMER_TYPE_HIERARCHY)
    .filter(([_, level]) => level >= minLevel)
    .map(([type, _]) => type as CustomerTypeEnum);
}


 // Check if a user's customer type meets the minimum requirement

export function meetsCustomerTypeRequirement(
  userType: CustomerTypeEnum,
  requiredType: CustomerTypeEnum,
): boolean {
  return CUSTOMER_TYPE_HIERARCHY[userType] >= CUSTOMER_TYPE_HIERARCHY[requiredType];
}


 // Special customer type values that can appear in eligibleCustomerTypes arrays

export const SPECIAL_CUSTOMER_TYPES = {
  ALL: 'All',
  NON_CUSTOMER: 'NonCustomer',
} as const;


 //Cache TTL configurations

export const CACHE_TTL = {
  OFFER_LIST: 300, // 5 minutes
  USER_ELIGIBILITY: 600, // 10 minutes
  MERCHANT_DATA: 1800, // 30 minutes
} as const;


 // Queue priorities

export const QUEUE_PRIORITY = {
  CRITICAL: 100, // Budget exhausted, offer expired
  HIGH: 75, // Offer activated/deactivated
  MEDIUM: 50, // Customer type changed
  LOW: 25, // Periodic recomputation
} as const;


 // Batch processing limits

export const BATCH_LIMITS = {
  USERS_PER_OFFER: 1000, // Max users to process per offer in one batch
  OFFERS_PER_USER: 100, // Max offers to process per user in one batch
  QUEUE_PROCESSING: 50, // Max queue items to process at once
} as const;


 // Feature flags for gradual rollout

export const FEATURE_FLAGS = {
  USE_MATERIALIZED_ELIGIBILITY: process.env.USE_MATERIALIZED_ELIGIBILITY === 'true',
  ENABLE_QUERY_CACHE: process.env.ENABLE_QUERY_CACHE !== 'false', // Default true
  ENABLE_BACKGROUND_JOBS: process.env.ENABLE_BACKGROUND_JOBS !== 'false', // Default true
} as const;


 // Percentage range filters

export enum CashbackPercentageFilters {
  UNDER_5 = 'UNDER_5',
  BETWEEN_5_10 = 'BETWEEN_5_10',
  ABOVE_10 = 'ABOVE_10',
}

export const PERCENTAGE_FILTER_RANGES: Record<
  CashbackPercentageFilters,
  { min?: number; max?: number }
> = {
  [CashbackPercentageFilters.UNDER_5]: { max: 5 },
  [CashbackPercentageFilters.BETWEEN_5_10]: { min: 5, max: 10 },
  [CashbackPercentageFilters.ABOVE_10]: { min: 10 },
};
