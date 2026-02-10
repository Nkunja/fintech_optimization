import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { join } from 'path';
import { PrismaModule } from './modules/prisma/prisma.module';
import { HealthResolver } from './modules/health/health.resolver';
import { OffersModule } from './modules/offers/offers.module';
import { EligibilityModule } from './modules/eligibility/eligibility.module';


@Module({
  imports: [
    // GraphQL setup
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req }) => ({ req }),
    }),
    
    // Schedule for cron jobs
    ScheduleModule.forRoot(),
    
    // Bull for background jobs
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    
    PrismaModule,
    OffersModule,
    EligibilityModule,
  ],
  providers: [HealthResolver],
})
export class AppModule {}
