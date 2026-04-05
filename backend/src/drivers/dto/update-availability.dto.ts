import { IsBoolean, IsUUID } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsUUID()
  driver_id: string;

  @IsBoolean()
  is_available: boolean;

  // Thuộc tính khu vực sẽ do client truyền lên (ưu tiên) hoặc truy vấn bổ sung (giả định ở đây frontend biết Region vì đã login)
  region?: string; 
}
