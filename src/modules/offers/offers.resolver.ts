import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OffersService, OffersQueryArgs } from './offers.service';
import { CashbackPercentageFilters } from '../../common/constants';

// Helper: get userId from context 
function getUserIdFromContext(context: any): string | undefined {
  const fromUser = context?.req?.user?.id;
  if (fromUser && typeof fromUser === 'string') return fromUser.trim();
  const headers = context?.req?.headers;
  if (headers) {
    const h = (headers['x-test-user-id'] ?? headers['X-Test-User-Id']) ?? '';
    const id = typeof h === 'string' ? h.trim() : Array.isArray(h) ? (h[0]?.trim?.() ?? '') : '';
    if (id) return id;
  }
  return undefined;
}


@UseGuards()
@Resolver()
export class OffersResolver {
  constructor(private readonly offersService: OffersService) {}

  
   //This is the main endpoint that replaces the complex query
   
  @Query(() => String) 
  async offers(
    @Args('search', { nullable: true }) search?: string,
    @Args('category', { nullable: true }) category?: string,
    @Args('percentage', { nullable: true }) percentage?: CashbackPercentageFilters,
    @Args('limit', { nullable: true, defaultValue: 50 }) limit?: number,
    @Args('offset', { nullable: true, defaultValue: 0 }) offset?: number,
    @Context() context?: any,
  ) {
    const userId = getUserIdFromContext(context);

    if (!userId) {
      throw new Error('Unauthorized');
    }

    const args: OffersQueryArgs = {
      userId,
      search,
      category,
      percentage,
      limit,
      offset,
    };

    const result = await this.offersService.getOffersForUser(args);

    return JSON.stringify(result);
  }

  
   // Get loyalty programs for user
   
  @Query(() => String)
  async loyaltyPrograms(
    @Args('search', { nullable: true }) search?: string,
    @Args('category', { nullable: true }) category?: string,
    @Context() context?: any,
  ) {
    const userId = getUserIdFromContext(context);

    if (!userId) {
      throw new Error('Unauthorized');
    }

    const programs = await this.offersService.getLoyaltyProgramsForUser(
      userId,
      category,
      search,
    );

    return JSON.stringify(programs);
  }
}
