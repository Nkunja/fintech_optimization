-- CreateEnum
CREATE TYPE "MerchantStatusEnum" AS ENUM ('Active', 'Pending', 'Inactive', 'Suspended');

-- CreateEnum
CREATE TYPE "ReviewStatusEnum" AS ENUM ('Approved', 'Pending', 'Rejected');

-- CreateEnum
CREATE TYPE "CustomerTypeEnum" AS ENUM ('NonCustomer', 'New', 'Infrequent', 'Occasional', 'Regular', 'Vip');

-- CreateEnum
CREATE TYPE "OfferTypeEnum" AS ENUM ('CASHBACK', 'EXCLUSIVE', 'LOYALTY');

-- CreateEnum
CREATE TYPE "EligibilityEntityTypeEnum" AS ENUM ('CASHBACK_CONFIG', 'EXCLUSIVE_OFFER', 'LOYALTY_PROGRAM', 'CUSTOMER_TYPE', 'MERCHANT', 'OUTLET');

-- CreateEnum
CREATE TYPE "QueueStatusEnum" AS ENUM ('Pending', 'Processing', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "outlets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "merchantId" TEXT NOT NULL,
    "reviewId" TEXT,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "description" TEXT,
    "status" "MerchantStatusEnum" NOT NULL DEFAULT 'Pending',
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashback_configurations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "eligibleCustomerTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "merchantId" TEXT NOT NULL,
    "reviewId" TEXT,
    "netCashbackBudget" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "usedCashbackBudget" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eligibilityComputedAt" TIMESTAMP(3),

    CONSTRAINT "cashback_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashback_configuration_tiers" (
    "id" TEXT NOT NULL,
    "cashbackPercentage" DECIMAL(5,2) NOT NULL,
    "minTransactionAmount" DECIMAL(10,2),
    "maxTransactionAmount" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "cashbackConfigurationId" TEXT NOT NULL,
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashback_configuration_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exclusive_offers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "eligibleCustomerTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "merchantId" TEXT,
    "reviewId" TEXT,
    "netOfferBudget" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "usedOfferBudget" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eligibilityComputedAt" TIMESTAMP(3),

    CONSTRAINT "exclusive_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "merchantId" TEXT,
    "reviewId" TEXT,
    "pointsUsedInPeriod" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pointsIssuedLimit" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eligibilityComputedAt" TIMESTAMP(3),

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "minCustomerType" "CustomerTypeEnum" NOT NULL,
    "loyaltyProgramId" TEXT NOT NULL,
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_loyalty_rewards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "loyaltyProgramId" TEXT NOT NULL,
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_types" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" "CustomerTypeEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paybill_or_tills" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paybill_or_tills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "status" "ReviewStatusEnum" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_offer_eligibility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "offerType" "OfferTypeEnum" NOT NULL,
    "offerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "merchantCategory" TEXT,
    "merchantName" TEXT,
    "outletName" TEXT,
    "minPercentage" DECIMAL(5,2),
    "maxPercentage" DECIMAL(5,2),
    "hasBudgetRemaining" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_offer_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_computation_queue" (
    "id" TEXT NOT NULL,
    "entityType" "EligibilityEntityTypeEnum" NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "QueueStatusEnum" NOT NULL DEFAULT 'Pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eligibility_computation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_list_cache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_list_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_computation_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "recordsAffected" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eligibility_computation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CashbackConfigurationToOutlet" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ExclusiveOfferToOutlet" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "outlets_reviewId_key" ON "outlets"("reviewId");

-- CreateIndex
CREATE INDEX "outlets_merchantId_idx" ON "outlets"("merchantId");

-- CreateIndex
CREATE INDEX "outlets_isActive_idx" ON "outlets"("isActive");

-- CreateIndex
CREATE INDEX "outlets_reviewId_idx" ON "outlets"("reviewId");

-- CreateIndex
CREATE INDEX "merchants_status_idx" ON "merchants"("status");

-- CreateIndex
CREATE INDEX "merchants_category_idx" ON "merchants"("category");

-- CreateIndex
CREATE UNIQUE INDEX "cashback_configurations_reviewId_key" ON "cashback_configurations"("reviewId");

-- CreateIndex
CREATE INDEX "cashback_configurations_merchantId_idx" ON "cashback_configurations"("merchantId");

-- CreateIndex
CREATE INDEX "cashback_configurations_isActive_deletedAt_idx" ON "cashback_configurations"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "cashback_configurations_startDate_endDate_idx" ON "cashback_configurations"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "cashback_configurations_eligibilityComputedAt_idx" ON "cashback_configurations"("eligibilityComputedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cashback_configuration_tiers_reviewId_key" ON "cashback_configuration_tiers"("reviewId");

-- CreateIndex
CREATE INDEX "cashback_configuration_tiers_cashbackConfigurationId_idx" ON "cashback_configuration_tiers"("cashbackConfigurationId");

-- CreateIndex
CREATE INDEX "cashback_configuration_tiers_isActive_deletedAt_idx" ON "cashback_configuration_tiers"("isActive", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "exclusive_offers_reviewId_key" ON "exclusive_offers"("reviewId");

-- CreateIndex
CREATE INDEX "exclusive_offers_merchantId_idx" ON "exclusive_offers"("merchantId");

-- CreateIndex
CREATE INDEX "exclusive_offers_isActive_deletedAt_idx" ON "exclusive_offers"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "exclusive_offers_startDate_endDate_idx" ON "exclusive_offers"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "exclusive_offers_eligibilityComputedAt_idx" ON "exclusive_offers"("eligibilityComputedAt");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_merchantId_key" ON "loyalty_programs"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_reviewId_key" ON "loyalty_programs"("reviewId");

-- CreateIndex
CREATE INDEX "loyalty_programs_merchantId_idx" ON "loyalty_programs"("merchantId");

-- CreateIndex
CREATE INDEX "loyalty_programs_isActive_idx" ON "loyalty_programs"("isActive");

-- CreateIndex
CREATE INDEX "loyalty_programs_eligibilityComputedAt_idx" ON "loyalty_programs"("eligibilityComputedAt");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_tiers_reviewId_key" ON "loyalty_tiers"("reviewId");

-- CreateIndex
CREATE INDEX "loyalty_tiers_loyaltyProgramId_idx" ON "loyalty_tiers"("loyaltyProgramId");

-- CreateIndex
CREATE INDEX "loyalty_tiers_isActive_deletedAt_idx" ON "loyalty_tiers"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "loyalty_tiers_minCustomerType_idx" ON "loyalty_tiers"("minCustomerType");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_loyalty_rewards_reviewId_key" ON "merchant_loyalty_rewards"("reviewId");

-- CreateIndex
CREATE INDEX "merchant_loyalty_rewards_loyaltyProgramId_idx" ON "merchant_loyalty_rewards"("loyaltyProgramId");

-- CreateIndex
CREATE INDEX "merchant_loyalty_rewards_isActive_idx" ON "merchant_loyalty_rewards"("isActive");

-- CreateIndex
CREATE INDEX "customer_types_userId_idx" ON "customer_types"("userId");

-- CreateIndex
CREATE INDEX "customer_types_merchantId_idx" ON "customer_types"("merchantId");

-- CreateIndex
CREATE INDEX "customer_types_type_idx" ON "customer_types"("type");

-- CreateIndex
CREATE UNIQUE INDEX "customer_types_userId_merchantId_key" ON "customer_types"("userId", "merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "paybill_or_tills_reviewId_key" ON "paybill_or_tills"("reviewId");

-- CreateIndex
CREATE INDEX "paybill_or_tills_outletId_idx" ON "paybill_or_tills"("outletId");

-- CreateIndex
CREATE INDEX "paybill_or_tills_isActive_deletedAt_idx" ON "paybill_or_tills"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "user_offer_eligibility_userId_isActive_validUntil_idx" ON "user_offer_eligibility"("userId", "isActive", "validUntil");

-- CreateIndex
CREATE INDEX "user_offer_eligibility_userId_offerType_isActive_idx" ON "user_offer_eligibility"("userId", "offerType", "isActive");

-- CreateIndex
CREATE INDEX "user_offer_eligibility_outletId_isActive_idx" ON "user_offer_eligibility"("outletId", "isActive");

-- CreateIndex
CREATE INDEX "user_offer_eligibility_merchantId_isActive_idx" ON "user_offer_eligibility"("merchantId", "isActive");

-- CreateIndex
CREATE INDEX "user_offer_eligibility_merchantCategory_isActive_idx" ON "user_offer_eligibility"("merchantCategory", "isActive");

-- CreateIndex
CREATE INDEX "user_offer_eligibility_validFrom_validUntil_idx" ON "user_offer_eligibility"("validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "user_offer_eligibility_hasBudgetRemaining_isActive_idx" ON "user_offer_eligibility"("hasBudgetRemaining", "isActive");

-- CreateIndex
CREATE INDEX "user_offer_eligibility_computedAt_idx" ON "user_offer_eligibility"("computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_offer_eligibility_userId_outletId_offerType_offerId_key" ON "user_offer_eligibility"("userId", "outletId", "offerType", "offerId");

-- CreateIndex
CREATE INDEX "eligibility_computation_queue_status_priority_createdAt_idx" ON "eligibility_computation_queue"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "eligibility_computation_queue_entityType_entityId_idx" ON "eligibility_computation_queue"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "offer_list_cache_cacheKey_key" ON "offer_list_cache"("cacheKey");

-- CreateIndex
CREATE INDEX "offer_list_cache_expiresAt_idx" ON "offer_list_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "eligibility_computation_logs_createdAt_idx" ON "eligibility_computation_logs"("createdAt");

-- CreateIndex
CREATE INDEX "eligibility_computation_logs_entityType_entityId_idx" ON "eligibility_computation_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "_CashbackConfigurationToOutlet_AB_unique" ON "_CashbackConfigurationToOutlet"("A", "B");

-- CreateIndex
CREATE INDEX "_CashbackConfigurationToOutlet_B_index" ON "_CashbackConfigurationToOutlet"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ExclusiveOfferToOutlet_AB_unique" ON "_ExclusiveOfferToOutlet"("A", "B");

-- CreateIndex
CREATE INDEX "_ExclusiveOfferToOutlet_B_index" ON "_ExclusiveOfferToOutlet"("B");

-- AddForeignKey
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashback_configurations" ADD CONSTRAINT "cashback_configurations_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashback_configurations" ADD CONSTRAINT "cashback_configurations_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashback_configuration_tiers" ADD CONSTRAINT "cashback_configuration_tiers_cashbackConfigurationId_fkey" FOREIGN KEY ("cashbackConfigurationId") REFERENCES "cashback_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashback_configuration_tiers" ADD CONSTRAINT "cashback_configuration_tiers_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusive_offers" ADD CONSTRAINT "exclusive_offers_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusive_offers" ADD CONSTRAINT "exclusive_offers_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tiers" ADD CONSTRAINT "loyalty_tiers_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES "loyalty_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tiers" ADD CONSTRAINT "loyalty_tiers_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_loyalty_rewards" ADD CONSTRAINT "merchant_loyalty_rewards_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES "loyalty_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_loyalty_rewards" ADD CONSTRAINT "merchant_loyalty_rewards_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_types" ADD CONSTRAINT "customer_types_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paybill_or_tills" ADD CONSTRAINT "paybill_or_tills_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paybill_or_tills" ADD CONSTRAINT "paybill_or_tills_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_offer_eligibility" ADD CONSTRAINT "user_offer_eligibility_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CashbackConfigurationToOutlet" ADD CONSTRAINT "_CashbackConfigurationToOutlet_A_fkey" FOREIGN KEY ("A") REFERENCES "cashback_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CashbackConfigurationToOutlet" ADD CONSTRAINT "_CashbackConfigurationToOutlet_B_fkey" FOREIGN KEY ("B") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExclusiveOfferToOutlet" ADD CONSTRAINT "_ExclusiveOfferToOutlet_A_fkey" FOREIGN KEY ("A") REFERENCES "exclusive_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExclusiveOfferToOutlet" ADD CONSTRAINT "_ExclusiveOfferToOutlet_B_fkey" FOREIGN KEY ("B") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
