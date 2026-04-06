import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminService {

  getAllUsers() {
    return [
      { id: '1', name: 'Nguyen Van A', email: 'a@gmail.com', role: 'customer', is_suspended: false },
      { id: '2', name: 'Tran Thi B', email: 'b@gmail.com', role: 'driver', is_suspended: false },
      { id: '3', name: 'Le Van C', email: 'c@gmail.com', role: 'admin', is_suspended: false },
    ];
  }

  getDrivers(region?: string) {
    const drivers = [
      { id: '1', name: 'Tran Van X', vehicle_plate: '51A-123', region: 'NORTH', is_available: true },
      { id: '2', name: 'Le Thi Y', vehicle_plate: '29B-456', region: 'SOUTH', is_available: false },
    ];

    if (region) {
      return drivers.filter(d => d.region === region.toUpperCase());
    }
    return drivers;
  }

  unsuspendUser(id: string) {
  return { message: `Đã mở khóa user ${id}`, id, is_suspended: false };
}

  suspendUser(id: string) {
    return { message: `Đã khóa tài khoản user ${id}`, id, is_suspended: true };
  }

  deleteUser(id: string) {
    return { message: `Đã xóa user ${id}`, id };
  }
}