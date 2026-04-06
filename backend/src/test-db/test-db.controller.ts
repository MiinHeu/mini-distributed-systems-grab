import { Body, Controller, Post } from '@nestjs/common';
import { DbRoutingService } from '../db-routing/db-routing.service';

class TestDbDto {
  latitude: number;
}

@Controller('test-db')
export class TestDbController {
  constructor(private readonly dbRouting: DbRoutingService) {}

  @Post('read')
  async testRead(@Body() body: TestDbDto) {
    const ctx = this.dbRouting.getReadContext(body.latitude);
    const result = await ctx.pool.query('SELECT NOW() as now');
    return {
      readOnly: ctx.readOnly,
      warning: ctx.warning,
      activeNode: ctx.activeNode,
      data: {
        mode: 'read',
        latitude: body.latitude,
        rows: result.rows,
      },
    };
  }

  @Post('write')
  async testWrite(@Body() body: TestDbDto) {
    const ctx = this.dbRouting.getWriteContext(body.latitude);
    const result = await ctx.pool.query(
      'INSERT INTO replication_test(node_name, message) VALUES ($1, $2) RETURNING id, created_at',
      ['api', `write from latitude ${body.latitude}`],
    );

    return {
      readOnly: ctx.readOnly,
      warning: ctx.warning,
      activeNode: ctx.activeNode,
      data: {
        mode: 'write',
        latitude: body.latitude,
        inserted: result.rows[0],
      },
    };
  }
}
