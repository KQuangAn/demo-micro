import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { CustomLoggerService } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (process.env.ENABLE_TIMEOUT_LOGGER === 'true') {
    app.useGlobalInterceptors(new TimeoutInterceptor());
  }
  await app.listen(process.env.PORT ?? 9000);
  const logger = new CustomLoggerService();
  app.useLogger(logger);
  console.log('app listening on port: ', process.env.PORT ?? 9000);
}
void bootstrap();
