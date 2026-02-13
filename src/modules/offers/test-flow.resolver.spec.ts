import { Test, TestingModule } from '@nestjs/testing';
import { TestFlowResolver } from './test-flow.resolver';
import { TestFlowService } from './test-flow.service';

describe('TestFlowResolver', () => {
  let resolver: TestFlowResolver;

  const mockTestFlowService = {
    getTestUserIds: jest.fn(),
    getMerchants: jest.fn(),
    getEligibilityForUser: jest.fn(),
    getEligibilityMatrix: jest.fn(),
    createTestMerchant: jest.fn(),
    createTestOffers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestFlowResolver,
        { provide: TestFlowService, useValue: mockTestFlowService },
      ],
    }).compile();

    resolver = module.get<TestFlowResolver>(TestFlowResolver);
    jest.clearAllMocks();
  });

  describe('testUsers', () => {
    it('should return list of test user ids', () => {
      mockTestFlowService.getTestUserIds.mockReturnValue([
        'user-dev-001',
        'user-dev-002',
      ]);

      const result = resolver.testUsers();

      expect(result).toEqual(['user-dev-001', 'user-dev-002']);
      expect(mockTestFlowService.getTestUserIds).toHaveBeenCalled();
    });
  });

  describe('merchants', () => {
    it('should return merchants from service', async () => {
      const merchants = [
        { id: 'm1', businessName: 'Shop A', category: 'Retail', outletId: 'o1' },
      ];
      mockTestFlowService.getMerchants.mockResolvedValue(merchants);

      const result = await resolver.merchants(true);

      expect(mockTestFlowService.getMerchants).toHaveBeenCalledWith(true);
      expect(result).toEqual(merchants);
    });
  });

  describe('eligibilityForUser', () => {
    it('should return eligibility summary for userId', async () => {
      const summary = {
        userId: 'user-dev-001',
        totalEligible: 2,
        offers: [
          {
            offerType: 'CASHBACK',
            offerId: 'cb1',
            merchantName: 'M1',
            merchantCategory: 'Retail',
            outletName: 'O1',
            hasBudgetRemaining: true,
          },
        ],
      };
      mockTestFlowService.getEligibilityForUser.mockResolvedValue(summary);

      const result = await resolver.eligibilityForUser('user-dev-001');

      expect(mockTestFlowService.getEligibilityForUser).toHaveBeenCalledWith(
        'user-dev-001',
      );
      expect(result).toEqual(summary);
    });
  });

  describe('eligibilityMatrix', () => {
    it('should return matrix from service', async () => {
      const matrix = [
        { userId: 'user-dev-001', eligibleCount: 5 },
        { userId: 'user-dev-002', eligibleCount: 3 },
      ];
      mockTestFlowService.getEligibilityMatrix.mockResolvedValue(matrix);

      const result = await resolver.eligibilityMatrix();

      expect(mockTestFlowService.getEligibilityMatrix).toHaveBeenCalled();
      expect(result).toEqual(matrix);
    });
  });

  describe('createTestMerchant', () => {
    it('should create merchant and return info', async () => {
      const merchant = {
        id: 'new-id',
        businessName: 'New Shop',
        category: 'Food',
        outletId: 'outlet-1',
      };
      mockTestFlowService.createTestMerchant.mockResolvedValue(merchant);

      const result = await resolver.createTestMerchant('New Shop', 'Food');

      expect(mockTestFlowService.createTestMerchant).toHaveBeenCalledWith(
        'New Shop',
        'Food',
      );
      expect(result).toEqual(merchant);
    });
  });

  describe('createTestOffers', () => {
    it('should create offers for merchant and return result', async () => {
      const createResult = {
        success: true,
        message: 'Created',
        merchantId: 'm1',
        merchantName: 'Shop',
        cashbackId: 'cb1',
        exclusiveId: 'ex1',
        loyaltyId: 'lp1',
        eligibilityRecordsCreated: 15,
      };
      mockTestFlowService.createTestOffers.mockResolvedValue(createResult);

      const result = await resolver.createTestOffers('m1');

      expect(mockTestFlowService.createTestOffers).toHaveBeenCalledWith('m1');
      expect(result).toEqual(createResult);
    });
  });
});
