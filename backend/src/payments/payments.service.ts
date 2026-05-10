import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Region } from '../common/location.utils';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(private readonly db: DatabaseService) {}

  private sortObject(obj: Record<string, string>) {
    const sorted: Record<string, string> = {};
    Object.keys(obj).sort().forEach(key => { sorted[key] = obj[key]; });
    return sorted;
  }

  private createSignature(data: Record<string, string>, secret: string): string {
    const signData = new URLSearchParams(this.sortObject(data)).toString();
    return crypto.createHmac('sha512', secret).update(signData).digest('hex');
  }

  private async findTripRegion(tripId: number): Promise<{ trip: any; region: Region } | null> {
    for (const region of [Region.SOUTH, Region.NORTH]) {
      try {
        const { result } = await this.db.queryWithFailover(
          region,
          `SELECT * FROM trips WHERE id = $1`,
          [tripId],
          false,
        );
        if (result.rows.length > 0) return { trip: result.rows[0], region };
      } catch { /* thử region kia */ }
    }
    return null;
  }

  async createPayment(body: any, _userId: number) {
    const { trip_id, method } = body;

    const found = await this.findTripRegion(trip_id);
    if (!found) throw new NotFoundException('Chuyến đi không tồn tại');

    const { trip, region } = found;
    const amount = trip.fare || 50000;

    if (method === 'cash') {
      const { result } = await this.db.queryWithFailover(
        region,
        `INSERT INTO payments (trip_id, amount, method, status)
         VALUES ($1, $2, 'cash', 'completed') RETURNING *`,
        [trip_id, amount],
        true,
      );
      return { message: 'Thanh toán tiền mặt thành công', payment: result.rows[0] };
    }

    // VNPay
    const tmnCode = process.env.VNPAY_TMN_CODE ?? 'DEMO';
    const secretKey = process.env.VNPAY_HASH_SECRET ?? 'DEMO_SECRET';
    const vnpUrl = process.env.VNPAY_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl = process.env.VNPAY_RETURN_URL ?? 'http://localhost:3000/payments/callback';

    const createDate = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const orderId = `${trip_id}-${Date.now()}`;

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: tmnCode,
      vnp_Amount: String(amount * 100), vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND', vnp_IpAddr: '127.0.0.1', vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan chuyen di ${trip_id}`,
      vnp_OrderType: 'other', vnp_ReturnUrl: returnUrl, vnp_TxnRef: orderId,
    };

    vnpParams['vnp_SecureHash'] = this.createSignature(vnpParams, secretKey);
    const paymentUrl = `${vnpUrl}?${new URLSearchParams(vnpParams).toString()}`;

    const { result } = await this.db.queryWithFailover(
      region,
      `INSERT INTO payments (trip_id, amount, method, status)
       VALUES ($1, $2, 'vnpay', 'pending') RETURNING *`,
      [trip_id, amount],
      true,
    );

    return { message: 'Tạo link thanh toán thành công', paymentUrl, payment: result.rows[0] };
  }

  async handleCallback(query: Record<string, string>) {
    const secureHash = query['vnp_SecureHash'];
    const responseCode = query['vnp_ResponseCode'];
    const txnRef = query['vnp_TxnRef'];
    const transactionId = query['vnp_TransactionNo'];
    const secretKey = process.env.VNPAY_HASH_SECRET ?? 'DEMO_SECRET';

    const params = { ...query };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    if (this.createSignature(params, secretKey) !== secureHash) {
      return { message: 'Chữ ký không hợp lệ', code: '97' };
    }

    const tripId = txnRef.split('-')[0];
    const region = Region.SOUTH; // payments thường ở South, fallback OK

    if (responseCode === '00') {
      await this.db.queryWithFailover(
        region,
        `UPDATE payments SET status = 'completed', vnpay_transaction_id = $1
         WHERE trip_id = $2 AND method = 'vnpay' AND status = 'pending'`,
        [transactionId, tripId],
        true,
      );
      return { message: 'Thanh toán thành công', code: '00' };
    } else {
      await this.db.queryWithFailover(
        region,
        `UPDATE payments SET status = 'failed'
         WHERE trip_id = $1 AND method = 'vnpay' AND status = 'pending'`,
        [tripId],
        true,
      );
      return { message: 'Thanh toán thất bại', code: responseCode };
    }
  }

  async getPaymentByTrip(tripId: number) {
    for (const region of [Region.SOUTH, Region.NORTH]) {
      try {
        const { result } = await this.db.queryWithFailover(
          region,
          `SELECT * FROM payments WHERE trip_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [tripId],
          false,
        );
        if (result.rows.length > 0) return result.rows[0];
      } catch { /* thử region kia */ }
    }
    throw new NotFoundException('Không tìm thấy thông tin thanh toán');
  }

  async getPaymentHistory(userId: number) {
    const all: any[] = [];
    for (const region of [Region.SOUTH, Region.NORTH]) {
      try {
        const { result } = await this.db.queryWithFailover(
          region,
          `SELECT p.*, t.pickup_address, t.dropoff_address, u.name as customer_name
           FROM payments p
           JOIN trips t ON p.trip_id = t.id
           JOIN users u ON t.customer_id = u.id
           WHERE u.id = $1
           ORDER BY p.created_at DESC`,
          [userId],
          false,
        );
        all.push(...result.rows);
      } catch { /* skip */ }
    }
    return all;
  }

  async getAllPayments(status?: string) {
    const all: any[] = [];
    for (const region of [Region.SOUTH, Region.NORTH]) {
      try {
        const query = status
          ? `SELECT p.*, t.pickup_address, t.dropoff_address, u.name as customer_name
             FROM payments p JOIN trips t ON p.trip_id = t.id JOIN users u ON t.customer_id = u.id
             WHERE p.status = $1 ORDER BY p.created_at DESC`
          : `SELECT p.*, t.pickup_address, t.dropoff_address, u.name as customer_name
             FROM payments p JOIN trips t ON p.trip_id = t.id JOIN users u ON t.customer_id = u.id
             ORDER BY p.created_at DESC`;
        const { result } = await this.db.queryWithFailover(
          region, query, status ? [status] : [], false,
        );
        all.push(...result.rows);
      } catch { /* skip */ }
    }
    return all;
  }
}
