export enum Region {
  NORTH = 'NORTH',
  SOUTH = 'SOUTH',
}

/**
 * Ngưỡng phân vùng: vĩ độ >= 16.5 → Miền Bắc, < 16.5 → Miền Nam
 * Thống nhất với LocationRouterService.getRegion()
 * Vĩ độ 16.5 ≈ ranh giới Thừa Thiên Huế / Đà Nẵng
 */
export const REGION_LATITUDE_THRESHOLD = 16.5;

export function determineRegionFromLocation(latitude: number): Region {
  return latitude >= REGION_LATITUDE_THRESHOLD ? Region.NORTH : Region.SOUTH;
}
