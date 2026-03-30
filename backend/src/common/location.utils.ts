export enum Region {
  NORTH = 'NORTH',
  SOUTH = 'SOUTH',
}

export function determineRegionFromLocation(latitude: number): Region {
  // Ranh giới tương đối: Vĩ độ > 16.0 (khoảng Đà Nẵng) là Miền Bắc, ngược lại là Miền Nam
  return latitude > 16.0 ? Region.NORTH : Region.SOUTH;
}
