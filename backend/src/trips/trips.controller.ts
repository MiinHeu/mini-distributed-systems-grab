import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DbRoutingService } from '../db-routing/db-routing.service';
import { ok } from '../common/api-response';

class BookTripDto {
  latitude: number;
  note?: string;
}

@Controller('trips')
export class TripsController {
  constructor(private readonly dbRouting: DbRoutingService) {}

  /**
   * Demo endpoint for "Trip History" (read-only proof).
   *
   * Use `latitude` to route NORTH/SOUTH and pick replica when primary is down.
   * Data source: `replication_test` table created by DB init scripts.
   */
  @Get('history')
  async history(@Query('latitude') latitudeRaw: string) {
    const latitude = Number(latitudeRaw);
    if (!Number.isFinite(latitude)) {
      throw new BadRequestException(
        ok(null, {
          readOnly: false,
          warning: 'Missing or invalid query param: latitude',
          activeNode: null,
        }),
      );
    }

    const ctx = this.dbRouting.getReadContext(latitude);

    const result = await ctx.pool.query(
      `SELECT id, node_name, message, created_at
       FROM replication_test
       ORDER BY created_at DESC
       LIMIT 50`,
    );

    return ok(
      {
        latitude,
        region: ctx.region,
        items: result.rows,
      },
      {
        readOnly: ctx.readOnly,
        warning: ctx.warning,
        activeNode: ctx.activeNode,
      },
    );
  }

  /**
   * Demo endpoint for "Book Trip" (write blocked in read-only mode).
   *
   * Uses write routing: only PRIMARY accepts write.
   * When PRIMARY is down, DbRoutingService throws HTTP 503 with `readOnly=true`.
   */
  @Post('book')
  async book(@Body() body: BookTripDto) {
    if (!Number.isFinite(body?.latitude)) {
      throw new BadRequestException(
        ok(null, {
          readOnly: false,
          warning: 'Missing or invalid body field: latitude',
          activeNode: null,
        }),
      );
    }

    const ctx = this.dbRouting.getWriteContext(body.latitude);

    const result = await ctx.pool.query(
      'INSERT INTO replication_test(node_name, message) VALUES ($1, $2) RETURNING id, created_at',
      ['trip-book', body.note ?? `book trip from latitude ${body.latitude}`],
    );

    return ok(
      {
        latitude: body.latitude,
        region: ctx.region,
        created: result.rows[0],
      },
      {
        readOnly: ctx.readOnly,
        warning: ctx.warning,
        activeNode: ctx.activeNode,
      },
    );
  }
}

