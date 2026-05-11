import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsString()
  @IsOptional()
  driver_id?: string;

  @IsBoolean()
  is_available: boolean;

  // Thuộc tính khu vực sẽ do client truyền lên (ưu tiên) hoặc truy vấn bổ sung (giả định ở đây frontend biết Region vì đã login)
  @IsString()
  @IsOptional()
  region?: string;
}
