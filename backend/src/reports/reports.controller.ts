import { Controller, Get, Query } from '@nestjs/common';
import { DbRoutingService } from '../db-routing/db-routing.service';
import { ok } from '../common/api-response';

@Controller('reports')
export class ReportsController {
  constructor(private readonly dbRouting: DbRoutingService) {}

  @Get('revenue')
  async revenue(@Query('latitude') latRaw: string) {
    const latitude = Number(latRaw) || 16.0;
    const ctx = this.dbRouting.getReadContext(latitude);
    const result = await ctx.pool.query(`
      SELECT region,
             COUNT(*)::int       AS total_trips,
             SUM(fare)::numeric  AS total_revenue,
             AVG(fare)::numeric  AS avg_fare
      FROM trips
      WHERE status = 'completed'
      GROUP BY region
    `);
    return ok(result.rows, {
      readOnly: ctx.readOnly,
      warning: ctx.warning,
      activeNode: ctx.activeNode,
    });
  }

  @Get('trips/count')
  async tripsCount(@Query('latitude') latRaw: string) {
    const latitude = Number(latRaw) || 16.0;
    const ctx = this.dbRouting.getReadContext(latitude);
    const result = await ctx.pool.query(`
      SELECT region, COUNT(*)::int AS total
      FROM trips
      GROUP BY region
    `);
    return ok(result.rows, {
      readOnly: ctx.readOnly,
      warning: ctx.warning,
      activeNode: ctx.activeNode,
    });
  }

  @Get('trips')
  async tripsByDate(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('latitude') latRaw: string,
  ) {
    const latitude = Number(latRaw) || 16.0;
    const ctx = this.dbRouting.getReadContext(latitude);
    const result = await ctx.pool.query(
      `
      SELECT DATE(created_at) AS date,
             region,
             COUNT(*)::int    AS total
      FROM trips
      WHERE ($1::date IS NULL OR created_at >= $1::date)
        AND ($2::date IS NULL OR created_at <= $2::date)
      GROUP BY DATE(created_at), region
      ORDER BY date DESC
    `,
      [from || null, to || null],
    );
    return ok(result.rows, {
      readOnly: ctx.readOnly,
      warning: ctx.warning,
      activeNode: ctx.activeNode,
    });
  }

  @Get('drivers/top')
  async topDrivers(@Query('latitude') latRaw: string) {
    const latitude = Number(latRaw) || 16.0;
    const ctx = this.dbRouting.getReadContext(latitude);
    const result = await ctx.pool.query(`
      SELECT driver_id,
             COUNT(*)::int       AS total_trips,
             SUM(fare)::numeric  AS total_earned
      FROM trips
      WHERE status = 'completed'
      GROUP BY driver_id
      ORDER BY total_trips DESC
      LIMIT 10
    `);
    return ok(result.rows, {
      readOnly: ctx.readOnly,
      warning: ctx.warning,
      activeNode: ctx.activeNode,
    });
  }
}
