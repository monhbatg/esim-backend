/**
 * Wallet module constants
 */
export const WALLET_CONSTANTS = {
  /** Maximum balance allowed in wallet (1 million) */
  MAX_BALANCE: 1_000_000,
  /** Minimum amount for transactions */
  MIN_AMOUNT: 0.01,
  /** Maximum amount per transaction */
  MAX_AMOUNT: 100_000,
  /** Default currency */
  DEFAULT_CURRENCY: 'USD',
  /** Supported currencies */
  SUPPORTED_CURRENCIES: ['USD', 'EUR', 'GBP', 'JPY', 'CNY'],
  /** Retry attempts for optimistic locking conflicts */
  MAX_RETRY_ATTEMPTS: 3,
  /** Retry delay in milliseconds */
  RETRY_DELAY_MS: 100,
} as const;

