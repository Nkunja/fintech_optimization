import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

 // Impersonate/ Fake auth
  const allowTestUserHeader =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_TEST_USER_HEADER === 'true';
  if (allowTestUserHeader) {
    app.use((req: any, _res, next) => {
      const testUserId = req.headers['x-test-user-id'] ?? req.headers['X-Test-User-Id'];
      if (testUserId && typeof testUserId === 'string') {
        req.user = { id: testUserId.trim() };
      }
      next();
    });
  }

  //Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS 
  app.enableCors();     

  const port = process.env.PORT || 5050;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`GraphQL Playground: http://localhost:${port}/graphql`);
}

bootstrap();
