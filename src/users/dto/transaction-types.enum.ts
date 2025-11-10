/**
 * Transaction types for future TransactionModule integration
 * This enum can be used to categorize different types of wallet transactions
 */
export enum TransactionType {
  /** Adding funds to wallet (top-up) */
  DEPOSIT = 'DEPOSIT',
  /** Deducting funds from wallet (purchase, payment) */
  WITHDRAWAL = 'WITHDRAWAL',
  /** Refund to wallet */
  REFUND = 'REFUND',
  /** Transfer between users */
  TRANSFER = 'TRANSFER',
  /** Adjustment (admin correction) */
  ADJUSTMENT = 'ADJUSTMENT',
}

/**
 * Transaction status for future TransactionModule integration
 */
export enum TransactionStatus {
  /** Transaction is pending */
  PENDING = 'PENDING',
  /** Transaction completed successfully */
  COMPLETED = 'COMPLETED',
  /** Transaction failed */
  FAILED = 'FAILED',
  /** Transaction was cancelled */
  CANCELLED = 'CANCELLED',
}

