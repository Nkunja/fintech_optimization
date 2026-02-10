import { Test, TestingModule } from '@nestjs/testing';
import { EligibilityComputationService } from './eligibility-computation.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerTypeEnum,
  ReviewStatusEnum,
  MerchantStatusEnum,
  OfferTypeEnum,
} from '@prisma/client';

describe('EligibilityComputationService', () => {
  let service: EligibilityComputationService;
  let prisma: PrismaService;

  const mockPrisma = {
    cashbackConfiguration: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    exclusiveOffer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    loyaltyProgram: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userOfferEligibility: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    customerType: {
      findMany: jest.fn(),
    },
    eligibilityComputationLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EligibilityComputationService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<EligibilityComputationService>(EligibilityComputationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('computeCashbackEligibility', () => {
    it('should compute eligibility for a valid cashback configuration', async () => {
      const mockConfig = {
        id: 'cashback-1',
        merchantId: 'merchant-1',
        isActive: true,
        deletedAt: null,
        eligibleCustomerTypes: ['Regular', 'Vip'],
        usedCashbackBudget: 100,
        netCashbackBudget: 1000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        Merchant: {
          id: 'merchant-1',
          businessName: 'Test Merchant',
          category: 'Food',
          status: MerchantStatusEnum.Active,
        },
        Review: {
          status: ReviewStatusEnum.Approved,
        },
        Outlets: [
          {
            id: 'outlet-1',
            name: 'Test Outlet',
            isActive: true,
            Review: { status: ReviewStatusEnum.Approved },
          },
        ],
        CashbackConfigurationTiers: [
          {
            id: 'tier-1',
            cashbackPercentage: 5,
            isActive: true,
            deletedAt: null,
            Review: { status: ReviewStatusEnum.Approved },
          },
        ],
      };

      const mockCustomers = [
        { userId: 'user-1' },
        { userId: 'user-2' },
      ];

      mockPrisma.cashbackConfiguration.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.customerType.findMany.mockResolvedValue(mockCustomers);
      mockPrisma.userOfferEligibility.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.userOfferEligibility.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.cashbackConfiguration.update.mockResolvedValue(mockConfig);
      mockPrisma.eligibilityComputationLog.create.mockResolvedValue({});

      const result = await service.computeCashbackEligibility('cashback-1');

      expect(result).toBe(2);
      expect(mockPrisma.userOfferEligibility.createMany).toHaveBeenCalled();
      expect(mockPrisma.cashbackConfiguration.update).toHaveBeenCalledWith({
        where: { id: 'cashback-1' },
        data: { eligibilityComputedAt: expect.any(Date) },
      });
    });

    it('should handle "All" customer type', async () => {
      const mockConfig = {
        id: 'cashback-2',
        merchantId: 'merchant-1',
        isActive: true,
        deletedAt: null,
        eligibleCustomerTypes: ['All'],
        usedCashbackBudget: 100,
        netCashbackBudget: 1000,
        Merchant: {
          id: 'merchant-1',
          businessName: 'Test Merchant',
          category: 'Food',
          status: MerchantStatusEnum.Active,
        },
        Review: { status: ReviewStatusEnum.Approved },
        Outlets: [
          {
            id: 'outlet-1',
            name: 'Test Outlet',
            isActive: true,
            Review: { status: ReviewStatusEnum.Approved },
          },
        ],
        CashbackConfigurationTiers: [
          {
            id: 'tier-1',
            cashbackPercentage: 5,
            isActive: true,
            deletedAt: null,
            Review: { status: ReviewStatusEnum.Approved },
          },
        ],
      };

      const allUsers = [
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ];

      mockPrisma.cashbackConfiguration.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.customerType.findMany.mockResolvedValue(allUsers);
      mockPrisma.userOfferEligibility.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.userOfferEligibility.createMany.mockResolvedValue({ count: 3 });
      mockPrisma.cashbackConfiguration.update.mockResolvedValue(mockConfig);
      mockPrisma.eligibilityComputationLog.create.mockResolvedValue({});

      const result = await service.computeCashbackEligibility('cashback-2');

      expect(result).toBe(3);
    });

    it('should skip inactive or deleted configs', async () => {
      const mockConfig = {
        id: 'cashback-3',
        isActive: false,
        deletedAt: new Date(),
      };

      mockPrisma.cashbackConfiguration.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.userOfferEligibility.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.computeCashbackEligibility('cashback-3');

      expect(result).toBe(0);
      expect(mockPrisma.userOfferEligibility.updateMany).toHaveBeenCalledWith({
        where: {
          offerType: OfferTypeEnum.CASHBACK,
          offerId: 'cashback-3',
        },
        data: {
          isActive: false,
        },
      });
    });

    it('should skip configs with exhausted budget', async () => {
      const mockConfig = {
        id: 'cashback-4',
        isActive: true,
        deletedAt: null,
        usedCashbackBudget: 1000,
        netCashbackBudget: 1000, // Budget exhausted
        Merchant: { status: MerchantStatusEnum.Active },
        Review: { status: ReviewStatusEnum.Approved },
        Outlets: [],
        CashbackConfigurationTiers: [],
      };

      mockPrisma.cashbackConfiguration.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.userOfferEligibility.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.computeCashbackEligibility('cashback-4');

      expect(result).toBe(0);
    });
  });

  describe('computeExclusiveOfferEligibility', () => {
    it('should compute eligibility for a valid exclusive offer', async () => {
      const now = new Date();
      const mockOffer = {
        id: 'offer-1',
        merchantId: 'merchant-1',
        isActive: true,
        deletedAt: null,
        eligibleCustomerTypes: ['New', 'Infrequent'],
        startDate: new Date(now.getTime() - 86400000), // Yesterday
        endDate: new Date(now.getTime() + 86400000), // Tomorrow
        usedOfferBudget: 100,
        netOfferBudget: 1000,
        Merchant: {
          id: 'merchant-1',
          businessName: 'Test Merchant',
          category: 'Food',
          status: MerchantStatusEnum.Active,
        },
        Review: { status: ReviewStatusEnum.Approved },
        Outlets: [
          {
            id: 'outlet-1',
            name: 'Test Outlet',
            isActive: true,
            Review: { status: ReviewStatusEnum.Approved },
          },
        ],
      };

      const mockCustomers = [{ userId: 'user-1' }];

      mockPrisma.exclusiveOffer.findUnique.mockResolvedValue(mockOffer);
      mockPrisma.customerType.findMany.mockResolvedValue(mockCustomers);
      mockPrisma.userOfferEligibility.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.userOfferEligibility.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.exclusiveOffer.update.mockResolvedValue(mockOffer);
      mockPrisma.eligibilityComputationLog.create.mockResolvedValue({});

      const result = await service.computeExclusiveOfferEligibility('offer-1');

      expect(result).toBe(1);
    });

    it('should skip expired offers', async () => {
      const mockOffer = {
        id: 'offer-2',
        isActive: true,
        deletedAt: null,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2020-12-31'), // Expired
        usedOfferBudget: 100,
        netOfferBudget: 1000,
        Merchant: { status: MerchantStatusEnum.Active },
        Review: { status: ReviewStatusEnum.Approved },
        Outlets: [],
      };

      mockPrisma.exclusiveOffer.findUnique.mockResolvedValue(mockOffer);
      mockPrisma.userOfferEligibility.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.computeExclusiveOfferEligibility('offer-2');

      expect(result).toBe(0);
    });
  });

  describe('computeLoyaltyProgramEligibility', () => {
    it('should compute eligibility for a valid loyalty program', async () => {
      const mockProgram = {
        id: 'loyalty-1',
        merchantId: 'merchant-1',
        isActive: true,
        pointsUsedInPeriod: 100,
        pointsIssuedLimit: 10000,
        Merchant: {
          id: 'merchant-1',
          businessName: 'Test Merchant',
          category: 'Food',
          status: MerchantStatusEnum.Active,
          Outlets: [
            {
              id: 'outlet-1',
              name: 'Test Outlet',
              isActive: true,
              Review: { status: ReviewStatusEnum.Approved },
            },
          ],
        },
        Review: { status: ReviewStatusEnum.Approved },
        LoyaltyTiers: [
          {
            id: 'tier-1',
            minCustomerType: CustomerTypeEnum.Regular,
            isActive: true,
            deletedAt: null,
            Review: { status: ReviewStatusEnum.Approved },
          },
        ],
        MerchantLoyaltyRewards: [
          {
            id: 'reward-1',
            isActive: true,
            Review: { status: ReviewStatusEnum.Approved },
          },
        ],
      };

      const mockCustomers = [
        { userId: 'user-1' },
        { userId: 'user-2' },
      ];

      mockPrisma.loyaltyProgram.findUnique.mockResolvedValue(mockProgram);
      mockPrisma.customerType.findMany.mockResolvedValue(mockCustomers);
      mockPrisma.userOfferEligibility.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.userOfferEligibility.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.loyaltyProgram.update.mockResolvedValue(mockProgram);
      mockPrisma.eligibilityComputationLog.create.mockResolvedValue({});

      const result = await service.computeLoyaltyProgramEligibility('loyalty-1');

      expect(result).toBe(2);
    });
  });
});
