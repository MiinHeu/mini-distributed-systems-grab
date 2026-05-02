import { Controller, Get, Patch, Delete, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Danh sách tất cả user' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách tất cả user' })
  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @ApiOperation({ summary: 'Danh sách tài xế, có thể lọc theo vùng' })
  @ApiQuery({ name: 'region', required: false, description: 'NORTH hoặc SOUTH' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách tài xế' })
  @Get('drivers')
  getDrivers(@Query('region') region?: string) {
    return this.adminService.getDrivers(region);
  }

  @ApiOperation({ summary: 'Khóa tài khoản user' })
  @ApiParam({ name: 'id', description: 'ID của user cần khóa' })
  @ApiResponse({ status: 200, description: 'Khóa tài khoản thành công' })
  @Patch('users/:id/suspend')
  suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @ApiOperation({ summary: 'Mở khóa tài khoản user' })
  @ApiParam({ name: 'id', description: 'ID của user cần mở khóa' })
  @ApiResponse({ status: 200, description: 'Mở khóa thành công' })
  @Patch('users/:id/unsuspend')
  unsuspendUser(@Param('id') id: string) {
    return this.adminService.unsuspendUser(id);
  }

  @ApiOperation({ summary: 'Xóa user' })
  @ApiParam({ name: 'id', description: 'ID của user cần xóa' })
  @ApiResponse({ status: 200, description: 'Xóa user thành công' })
  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}