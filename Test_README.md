TEST: 

# Take-Home Task: Offers Resolver Performance Optimization

## Overview

You are working on a platform that connects users with merchants and their offers. The platform has three types of offers:

1. **Cashback Configurations** - Cashback percentages users can earn on purchases
2. **Exclusive Offers** - Special time-bound promotions
3. **Loyalty Programs** - Points-based reward systems

## Technology Stack

**You must use the following technologies for your implementation:**

- **Prisma** - ORM and database schema management
- **PostgreSQL** - Database
- **GraphQL** - API layer
- **TypeScript** - Programming language

You may also use:

- Redis (for caching if needed)
- BullMQ/Node-cron (for background jobs if needed)
- Any other supporting libraries that fit within this stack

## The Problem

Our primary `offers` GraphQL resolver is facing critical performance challenges. This endpoint is **hit constantly** by our mobile and web applications to display available offers to users.

### Current Implementation

The resolver builds a complex Prisma `where` clause at query time that checks multiple conditions across various related models to determine offer eligibility. Here's the current flow:

**1. User Eligibility Determination**

First, we fetch the user's customer types (their relationship with merchants) and build complex OR-filter arrays for each offer type:

```typescript
const offerEligibilityConditions = await buildOfferEligibilityConditions({
  prisma,
  authSession,
})
```

The `buildOfferEligibilityConditions` function:

- Fetches all `CustomerType` records for the authenticated user (a user can have different types with different merchants)
- Constructs base OR filters that include:
  - Offers where `eligibleCustomerTypes` contains "All"
  - Offers where `eligibleCustomerTypes` contains "NonCustomer" AND the merchantId is NOT in the user's merchant list
- For **Cashback Configurations**: Builds an OR array of `{ merchantId, eligibleCustomerTypes: { has: type } }` for each of the user's customer types
- For **Exclusive Offers**: Same as Cashback (based on `merchantId` + `eligibleCustomerTypes`)
- For **Loyalty Programs**: Builds an OR array based on customer type hierarchy (e.g., a "Regular" customer is eligible for tiers that accept "New", "Infrequent", "Occasional", and "Regular")

**2. Complex Filter Construction**

The `buildOfferFilters` function constructs a where clause with:

```typescript
export const buildOfferFilters = ({
  now,
  search,
  category,
  percentage,
  cashbackEligibility,
  exclusiveOfferEligibility,
  loyaltyProgramEligibility,
}: BuildOfferFiltersArgs): Prisma.OutletWhereInput => ({
  isActive: true,
  Review: { status: ReviewStatusEnum.Approved },
  Merchant: {
    status: MerchantStatusEnum.Active,
    ...(category && { category }),
    ...(search && createSearchFilters<Merchant>(search, ['businessName', 'description'])),
  },
  PaybillOrTills: {
    some: { isActive: true, deletedAt: null, Review: { status: ReviewStatusEnum.Approved } },
  },
  ...(search && createSearchFilters<Outlet>(search, ['name', 'description'])),
  OR: [
    // Cashback offers with nested conditions
    {
      CashbackConfigurations: {
        some: buildCashbackConditions(now, percentage, cashbackEligibility),
      },
    },
    // Exclusive offers with nested conditions
    {
      ExclusiveOffers: {
        some: buildExclusiveOfferConditions(now, exclusiveOfferEligibility),
      },
    },
    // Loyalty programs with nested conditions
    {
      Merchant: {
        LoyaltyProgram: {
          ...buildLoyaltyConditions(loyaltyProgramEligibility),
        },
      },
    },
  ],
})
```

**3. Individual Condition Builders**

Each offer type has its own complex condition builder:

```typescript
// Cashback Conditions
const buildCashbackConditions = (
  now: Date,
  percentage: CashbackPercentageFilters | null | undefined,
  eligibilityConditions: NonNullable<Prisma.CashbackConfigurationWhereInput['OR']>
): Prisma.CashbackConfigurationWhereInput => ({
  isActive: true,
  deletedAt: null,
  usedCashbackBudget: { lt: prisma.cashbackConfiguration.fields.netCashbackBudget },
  Review: { status: ReviewStatusEnum.Approved },
  AND: [
    {
      OR: [
        { AND: [{ startDate: null }, { endDate: null }] },
        { AND: [{ startDate: { lte: now } }, { endDate: { gte: now } }] },
      ],
    },
    { OR: eligibilityConditions },
  ],
  CashbackConfigurationTiers: {
    some: {
      deletedAt: null,
      isActive: true,
      Review: { status: ReviewStatusEnum.Approved },
      ...(percentage && buildPercentageFilters(percentage)),
    },
  },
})

// Exclusive Offer Conditions
const buildExclusiveOfferConditions = (
  now: Date,
  eligibilityConditions: NonNullable<Prisma.ExclusiveOfferWhereInput['OR']>
): Prisma.ExclusiveOfferWhereInput => ({
  isActive: true,
  startDate: { lte: now },
  endDate: { gte: now },
  usedOfferBudget: { lt: prisma.exclusiveOffer.fields.netOfferBudget },
  OR: eligibilityConditions,
  Review: { status: ReviewStatusEnum.Approved },
})

// Loyalty Program Conditions
const buildLoyaltyConditions = (
  eligibilityConditions: NonNullable<Prisma.LoyaltyProgramWhereInput['OR']>
): Prisma.LoyaltyProgramWhereInput => ({
  isActive: true,
  OR: eligibilityConditions,
  pointsUsedInPeriod: { lt: prisma.loyaltyProgram.fields.pointsIssuedLimit },
  Review: { status: ReviewStatusEnum.Approved },
  LoyaltyTiers: {
    some: { isActive: true, deletedAt: null, Review: { status: ReviewStatusEnum.Approved } },
  },
  MerchantLoyaltyRewards: {
    some: { isActive: true, Review: { status: ReviewStatusEnum.Approved } },
  },
})
```

The resulting filter checks:

- Multiple offer types (Cashback, Exclusive, Loyalty) in a top-level OR
- Each offer type has its own nested `some` clause
- Inside each: `isActive`, `deletedAt`, date ranges, review status, budget usage
- Large OR blocks for `eligibleCustomerTypes` mapped to `merchantId`
- Customer type hierarchy for loyalty programs

**This query does not scale.** Even with database indexing, the complexity of the OR conditions across multiple joined tables creates a significant performance bottleneck.

### Current Data Models

Here are the relevant models (simplified to show only relevant fields):

```prisma
// Outlet represents a physical location
model Outlet {
  id                      String                    @id
  name                    String
  description             String?
  isActive                Boolean
  merchantId              String
  Merchant                Merchant                  @relation(fields: [merchantId], references: [id])
  PaybillOrTills          PaybillOrTill[]
  CashbackConfigurations  CashbackConfiguration[]   // Many-to-many
  ExclusiveOffers         ExclusiveOffer[]          // Many-to-many
  Review                  Review?                   @relation(fields: [reviewId], references: [id])
  reviewId                String?                   @unique
}

// Merchant represents a business
model Merchant {
  id                      String                    @id
  businessName            String
  status                  String                    // e.g., "Active", "Pending"
  category                String
  LoyaltyProgram          LoyaltyProgram?           // One-to-one
  CashbackConfigurations  CashbackConfiguration[]
  ExclusiveOffers         ExclusiveOffer[]
  Outlets                 Outlet[]
}

// Cashback Configuration
model CashbackConfiguration {
  id                    String    @id
  name                  String
  startDate             DateTime?
  endDate               DateTime?
  isActive              Boolean   @default(true)
  deletedAt             DateTime?
  eligibleCustomerTypes String[]  // e.g., ["All"], ["VIP", "Regular"]
  merchantId            String
  Merchant              Merchant  @relation(fields: [merchantId], references: [id])
  Outlets               Outlet[]  // Many-to-many
  Review                Review?   @relation(fields: [reviewId], references: [id])
  reviewId              String?   @unique
  // Budget tracking
  netCashbackBudget     Decimal   @default(0.0)
  usedCashbackBudget    Decimal   @default(0.0)
  CashbackConfigurationTiers CashbackConfigurationTier[]
}

// Exclusive Offer
model ExclusiveOffer {
  id                    String    @id
  name                  String
  description           String
  startDate             DateTime
  endDate               DateTime
  isActive              Boolean   @default(true)
  deletedAt             DateTime?
  eligibleCustomerTypes String[]  // e.g., ["New", "Infrequent"]
  merchantId            String?
  Merchant              Merchant? @relation(fields: [merchantId], references: [id])
  Outlets               Outlet[]  // Many-to-many
  Review                Review?   @relation(fields: [reviewId], references: [id])
  reviewId              String?   @unique
  // Budget tracking
  netOfferBudget        Decimal   @default(0.0)
  usedOfferBudget       Decimal   @default(0.0)
}

// Loyalty Program
model LoyaltyProgram {
  id                    String              @id
  name                  String
  isActive              Boolean             @default(true)
  merchantId            String?             @unique
  Merchant              Merchant?           @relation(fields: [merchantId], references: [id])
  LoyaltyTiers          LoyaltyTier[]
  MerchantLoyaltyRewards MerchantLoyaltyReward[]
  Review                Review?             @relation(fields: [reviewId], references: [id])
  reviewId              String?             @unique
  // Limits
  pointsUsedInPeriod    Decimal             @default(0)
  pointsIssuedLimit     Decimal?
}

// Loyalty Tier
model LoyaltyTier {
  id              String         @id
  name            String
  isActive        Boolean        @default(true)
  deletedAt       DateTime?
  minCustomerType String         // e.g., "New", "Regular", "VIP"
  loyaltyProgramId String
  LoyaltyProgram  LoyaltyProgram @relation(fields: [loyaltyProgramId], references: [id])
  Review          Review?        @relation(fields: [reviewId], references: [id])
  reviewId        String?        @unique
}

// CustomerType tracks user's relationship with merchants
model CustomerType {
  id          String   @id
  userId      String
  merchantId  String
  type        String   // e.g., "New", "Regular", "VIP"
  Merchant    Merchant @relation(fields: [merchantId], references: [id])
}

// Review model
model Review {
  id          String   @id
  status      String   // "Approved", "Pending", "Rejected"
}
```

### Customer Type Hierarchy

Customer types follow a hierarchy (from lowest to highest):

```typescript
const ORDERED_CUSTOMER_TYPES = {
  NonCustomer: 0,
  New: 1,
  Infrequent: 2,
  Occasional: 3,
  Regular: 4,
  Vip: 5,
}
```

For loyalty programs, a user with a higher customer type is eligible for all tiers at their level and below (e.g., a "Regular" customer can access tiers that accept "New", "Infrequent", "Occasional", and "Regular").

### Eligibility Logic

A user can have different customer types with different merchants (e.g., "VIP" at one merchant, "Regular" at another). The eligibility conditions must:

1. **Cashback Configurations**: Match based on `merchantId` + `eligibleCustomerTypes` array containing the user's type (or "All")
2. **Exclusive Offers**: Same as Cashback (based on `merchantId` + `eligibleCustomerTypes`)
3. **Loyalty Programs**: Match based on `merchantId` + tier eligibility based on customer type hierarchy

### The Challenge

**This endpoint will be hit constantly.** Every user opening the app triggers this query. The current implementation:

- Builds dynamic OR conditions across 3 different offer types
- Checks array membership (`eligibleCustomerTypes`) in those OR conditions
- Validates date ranges, budget limits, review status, and deletion status
- All happens at query time, for every request

This creates a complex, deeply nested query that doesn't scale with:

- Growing number of outlets
- Growing number of offers
- Growing number of users

## Your Task

Refactor the `offers` resolver to improve its performance. You must:

1. **Analyze the current implementation** in:

   - `apps/api/graphql/resolvers/user/offers.ts`
   - `apps/api/graphql/resolvers/user/helpers/offers/filters.ts`

2. **Design and implement a solution** that:

   - Significantly improves query performance
   - Maintains correct eligibility logic (all the business rules must still work)
   - Works within our tech stack (Prisma, PostgreSQL, GraphQL, TypeScript)
   - Is maintainable and doesn't introduce excessive complexity

3. **Consider the following constraints**:
   - The solution must handle real-time offer availability (when an offer is deactivated, it should disappear)
   - Date ranges must still be respected (startDate/endDate)
   - Budget tracking must still work (don't show offers that have exceeded their budget)
   - Customer type eligibility must remain accurate
   - The GraphQL schema and response format should remain the same (or be backward compatible)

## Hint

Consider where the complexity lies in the current query. Think about what computations could be done ahead of time (when data changes) versus at query time, and how that might affect your data model, whether that's denormalization, caching, materialized views, new db models, or another approach.

## What to Submit

1. **Your implementation** - All code changes (new files, modified files)
2. **Any database migrations** required
3. **Tests** for your implementation (if applicable)

## Evaluation Criteria

- **Performance**: Does it actually solve the scalability problem?
- **Correctness**: Do all eligibility rules still work correctly?
- **Maintainability**: Is the code clean and well-structured?
- **Trade-offs**: Did you thoughtfully consider the trade-offs of your approach?

Good luck!

## Time Estimate & Deadline

We estimate this task will take approximately **12-20 hours**. You have **one week** to complete it.

Focus on demonstrating your approach rather than perfecting every edge case.

**Submission:** Email your implementation to careers@fusionlabs.africa. We'll schedule a follow-up meeting where you'll present your solution and answer questions about your implementation.
