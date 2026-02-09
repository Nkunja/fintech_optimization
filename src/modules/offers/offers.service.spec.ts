import { Test, TestingModule } from '@nestjs/testing';
import { OffersService } from './offers.service';
import { PrismaService } from '../prisma/prisma.service';
import { OfferTypeEnum } from '@prisma/client';

describe('OffersService (Integration)', () => {
  let service: OffersService;
  let prisma: PrismaService;

  const mockPrisma = {
    userOfferEligibility: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    outlet: {
      findMany: jest.fn(),
    },
    offerListCache: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    loyaltyProgram: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOffersForUser', () => {
    it('should return offers for an eligible user', async () => {
      const userId = 'user-1';
      const mockEligibilityRecords = [
        {
          outletId: 'outlet-1',
          offerType: OfferTypeEnum.CASHBACK,
          offerId: 'cashback-1',
        },
        {
          outletId: 'outlet-1',
          offerType: OfferTypeEnum.EXCLUSIVE,
          offerId: 'exclusive-1',
        },
      ];

      const mockOutlets = [
        {
          id: 'outlet-1',
          name: 'Test Outlet',
          isActive: true,
          Merchant: {
            id: 'merchant-1',
            businessName: 'Test Merchant',
            category: 'Food',
            status: 'Active',
          },
          CashbackConfigurations: [
            {
              id: 'cashback-1',
              name: 'Test Cashback',
              isActive: true,
              deletedAt: null,
              CashbackConfigurationTiers: [],
            },
          ],
          ExclusiveOffers: [
            {
              id: 'exclusive-1',
              name: 'Test Offer',
              isActive: true,
              deletedAt: null,
            },
          ],
        },
      ];

      mockPrisma.offerListCache.findUnique.mockResolvedValue(null);
      mockPrisma.userOfferEligibility.count.mockResolvedValue(2);
      mockPrisma.userOfferEligibility.findMany.mockResolvedValue(mockEligibilityRecords);
      mockPrisma.outlet.findMany.mockResolvedValue(mockOutlets);
      mockPrisma.offerListCache.upsert.mockResolvedValue({});

      const result = await service.getOffersForUser({
        userId,
        limit: 50,
        offset: 0,
      });

      expect(result.outlets).toHaveLength(1);
      expect(result.outlets[0].CashbackConfigurations).toHaveLength(1);
      expect(result.outlets[0].ExclusiveOffers).toHaveLength(1);
      expect(result.totalCount).toBe(2);
    });

    it('should filter by category', async () => {
      const userId = 'user-1';
      const category = 'Food';

      mockPrisma.offerListCache.findUnique.mockResolvedValue(null);
      mockPrisma.userOfferEligibility.count.mockResolvedValue(1);
      mockPrisma.userOfferEligibility.findMany.mockResolvedValue([
        {
          outletId: 'outlet-1',
          offerType: OfferTypeEnum.CASHBACK,
          offerId: 'cashback-1',
        },
      ]);
      mockPrisma.outlet.findMany.mockResolvedValue([
        {
          id: 'outlet-1',
          name: 'Food Outlet',
          isActive: true,
          Merchant: {
            id: 'merchant-1',
            businessName: 'Food Merchant',
            category: 'Food',
          },
          CashbackConfigurations: [
            {
              id: 'cashback-1',
              isActive: true,
              deletedAt: null,
            },
          ],
          ExclusiveOffers: [],
        },
      ]);
      mockPrisma.offerListCache.upsert.mockResolvedValue({});

      const result = await service.getOffersForUser({
        userId,
        category,
      });

      expect(mockPrisma.userOfferEligibility.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            merchantCategory: category,
          }),
        }),
      );
      expect(result.outlets).toHaveLength(1);
    });

    it('should filter by search term', async () => {
      const userId = 'user-1';
      const search = 'Pizza';

      mockPrisma.offerListCache.findUnique.mockResolvedValue(null);
      mockPrisma.userOfferEligibility.count.mockResolvedValue(1);
      mockPrisma.userOfferEligibility.findMany.mockResolvedValue([
        {
          outletId: 'outlet-1',
          offerType: OfferTypeEnum.CASHBACK,
          offerId: 'cashback-1',
        },
      ]);
      mockPrisma.outlet.findMany.mockResolvedValue([
        {
          id: 'outlet-1',
          name: 'Pizza Place',
          isActive: true,
          Merchant: {
            businessName: 'Pizza Corp',
          },
          CashbackConfigurations: [
            {
              id: 'cashback-1',
              isActive: true,
              deletedAt: null,
            },
          ],
          ExclusiveOffers: [],
        },
      ]);
      mockPrisma.offerListCache.upsert.mockResolvedValue({});

      const result = await service.getOffersForUser({
        userId,
        search,
      });

      expect(mockPrisma.userOfferEligibility.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { merchantName: { contains: search, mode: 'insensitive' } },
              { outletName: { contains: search, mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should return empty results for user with no eligibility', async () => {
      const userId = 'user-no-offers';

      mockPrisma.offerListCache.findUnique.mockResolvedValue(null);
      mockPrisma.userOfferEligibility.count.mockResolvedValue(0);
      mockPrisma.userOfferEligibility.findMany.mockResolvedValue([]);

      const result = await service.getOffersForUser({
        userId,
      });

      expect(result.outlets).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should use cache when available', async () => {
      const userId = 'user-1';
      const cachedResult = {
        outlets: [
          {
            id: 'outlet-1',
            name: 'Cached Outlet',
            CashbackConfigurations: [],
            ExclusiveOffers: [],
          },
        ],
        totalCount: 1,
      };

      mockPrisma.offerListCache.findUnique.mockResolvedValue({
        cacheKey: 'test-key',
        data: cachedResult,
        expiresAt: new Date(Date.now() + 10000), // Not expired
      });

      const result = await service.getOffersForUser({ userId });

      expect(result).toEqual(cachedResult);
      expect(mockPrisma.userOfferEligibility.count).not.toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 5;

      mockPrisma.offerListCache.findUnique.mockResolvedValue(null);
      mockPrisma.userOfferEligibility.count.mockResolvedValue(20);
      mockPrisma.userOfferEligibility.findMany.mockResolvedValue([]);

      await service.getOffersForUser({
        userId,
        limit,
        offset,
      });

      expect(mockPrisma.userOfferEligibility.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: offset,
          take: limit,
        }),
      );
    });
  });

  describe('getLoyaltyProgramsForUser', () => {
    it('should return loyalty programs for eligible user', async () => {
      const userId = 'user-1';
      const mockEligibility = [
        {
          offerId: 'loyalty-1',
        },
      ];

      const mockPrograms = [
        {
          id: 'loyalty-1',
          name: 'Test Loyalty Program',
          isActive: true,
          Merchant: {
            businessName: 'Test Merchant',
          },
          LoyaltyTiers: [],
          MerchantLoyaltyRewards: [],
        },
      ];

      mockPrisma.userOfferEligibility.findMany.mockResolvedValue(mockEligibility);
      mockPrisma.loyaltyProgram.findMany.mockResolvedValue(mockPrograms);

      const result = await service.getLoyaltyProgramsForUser(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('loyalty-1');
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete cache entries for a user', async () => {
      const userId = 'user-1';

      mockPrisma.offerListCache.deleteMany.mockResolvedValue({ count: 3 });

      await service.invalidateUserCache(userId);

      expect(mockPrisma.offerListCache.deleteMany).toHaveBeenCalledWith({
        where: {
          cacheKey: {
            contains: userId,
          },
        },
      });
    });
  });
});
