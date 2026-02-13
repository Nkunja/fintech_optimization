import { Test, TestingModule } from '@nestjs/testing';
import { TestFlowService } from './test-flow.service';
import { PrismaService } from '../prisma/prisma.service';
import { TEST_USER_IDS } from '../../common/constants';

describe('TestFlowService', () => {
  let service: TestFlowService;

  const mockPrisma = {
    merchant: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    outlet: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    cashbackConfiguration: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    exclusiveOffer: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    loyaltyProgram: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    userOfferEligibility: {
      findMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestFlowService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TestFlowService>(TestFlowService);
    jest.clearAllMocks();
  });

  describe('getTestUserIds', () => {
    it('should return all test user IDs', () => {
      const result = service.getTestUserIds();
      expect(result).toEqual([...TEST_USER_IDS]);
      expect(result).toHaveLength(5);
    });
  });

  describe('getMerchants', () => {
    it('should return merchants with outletId when activeOnly true', async () => {
      mockPrisma.merchant.findMany.mockResolvedValue([
        {
          id: 'm1',
          businessName: 'Shop A',
          category: 'Retail',
          Outlets: [{ id: 'outlet-1' }],
        },
      ]);

      const result = await service.getMerchants(true);

      expect(mockPrisma.merchant.findMany).toHaveBeenCalledWith({
        where: { status: 'Active' },
        include: { Outlets: { where: { isActive: true }, take: 1 } },
        orderBy: { businessName: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'm1',
        businessName: 'Shop A',
        category: 'Retail',
        outletId: 'outlet-1',
      });
    });

    it('should call findMany without where when activeOnly false', async () => {
      mockPrisma.merchant.findMany.mockResolvedValue([]);

      await service.getMerchants(false);

      expect(mockPrisma.merchant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
        }),
      );
    });
  });

  describe('getEligibilityForUser', () => {
    it('should return eligibility summary for user', async () => {
      mockPrisma.userOfferEligibility.findMany.mockResolvedValue([
        {
          offerType: 'CASHBACK',
          offerId: 'cb1',
          merchantName: 'Merchant A',
          merchantCategory: 'Retail',
          outletName: 'Outlet 1',
          hasBudgetRemaining: true,
        },
      ]);

      const result = await service.getEligibilityForUser('user-dev-001');

      expect(result.userId).toBe('user-dev-001');
      expect(result.totalEligible).toBe(1);
      expect(result.offers).toHaveLength(1);
      expect(result.offers[0]).toMatchObject({
        offerType: 'CASHBACK',
        offerId: 'cb1',
        merchantName: 'Merchant A',
        merchantCategory: 'Retail',
        outletName: 'Outlet 1',
        hasBudgetRemaining: true,
      });
    });

    it('should return empty offers when user has no eligibility', async () => {
      mockPrisma.userOfferEligibility.findMany.mockResolvedValue([]);

      const result = await service.getEligibilityForUser('user-unknown');

      expect(result.totalEligible).toBe(0);
      expect(result.offers).toEqual([]);
    });
  });

  describe('getEligibilityMatrix', () => {
    it('should return eligible count per test user', async () => {
      mockPrisma.userOfferEligibility.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(0);

      const result = await service.getEligibilityMatrix();

      expect(result).toHaveLength(TEST_USER_IDS.length);
      expect(mockPrisma.userOfferEligibility.count).toHaveBeenCalledTimes(
        TEST_USER_IDS.length,
      );
      expect(result[0]).toEqual({ userId: TEST_USER_IDS[0], eligibleCount: 3 });
      expect(result[1]).toEqual({ userId: TEST_USER_IDS[1], eligibleCount: 6 });
      expect(result[2]).toEqual({ userId: TEST_USER_IDS[2], eligibleCount: 0 });
    });
  });

  describe('createTestMerchant', () => {
    it('should return existing merchant when name already exists', async () => {
      mockPrisma.merchant.findFirst.mockResolvedValue({
        id: 'existing-id',
        businessName: 'Existing Shop',
        category: 'Retail',
      });
      mockPrisma.outlet.findFirst.mockResolvedValue({ id: 'outlet-existing' });

      const result = await service.createTestMerchant('Existing Shop', 'Retail');

      expect(mockPrisma.merchant.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'existing-id',
        businessName: 'Existing Shop',
        category: 'Retail',
        outletId: 'outlet-existing',
      });
    });

    it('should create merchant and outlet when new', async () => {
      mockPrisma.merchant.findFirst.mockResolvedValue(null);
      mockPrisma.merchant.create.mockResolvedValue({
        id: 'new-merchant-id',
        businessName: 'New Shop',
        category: 'Food',
        status: 'Active',
      });
      mockPrisma.outlet.create.mockResolvedValue({
        id: 'new-outlet-id',
        name: 'New Shop - Main',
        merchantId: 'new-merchant-id',
      });

      const result = await service.createTestMerchant('New Shop', 'Food');

      expect(mockPrisma.merchant.create).toHaveBeenCalledWith({
        data: {
          businessName: 'New Shop',
          category: 'Food',
          status: 'Active',
        },
      });
      expect(mockPrisma.outlet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Shop - Main',
          merchantId: 'new-merchant-id',
        }),
      });
      expect(result.outletId).toBe('new-outlet-id');
    });
  });

  describe('createTestOffers', () => {
    it('should return existing offers when merchant already has cashback config', async () => {
      const merchant = {
        id: 'm1',
        businessName: 'Has Offers',
        Outlets: [{ id: 'outlet-1' }],
      };
      mockPrisma.merchant.findUniqueOrThrow.mockResolvedValue(merchant);
      mockPrisma.cashbackConfiguration.findFirst.mockResolvedValue({
        id: 'cb1',
      });
      mockPrisma.exclusiveOffer.findFirst.mockResolvedValue({ id: 'ex1' });
      mockPrisma.loyaltyProgram.findFirst.mockResolvedValue({ id: 'lp1' });
      mockPrisma.userOfferEligibility.count.mockResolvedValue(15);

      const result = await service.createTestOffers('m1');

      expect(mockPrisma.cashbackConfiguration.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('already has offers');
      expect(result.cashbackId).toBe('cb1');
      expect(result.eligibilityRecordsCreated).toBe(15);
    });

    it('should create cashback, exclusive, loyalty and eligibility when new', async () => {
      const merchant = {
        id: 'm2',
        businessName: 'New Merchant',
        category: 'Retail',
        Outlets: [{ id: 'outlet-2', name: 'Main' }],
      };
      mockPrisma.merchant.findUniqueOrThrow.mockResolvedValue(merchant);
      mockPrisma.cashbackConfiguration.findFirst.mockResolvedValue(null);
      mockPrisma.cashbackConfiguration.create.mockResolvedValue({
        id: 'new-cb',
      });
      mockPrisma.exclusiveOffer.create.mockResolvedValue({ id: 'new-ex' });
      mockPrisma.loyaltyProgram.create.mockResolvedValue({ id: 'new-lp' });
      mockPrisma.userOfferEligibility.createMany.mockResolvedValue({
        count: 3,
      });

      const result = await service.createTestOffers('m2');

      expect(mockPrisma.cashbackConfiguration.create).toHaveBeenCalled();
      expect(mockPrisma.exclusiveOffer.create).toHaveBeenCalled();
      expect(mockPrisma.loyaltyProgram.create).toHaveBeenCalled();
      expect(mockPrisma.userOfferEligibility.createMany).toHaveBeenCalledTimes(
        TEST_USER_IDS.length,
      );
      expect(result.success).toBe(true);
      expect(result.cashbackId).toBe('new-cb');
      expect(result.exclusiveId).toBe('new-ex');
      expect(result.loyaltyId).toBe('new-lp');
      expect(result.eligibilityRecordsCreated).toBe(3 * TEST_USER_IDS.length);
    });

    it('should throw when merchant has no outlet', async () => {
      mockPrisma.merchant.findUniqueOrThrow.mockResolvedValue({
        id: 'm3',
        businessName: 'No Outlet',
        Outlets: [],
      });
      mockPrisma.cashbackConfiguration.findFirst.mockResolvedValue(null);

      await expect(service.createTestOffers('m3')).rejects.toThrow(
        'has no active outlet',
      );
    });
  });
});
