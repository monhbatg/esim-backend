import { v4 as uuidv4 } from 'uuid';

export class Util {
  static generateInvoiceId(length: number = 12): string {
    return uuidv4().replace(/-/g, '').substring(0, length).toUpperCase();
  }

  static selectUrl(actionId: number): string {
    switch (actionId) {
      case 1:
        return '/open/esim/cancel';
      case 2:
        return '/open/esim/suspend';
      case 3:
        return '/open/esim/unsuspend';
      case 4:
        return '/open/esim/revoke';
      default:
        throw new Error('Invalid action ID');
    }
  }
}
