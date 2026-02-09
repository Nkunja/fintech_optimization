import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OffersService, OffersQueryArgs } from './offers.service';
import { CashbackPercentageFilters } from '../../common/constants';

// Simple auth guard placeholder
// TODO: Replace with actual auth guard implementation
@UseGuards()
@Resolver()
export class OffersResolver {
  constructor(private readonly offersService: OffersService) {}

  
   //This is the main endpoint that replaces the complex query
   
  @Query(() => String) // Replace with your actual GraphQL types
  async offers(
    @Args('search', { nullable: true }) search?: string,
    @Args('category', { nullable: true }) category?: string,
    @Args('percentage', { nullable: true }) percentage?: CashbackPercentageFilters,
    @Args('limit', { nullable: true, defaultValue: 50 }) limit?: number,
    @Args('offset', { nullable: true, defaultValue: 0 }) offset?: number,
    @Context() context?: any,
  ) {
    const userId = context?.req?.user?.id;

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

    // Return the result - adjust based on your GraphQL schema
    return JSON.stringify(result);
  }

  
   // Get loyalty programs for user
   
  @Query(() => String)
  async loyaltyPrograms(
    @Args('search', { nullable: true }) search?: string,
    @Args('category', { nullable: true }) category?: string,
    @Context() context?: any,
  ) {
    const userId = context?.req?.user?.id;

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
