import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => {
        const indicator = this.healthIndicatorService.check('database');
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return indicator.up();
        } catch (error) {
          return indicator.down({ message: (error as Error).message });
        }
      },
    ]);
  }
}
