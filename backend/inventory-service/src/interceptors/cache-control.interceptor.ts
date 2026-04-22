import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly directive: string = 'no-store') {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // GraphQL requests come through HTTP — grab the underlying response
    const gqlCtx = GqlExecutionContext.create(context);
    const res = gqlCtx.getContext<{ res: any }>().res;

    if (res) {
      res.setHeader('Cache-Control', this.directive);
    }

    return next.handle();
  }
}
