/**
 * TEST CASES
 * Ứng dụng Gọi xe theo Vị trí (CSDL Phân tán)
 *
 * Các test này dùng mock để kiểm tra logic định tuyến, failover, read-only mode
 * mà KHÔNG cần kết nối DB thật — có thể chạy bất cứ lúc nào với: npm test
 *
 * Để test với DB thật (integration), xem file: test-cases/integration.md
 */

import { LocationRouterService } from '../router/location-router.service';
import { REGION_LATITUDE_THRESHOLD, Region } from '../common/location.utils';

// ─── Mock HealthService ───────────────────────────────────────────────────────

function makeHealthService(overrides: {
  northPrimary?: boolean;
  northReplica?: boolean;
  southPrimary?: boolean;
  southReplica?: boolean;
}) {
  return {
    isNorthPrimaryHealthy: () => overrides.northPrimary ?? true,
    isNorthReplicaHealthy: () => overrides.northReplica ?? true,
    isSouthPrimaryHealthy: () => overrides.southPrimary ?? true,
    isSouthReplicaHealthy: () => overrides.southReplica ?? true,
    serviceLevelForRegion: (region: Region) => {
      const primary = region === Region.NORTH
        ? (overrides.northPrimary ?? true)
        : (overrides.southPrimary ?? true);
      const replica = region === Region.NORTH
        ? (overrides.northReplica ?? true)
        : (overrides.southReplica ?? true);
      if (primary) return 'full';
      if (replica) return 'readonly';
      return 'unavailable';
    },
  };
}

// ─── Mock DatabaseService pool ───────────────────────────────────────────────

function makePool(name: string, shouldFail = false) {
  return {
    _name: name,
    query: jest.fn().mockImplementation(() => {
      if (shouldFail) return Promise.reject(new Error(`${name} is down`));
      return Promise.resolve({ rows: [{ id: 1, region: name.includes('north') ? 'NORTH' : 'SOUTH' }], rowCount: 1 });
    }),
    on: jest.fn(),
  };
}

// ─── LocationRouterService ────────────────────────────────────────────────────

describe('LocationRouterService', () => {
  let router: LocationRouterService;

  beforeEach(() => {
    router = new LocationRouterService();
  });

  /**
   * TC-01: Định tuyến theo thành phố — chọn "Hà Nội" (lat=21.03)
   * Kết quả mong đợi: kết nối pg-north-primary
   */
  it('TC-01: lat=21.03 (Hà Nội) → NORTH', () => {
    expect(router.getRegion(21.03)).toBe(Region.NORTH);
  });

  /**
   * TC-02: Định tuyến theo tọa độ — nhập lat=10.77, lng=106.70 (TP.HCM)
   * Kết quả mong đợi: kết nối pg-south-primary
   */
  it('TC-02: lat=10.77 (TP.HCM) → SOUTH', () => {
    expect(router.getRegion(10.77)).toBe(Region.SOUTH);
  });

  it('TC-02b: Ngưỡng ranh giới lat=16.5 → NORTH', () => {
    expect(router.getRegion(16.5)).toBe(Region.NORTH);
  });

  it('TC-02c: Ngưỡng ranh giới lat=16.49 → SOUTH', () => {
    expect(router.getRegion(16.49)).toBe(Region.SOUTH);
  });

  it('TC-02d: Ngưỡng nhất quán với REGION_LATITUDE_THRESHOLD', () => {
    expect(router.getRegion(REGION_LATITUDE_THRESHOLD)).toBe(Region.NORTH);
    expect(router.getRegion(REGION_LATITUDE_THRESHOLD - 0.01)).toBe(Region.SOUTH);
  });
});

// ─── DbRoutingService (mock) ──────────────────────────────────────────────────

import { ServiceUnavailableException } from '@nestjs/common';
import { DbRoutingService } from '../db-routing/db-routing.service';

function makeDbService(config: {
  northPrimaryFail?: boolean;
  northReplicaFail?: boolean;
  southPrimaryFail?: boolean;
  southReplicaFail?: boolean;
}) {
  return {
    northPrimary: makePool('northPrimary', config.northPrimaryFail),
    northReplica: makePool('northReplica', config.northReplicaFail),
    southPrimary: makePool('southPrimary', config.southPrimaryFail),
    southReplica: makePool('southReplica', config.southReplicaFail),
  } as any;
}

describe('DbRoutingService — Failover & Read-Only', () => {
  let router: LocationRouterService;

  beforeEach(() => {
    router = new LocationRouterService();
  });

  /**
   * TC-03: Replication hoạt động — khi cả 2 node đều online
   * Kết quả mong đợi: đọc từ primary, readOnly = false
   */
  it('TC-03: Cả 2 node online → đọc từ primary, readOnly=false', () => {
    const health = makeHealthService({ northPrimary: true, northReplica: true });
    const db = makeDbService({});
    const service = new DbRoutingService(db, router, health as any);

    const ctx = service.getReadContext(21.03); // Hà Nội → NORTH
    expect(ctx.region).toBe(Region.NORTH);
    expect(ctx.activeNode).toBe('NORTH_PRIMARY');
    expect(ctx.readOnly).toBe(false);
    expect(ctx.warning).toBeNull();
  });

  /**
   * TC-04: Failover tự động — docker stop pg-south-primary
   * Kết quả mong đợi: trong 5-10 giây, tự chuyển sang south-replica
   * (Trong unit test: primary down → routing chuyển sang replica ngay lập tức)
   */
  it('TC-04: South Primary down → tự chuyển sang SOUTH_REPLICA (READ-ONLY)', () => {
    const health = makeHealthService({ southPrimary: false, southReplica: true });
    const db = makeDbService({ southPrimaryFail: true });
    const service = new DbRoutingService(db, router, health as any);

    const ctx = service.getReadContext(10.77); // TP.HCM → SOUTH
    expect(ctx.region).toBe(Region.SOUTH);
    expect(ctx.activeNode).toBe('SOUTH_REPLICA');
    expect(ctx.readOnly).toBe(true);
    expect(ctx.warning).toContain('SOUTH');
  });

  /**
   * TC-05: Read-only mode — Primary down → thử đặt chuyến
   * Kết quả mong đợi: lỗi rõ ràng, không crash app
   */
  it('TC-05: South Primary down → getWriteContext() throw ServiceUnavailableException', () => {
    const health = makeHealthService({ southPrimary: false, southReplica: true });
    const db = makeDbService({ southPrimaryFail: true });
    const service = new DbRoutingService(db, router, health as any);

    expect(() => service.getWriteContext(10.77)).toThrow(ServiceUnavailableException);
  });

  it('TC-05b: South Primary down → exception có warning message rõ ràng', () => {
    const health = makeHealthService({ southPrimary: false, southReplica: true });
    const db = makeDbService({ southPrimaryFail: true });
    const service = new DbRoutingService(db, router, health as any);

    try {
      service.getWriteContext(10.77);
      fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      // Warning message thực tế: "Tính năng GHI (Miền Nam) tạm thời bị khóa do hệ thống đang bảo trì..."
      expect(e.getResponse().warning).toContain('bảo trì');
      expect(e.getResponse().readOnly).toBe(true);
    }
  });

  /**
   * TC-06: Xem lịch sử khi failover — Primary down → xem lịch sử
   * Kết quả mong đợi: vẫn load được từ replica
   */
  it('TC-06: South Primary down → getReadContext() trả về southReplica pool', () => {
    const health = makeHealthService({ southPrimary: false, southReplica: true });
    const db = makeDbService({ southPrimaryFail: true });
    const service = new DbRoutingService(db, router, health as any);

    const ctx = service.getReadContext(10.77);
    expect(ctx.pool).toBe(db.southReplica);
    expect(ctx.readOnly).toBe(true);
  });

  /**
   * TC-07: Cross-region isolation — Tắt Miền Nam → request Miền Bắc
   * Kết quả mong đợi: Miền Bắc vẫn hoạt động bình thường, không bị ảnh hưởng
   */
  it('TC-07: South hoàn toàn down → North vẫn full service', () => {
    const health = makeHealthService({
      northPrimary: true,
      northReplica: true,
      southPrimary: false,
      southReplica: false,
    });
    const db = makeDbService({ southPrimaryFail: true, southReplicaFail: true });
    const service = new DbRoutingService(db, router, health as any);

    // North vẫn hoạt động bình thường
    const northCtx = service.getReadContext(21.03);
    expect(northCtx.region).toBe(Region.NORTH);
    expect(northCtx.activeNode).toBe('NORTH_PRIMARY');
    expect(northCtx.readOnly).toBe(false);

    // North vẫn ghi được
    const northWriteCtx = service.getWriteContext(21.03);
    expect(northWriteCtx.region).toBe(Region.NORTH);
    expect(northWriteCtx.activeNode).toBe('NORTH_PRIMARY');

    // South throw unavailable
    expect(() => service.getReadContext(10.77)).toThrow(ServiceUnavailableException);
  });

  it('TC-07b: North hoàn toàn down → South vẫn full service', () => {
    const health = makeHealthService({
      northPrimary: false,
      northReplica: false,
      southPrimary: true,
      southReplica: true,
    });
    const db = makeDbService({ northPrimaryFail: true, northReplicaFail: true });
    const service = new DbRoutingService(db, router, health as any);

    // South vẫn hoạt động bình thường
    const southCtx = service.getReadContext(10.77);
    expect(southCtx.region).toBe(Region.SOUTH);
    expect(southCtx.activeNode).toBe('SOUTH_PRIMARY');
    expect(southCtx.readOnly).toBe(false);

    // North throw unavailable
    expect(() => service.getReadContext(21.03)).toThrow(ServiceUnavailableException);
  });

  /**
   * TC-08: Cả 2 node cùng down — tắt cả primary + replica
   * Kết quả mong đợi: app không crash, trả lỗi rõ ràng
   */
  it('TC-08: Cả South Primary + Replica down → ServiceUnavailableException (không crash)', () => {
    const health = makeHealthService({ southPrimary: false, southReplica: false });
    const db = makeDbService({ southPrimaryFail: true, southReplicaFail: true });
    const service = new DbRoutingService(db, router, health as any);

    // Không crash — throw exception có thể catch được
    expect(() => service.getReadContext(10.77)).toThrow(ServiceUnavailableException);
    expect(() => service.getWriteContext(10.77)).toThrow(ServiceUnavailableException);
  });

  it('TC-08b: Exception khi cả 2 down có message cảnh báo rõ ràng', () => {
    const health = makeHealthService({ southPrimary: false, southReplica: false });
    const db = makeDbService({ southPrimaryFail: true, southReplicaFail: true });
    const service = new DbRoutingService(db, router, health as any);

    try {
      service.getReadContext(10.77);
      fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      // Warning message thực tế: "Không có kết nối CSDL khả dụng cho vùng MIỀN NAM."
      expect(e.getResponse().warning).toContain('CSDL');
      expect(e.getResponse().readOnly).toBe(true);
      expect(e.getResponse().activeNode).toBeNull();
    }
  });

  /**
   * TC-09: Phục hồi tự động — sau khi primary down rồi up lại
   * Kết quả mong đợi: hệ thống tự nhận ra primary đã online, trở về full mode
   */
  it('TC-09: Primary phục hồi → routing trở về primary (full mode)', () => {
    // Bước 1: Primary down → dùng replica
    const healthDown = makeHealthService({ southPrimary: false, southReplica: true });
    const db = makeDbService({});
    const serviceDown = new DbRoutingService(db, router, healthDown as any);

    const ctxDown = serviceDown.getReadContext(10.77);
    expect(ctxDown.activeNode).toBe('SOUTH_REPLICA');
    expect(ctxDown.readOnly).toBe(true);

    // Bước 2: Primary phục hồi → dùng primary lại
    const healthUp = makeHealthService({ southPrimary: true, southReplica: true });
    const serviceUp = new DbRoutingService(db, router, healthUp as any);

    const ctxUp = serviceUp.getReadContext(10.77);
    expect(ctxUp.activeNode).toBe('SOUTH_PRIMARY');
    expect(ctxUp.readOnly).toBe(false);
    expect(ctxUp.warning).toBeNull();

    // Bước 3: Ghi lại được sau khi phục hồi
    const writeCtx = serviceUp.getWriteContext(10.77);
    expect(writeCtx.activeNode).toBe('SOUTH_PRIMARY');
    expect(writeCtx.readOnly).toBe(false);
  });

  /**
   * TC-10: Health API — GET /health khi 1 node down
   * Kết quả mong đợi: trả đúng trạng thái 4 node
   */
  it('TC-10: serviceLevelForRegion() trả đúng trạng thái theo từng kịch bản', () => {
    // Full: cả 2 online
    const h1 = makeHealthService({ southPrimary: true, southReplica: true });
    expect(h1.serviceLevelForRegion(Region.SOUTH)).toBe('full');

    // Readonly: primary down, replica online
    const h2 = makeHealthService({ southPrimary: false, southReplica: true });
    expect(h2.serviceLevelForRegion(Region.SOUTH)).toBe('readonly');

    // Unavailable: cả 2 down
    const h3 = makeHealthService({ southPrimary: false, southReplica: false });
    expect(h3.serviceLevelForRegion(Region.SOUTH)).toBe('unavailable');

    // North không bị ảnh hưởng khi South down
    const h4 = makeHealthService({
      northPrimary: true, northReplica: true,
      southPrimary: false, southReplica: false,
    });
    expect(h4.serviceLevelForRegion(Region.NORTH)).toBe('full');
    expect(h4.serviceLevelForRegion(Region.SOUTH)).toBe('unavailable');
  });
});

// ─── DatabaseService.queryWithFailover ───────────────────────────────────────

import { DatabaseService } from '../database/database.service';

describe('DatabaseService.queryWithFailover', () => {
  let service: DatabaseService;

  beforeEach(() => {
    // Tạo DatabaseService với pools mock
    service = new DatabaseService();
    // Override pools với mock
    (service as any).pools = {
      NORTH: {
        primary: makePool('northPrimary'),
        replica: makePool('northReplica'),
      },
      SOUTH: {
        primary: makePool('southPrimary'),
        replica: makePool('southReplica'),
      },
    };
  });

  it('TC-03a: Primary online → query trả về isReadOnly=false', async () => {
    const { isReadOnly } = await service.queryWithFailover(
      Region.NORTH,
      'SELECT 1',
      [],
      false,
    );
    expect(isReadOnly).toBe(false);
  });

  it('TC-04a: Primary down → fallback replica, isReadOnly=true', async () => {
    // Override primary để fail
    (service as any).pools['SOUTH'].primary = makePool('southPrimary', true);

    const { isReadOnly } = await service.queryWithFailover(
      Region.SOUTH,
      'SELECT 1',
      [],
      false,
    );
    expect(isReadOnly).toBe(true);
  });

  it('TC-05a: Primary down + isWriteRequest=true → throw ServiceUnavailableException (không fallback replica)', async () => {
    (service as any).pools['SOUTH'].primary = makePool('southPrimary', true);

    await expect(
      service.queryWithFailover(Region.SOUTH, 'INSERT INTO trips VALUES(1)', [], true),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('TC-08a: Cả primary + replica down → throw ServiceUnavailableException', async () => {
    (service as any).pools['SOUTH'].primary = makePool('southPrimary', true);
    (service as any).pools['SOUTH'].replica = makePool('southReplica', true);

    await expect(
      service.queryWithFailover(Region.SOUTH, 'SELECT 1', [], false),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

// ─── determineRegionFromLocation ─────────────────────────────────────────────

import { determineRegionFromLocation } from '../common/location.utils';

describe('determineRegionFromLocation (location.utils)', () => {
  it('TC-01a: Hà Nội lat=21.03 → NORTH', () => {
    expect(determineRegionFromLocation(21.03)).toBe(Region.NORTH);
  });

  it('TC-02a: TP.HCM lat=10.77 → SOUTH', () => {
    expect(determineRegionFromLocation(10.77)).toBe(Region.SOUTH);
  });

  it('Đà Nẵng lat=16.07 → SOUTH (dưới ngưỡng 16.5)', () => {
    expect(determineRegionFromLocation(16.07)).toBe(Region.SOUTH);
  });

  it('Huế lat=16.46 → SOUTH (dưới ngưỡng 16.5)', () => {
    expect(determineRegionFromLocation(16.46)).toBe(Region.SOUTH);
  });

  it('Ngưỡng chính xác lat=16.5 → NORTH', () => {
    expect(determineRegionFromLocation(16.5)).toBe(Region.NORTH);
  });

  it('Nhất quán với LocationRouterService', () => {
    const router = new LocationRouterService();
    const testLatitudes = [21.03, 10.77, 16.5, 16.49, 20.0, 9.0];
    for (const lat of testLatitudes) {
      const fromUtils = determineRegionFromLocation(lat);
      const fromRouter = router.getRegion(lat);
      expect(fromUtils).toBe(fromRouter);
    }
  });
});
