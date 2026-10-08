import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { HTTP_REQUESTS_TOTAL, HTTP_REQUEST_DURATION_SECONDS } from './metrics.constants';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUESTS_TOTAL) private readonly requestsTotal: Counter<string>,
    @InjectMetric(HTTP_REQUEST_DURATION_SECONDS) private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();
    const route: string = (request.route as { path?: string } | undefined)?.path ?? request.path;

    return next.handle().pipe(
      tap(() => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        const labels = {
          method: request.method,
          route,
          status_code: String(response.statusCode),
        };
        this.requestsTotal.inc(labels);
        this.requestDuration.observe(labels, durationSeconds);
      }),
    );
  }
}
