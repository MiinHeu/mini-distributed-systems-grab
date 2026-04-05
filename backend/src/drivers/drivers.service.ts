import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { determineRegionFromLocation, Region } from '../common/location.utils';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { GetNearbyDriversDto } from './dto/get-nearby.dto';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Cập nhật vị trí GPS (10s 1 lần)
   */
  async updateLocation(dto: UpdateLocationDto) {
    const region = determineRegionFromLocation(dto.latitude);
    const query = `
      UPDATE drivers 
      SET latitude = $1, longitude = $2, region = $3 
      WHERE id = $4
      RETURNING *;
    `;
    const values = [dto.latitude, dto.longitude, region, dto.driver_id];

    // isWriteRequest = true -> Bắt buộc dùng Primary. Nếu sập sẽ throw error cho client xử lý.
    const { result } = await this.db.queryWithFailover(region, query, values, true);

    if (result.rowCount === 0) {
      throw new NotFoundException(`Không tìm thấy tài xế ${dto.driver_id}`);
    }

    return {
      message: 'Đã cập nhật vị trí',
      driver: result.rows[0],
      region_routed_to: region,
    };
  }

  /**
   * Cập nhật trạng thái rảnh/bận
   */
  async updateAvailability(dto: UpdateAvailabilityDto) {
    // Nếu Frontend không gửi Region thì mặc định phải lấy từ DB -> Cần 1 bước lấy thông tin để tự map Region (giả lập query cả 2 node nếu ko biết)
    // Ở đây ta tối giản, giả sử frontend đã có Region khi driver đăng nhập.
    const region = (dto.region as Region) || Region.NORTH; // Default test

    const query = `
      UPDATE drivers 
      SET is_available = $1 
      WHERE id = $2
      RETURNING *;
    `;
    const values = [dto.is_available, dto.driver_id];

    const { result } = await this.db.queryWithFailover(region, query, values, true);

    if (result.rowCount === 0) {
      throw new NotFoundException('Driver not found');
    }

    return {
      message: dto.is_available ? 'Đang sẵn sàng đón khách' : 'Đã nghỉ/bận',
      region_routed_to: region,
    };
  }

  /**
   * Tìm tài xế lân cận
   */
  async getNearbyDrivers(dto: GetNearbyDriversDto) {
    const region = determineRegionFromLocation(dto.lat);
    const radiusMeters = (dto.radius_km || 5) * 1000;

    const query = `
      SELECT id, user_id, vehicle_plate, vehicle_type, rating, latitude, longitude,
        (earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) / 1000)::numeric(10,2) AS distance_km
      FROM drivers
      WHERE is_available = true 
        AND vehicle_type = $3
        AND earth_box(ll_to_earth($1, $2), $4) @> ll_to_earth(latitude, longitude)
        AND earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) <= $4
      ORDER BY 
        distance_km ASC, rating DESC
      LIMIT 10;
    `;
    const values = [dto.lat, dto.lng, dto.vehicle_type, radiusMeters];

    // isWriteRequest = false -> Được phép Fallback Read-Only Mode bằng Replica nếu Primary sập
    const { result, isReadOnly } = await this.db.queryWithFailover(region, query, values, false);

    return {
      metadata: {
        region_routed_to: region,
        is_read_only_fallback: isReadOnly,
        total_found: result.rowCount,
      },
      data: result.rows,
    };
  }

  /**
   * Truy xuất thông tin tài xế theo ID
   */
  async getDriverById(id: string, region: Region = Region.NORTH) {
    // Lý tưởng là query ở bảng users Global. Ở đây test với bảng Drivers phân mảnh ngầm định.
    const query = `SELECT * FROM drivers WHERE id = $1`;
    try {
      // Cố gọi 1 Region trước, nếu không có gọi Region kia
      let res = await this.db.queryWithFailover(region, query, [id], false);
      if (res.result.rowCount === 0) {
        const fallBackRegion = region === Region.NORTH ? Region.SOUTH : Region.NORTH;
        res = await this.db.queryWithFailover(fallBackRegion, query, [id], false);
      }
      
      if (res.result.rowCount === 0) {
        throw new NotFoundException('Không tìm thấy tài xế này trên bất kỳ CSDL nào.');
      }

      return res.result.rows[0];

    } catch (e) {
      throw e;
    }
  }
}
