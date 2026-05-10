import { Controller, Get, Query } from '@nestjs/common';
import { DbRoutingService } from '../db-routing/db-routing.service';
import { ok } from '../common/api-response';
import { Region } from '../common/location.utils';

@Controller('reports')
export class ReportsController {
  constructor(private readonly dbRouting: DbRoutingService) {}

  private async safeQuery(latitude: number, sql: string, params: any[] = []) {
    try {
      const ctx = this.dbRouting.getReadContext(latitude);
      const res = await ctx.pool.query(sql, params);
      return { rows: res.rows, readOnly: ctx.readOnly, warning: ctx.warning, error: null };
    } catch (e: any) {
      return { rows: [], readOnly: true, warning: `Vùng tại lat=${latitude} đang ngoại tuyến: ${e.message}`, error: e };
    }
  }

  @Get('revenue')
  async revenue() {
    const sql = `
      SELECT region,
             COUNT(*)::int       AS total_trips,
             SUM(fare)::numeric  AS total_revenue,
             AVG(fare)::numeric  AS avg_fare
      FROM trips
      WHERE status = 'completed'
      GROUP BY region
    `;

    const [north, south] = await Promise.all([
      this.safeQuery(21.0, sql),
      this.safeQuery(10.0, sql),
    ]);

    const data = [...north.rows, ...south.rows];
    const warnings = [north.warning, south.warning].filter(Boolean);

    return ok(data, {
      readOnly: north.readOnly || south.readOnly,
      warning: warnings.length > 0 ? warnings.join(' | ') : null,
    });
  }

  @Get('trips/count')
  async tripsCount() {
    const sql = `SELECT region, COUNT(*)::int AS total FROM trips GROUP BY region`;
    
    const [north, south] = await Promise.all([
      this.safeQuery(21.0, sql),
      this.safeQuery(10.0, sql),
    ]);

    const warnings = [north.warning, south.warning].filter(Boolean);

    return ok([...north.rows, ...south.rows], {
      readOnly: north.readOnly || south.readOnly,
      warning: warnings.length > 0 ? warnings.join(' | ') : null,
    });
  }

  @Get('trips')
  async tripsByDate(@Query('from') from: string, @Query('to') to: string) {
    const sql = `
      SELECT DATE(created_at) AS date,
             region,
             COUNT(*)::int    AS total
      FROM trips
      WHERE ($1::date IS NULL OR created_at >= $1::date)
        AND ($2::date IS NULL OR created_at <= $2::date)
      GROUP BY DATE(created_at), region
      ORDER BY date DESC
    `;

    const [north, south] = await Promise.all([
      this.safeQuery(21.0, sql, [from || null, to || null]),
      this.safeQuery(10.0, sql, [from || null, to || null]),
    ]);

    const warnings = [north.warning, south.warning].filter(Boolean);

    return ok([...north.rows, ...south.rows], {
      readOnly: north.readOnly || south.readOnly,
      warning: warnings.length > 0 ? warnings.join(' | ') : null,
    });
  }

  @Get('drivers/top')
  async topDrivers() {
    const sql = `
      SELECT driver_id,
             COUNT(*)::int       AS total_trips,
             SUM(fare)::numeric  AS total_earned
      FROM trips
      WHERE status = 'completed'
      GROUP BY driver_id
      ORDER BY total_trips DESC
      LIMIT 10
    `;

    const [north, south] = await Promise.all([
      this.safeQuery(21.0, sql),
      this.safeQuery(10.0, sql),
    ]);

    // Merge and re-sort for top 10 global
    const combined = [...north.rows, ...south.rows]
      .sort((a, b) => b.total_trips - a.total_trips)
      .slice(0, 10);

    const warnings = [north.warning, south.warning].filter(Boolean);

    return ok(combined, {
      readOnly: north.readOnly || south.readOnly,
      warning: warnings.length > 0 ? warnings.join(' | ') : null,
    });
  }
}
