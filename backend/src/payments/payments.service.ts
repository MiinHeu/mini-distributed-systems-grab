import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectDataSource('primary') private primaryDS: DataSource,
  ) {}

  private sortObject(obj: Record<string, string>) {
    const sorted: Record<string, string> = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = obj[key];
    });
    return sorted;
  }

  private createSignature(data: Record<string, string>, secret: string): string {
    const sortedData = this.sortObject(data);
    const signData = new URLSearchParams(sortedData).toString();
    return crypto
      .createHmac('sha512', secret)
      .update(signData)
      .digest('hex');
  }

  async createPayment(body: any, userId: number) {
    const { trip_id, method } = body;

    // Kiểm tra trip tồn tại
    const trip = await this.primaryDS.query(
      `SELECT * FROM trips WHERE id = $1`,
      [trip_id],
    );

    if (!trip.length) {
      throw new NotFoundException('Chuyến đi không tồn tại');
    }

    const amount = trip[0].fare || 50000; // mặc định 50k nếu chưa có fare

    // Thanh toán tiền mặt
    if (method === 'cash') {
      const result = await this.primaryDS.query(
        `INSERT INTO payments (trip_id, amount, method, status)
         VALUES ($1, $2, 'cash', 'completed')
         RETURNING *`,
        [trip_id, amount],
      );
      return {
        message: 'Thanh toán tiền mặt thành công',
        payment: result[0],
      };
    }

    // Thanh toán VNPay
    const tmnCode = process.env.VNPAY_TMN_CODE ?? 'DEMO';
    const secretKey = process.env.VNPAY_HASH_SECRET ?? 'DEMO_SECRET';
    const vnpUrl = process.env.VNPAY_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl = process.env.VNPAY_RETURN_URL ?? 'http://localhost:3000/payments/callback';

    const date = new Date();
    const createDate = date.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const orderId = `${trip_id}-${Date.now()}`;

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(amount * 100), // VNPay tính theo đồng
      vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND',
      vnp_IpAddr: '127.0.0.1',
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan chuyen di ${trip_id}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: orderId,
    };

    const secureHash = this.createSignature(vnpParams, secretKey);
    vnpParams['vnp_SecureHash'] = secureHash;

    const paymentUrl = `${vnpUrl}?${new URLSearchParams(vnpParams).toString()}`;

    // Tạo bản ghi payment pending
    const result = await this.primaryDS.query(
      `INSERT INTO payments (trip_id, amount, method, status)
       VALUES ($1, $2, 'vnpay', 'pending')
       RETURNING *`,
      [trip_id, amount],
    );

    return {
      message: 'Tạo link thanh toán thành công',
      paymentUrl,
      payment: result[0],
    };
  }

  async handleCallback(query: Record<string, string>) {
    const secureHash = query['vnp_SecureHash'];
    const responseCode = query['vnp_ResponseCode'];
    const txnRef = query['vnp_TxnRef'];
    const transactionId = query['vnp_TransactionNo'];

    // Xác thực chữ ký
    const secretKey = process.env.VNPAY_HASH_SECRET ?? 'DEMO_SECRET';
    const params = { ...query };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    const checkHash = this.createSignature(params, secretKey);

    if (checkHash !== secureHash) {
      return { message: 'Chữ ký không hợp lệ', code: '97' };
    }

    // Lấy trip_id từ txnRef (format: tripId-timestamp)
    const tripId = txnRef.split('-')[0];

    if (responseCode === '00') {
      // Thanh toán thành công
      await this.primaryDS.query(
        `UPDATE payments 
         SET status = 'completed', vnpay_transaction_id = $1
         WHERE trip_id = $2 AND method = 'vnpay' AND status = 'pending'`,
        [transactionId, tripId],
      );
      return { message: 'Thanh toán thành công', code: '00' };
    } else {
      // Thanh toán thất bại
      await this.primaryDS.query(
        `UPDATE payments SET status = 'failed'
         WHERE trip_id = $1 AND method = 'vnpay' AND status = 'pending'`,
        [tripId],
      );
      return { message: 'Thanh toán thất bại', code: responseCode };
    }
  }

  async getPaymentByTrip(tripId: number) {
    const result = await this.primaryDS.query(
      `SELECT * FROM payments WHERE trip_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [tripId],
    );

    if (!result.length) {
      throw new NotFoundException('Không tìm thấy thông tin thanh toán');
    }

    return result[0];
  }
}
