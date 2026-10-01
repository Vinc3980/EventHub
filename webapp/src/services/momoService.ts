import { db } from '../db/db';
import { Payment, type PaymentStatus } from '../models';
import { id } from '../lib/ids';

export interface MomoRequest {
  bookingId: string;
  amount: number;
}

export interface MomoRequestResult {
  paymentId: string;
  bookingId: string;
  amount: number;
  momoRef: string;
  platformFee: number;
  organizerPayout: number;
  status: PaymentStatus;
}

export class MomoService {
  private constructor() {}

  static async requestPayment(request: MomoRequest): Promise<MomoRequestResult> {
    const paymentId = id('pay');
    const payment = new Payment({
      id: paymentId,
      bookingId: request.bookingId,
      amount: request.amount,
      status: 'pending',
    });
    // SIMULATED
    console.log('MoMo payments must be initiated server-side via Cloud Functions.');
    await db.payments.put({ ...payment.toMap(), id: paymentId });
    return {
      paymentId,
      bookingId: payment.bookingId,
      amount: payment.amount,
      momoRef: payment.momoRef,
      platformFee: payment.platformFee,
      organizerPayout: payment.organizerPayout,
      status: payment.status,
    };
  }
}
