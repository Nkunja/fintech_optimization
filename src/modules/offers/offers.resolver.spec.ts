import { Test, TestingModule } from '@nestjs/testing';
import { OffersResolver } from './offers.resolver';
import { OffersService } from './offers.service';

describe('OffersResolver', () => {
  let resolver: OffersResolver;
  let offersService: OffersService;

  const mockOffersService = {
    getOffersForUser: jest.fn(),
    getLoyaltyProgramsForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersResolver,
        { provide: OffersService, useValue: mockOffersService },
      ],
    }).compile();

    resolver = module.get<OffersResolver>(OffersResolver);
    offersService = module.get<OffersService>(OffersService);
    jest.clearAllMocks();
  });

  describe('offers', () => {
    it('should return stringified offers when context has userId (req.user)', async () => {
      const context = { req: { user: { id: 'user-dev-001' } } };
      const mockResult = { outlets: [], totalCount: 0 };
      mockOffersService.getOffersForUser.mockResolvedValue(mockResult);

      const result = await resolver.offers(
        undefined,
        undefined,
        undefined,
        50,
        0,
        context,
      );

      expect(mockOffersService.getOffersForUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-dev-001' }),
      );
      expect(result).toBe(JSON.stringify(mockResult));
    });

    it('should return stringified offers when context has X-Test-User-Id header', async () => {
      const context = {
        req: { headers: { 'x-test-user-id': 'user-dev-002' } },
      };
      const mockResult = { outlets: [{ id: 'o1' }], totalCount: 1 };
      mockOffersService.getOffersForUser.mockResolvedValue(mockResult);

      const result = await resolver.offers(
        undefined,
        undefined,
        undefined,
        10,
        0,
        context,
      );

      expect(mockOffersService.getOffersForUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-dev-002' }),
      );
      expect(JSON.parse(result).totalCount).toBe(1);
    });

    it('should throw Unauthorized when context has no userId', async () => {
      const context = { req: {} };

      await expect(
        resolver.offers(undefined, undefined, undefined, 50, 0, context),
      ).rejects.toThrow('Unauthorized');

      expect(mockOffersService.getOffersForUser).not.toHaveBeenCalled();
    });

    it('should pass category and search to service', async () => {
      const context = { req: { user: { id: 'user-1' } } };
      mockOffersService.getOffersForUser.mockResolvedValue({
        outlets: [],
        totalCount: 0,
      });

      await resolver.offers('coffee', 'Food', undefined, 50, 0, context);

      expect(mockOffersService.getOffersForUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          search: 'coffee',
          category: 'Food',
        }),
      );
    });
  });

  describe('loyaltyPrograms', () => {
    it('should return stringified programs when context has userId', async () => {
      const context = { req: { user: { id: 'user-dev-001' } } };
      const mockPrograms = [{ id: 'lp1', name: 'Rewards' }];
      mockOffersService.getLoyaltyProgramsForUser.mockResolvedValue(mockPrograms);

      const result = await resolver.loyaltyPrograms(
        undefined,
        undefined,
        context,
      );

      expect(mockOffersService.getLoyaltyProgramsForUser).toHaveBeenCalledWith(
        'user-dev-001',
        undefined,
        undefined,
      );
      expect(result).toBe(JSON.stringify(mockPrograms));
    });

    it('should throw Unauthorized when context has no userId', async () => {
      const context = { req: { headers: {} } };

      await expect(
        resolver.loyaltyPrograms(undefined, undefined, context),
      ).rejects.toThrow('Unauthorized');

      expect(mockOffersService.getLoyaltyProgramsForUser).not.toHaveBeenCalled();
    });
  });
});
