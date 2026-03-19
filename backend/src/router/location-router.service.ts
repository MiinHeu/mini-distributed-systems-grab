import { Injectable } from '@nestjs/common';

@Injectable()
export class LocationRouterService {
  getRegion(latitude: number): 'north' | 'south' {
    if (latitude >= 16.5) {
      return 'north';
    }

    return 'south';
  }
}
