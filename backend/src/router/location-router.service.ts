import { Injectable } from '@nestjs/common';
import { REGION_LATITUDE_THRESHOLD, Region } from '../common/location.utils';

@Injectable()
export class LocationRouterService {
  /**
   * Xác định region dựa trên vĩ độ.
   * Ngưỡng: >= 16.5 → NORTH (Miền Bắc), < 16.5 → SOUTH (Miền Nam)
   * Thống nhất với determineRegionFromLocation() trong location.utils.ts
   */
  getRegion(latitude: number): Region {
    if (latitude >= REGION_LATITUDE_THRESHOLD) {
      return Region.NORTH;
    }
    return Region.SOUTH;
  }
}
