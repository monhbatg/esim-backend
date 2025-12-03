export interface InvoiceReceiverData {
  register: string;
  name: string;
  email: string;
  phone: string;
}

export interface InvoiceTransactionAccount {
  account_bank_code: string;
  account_name: string;
  account_number: string;
  iban_number: string;
  account_currency: string;
  is_default: boolean;
}

export interface InvoiceTransaction {
  description: string;
  amount: string;
  accounts: InvoiceTransactionAccount[];
}

export interface InvoiceRequest {
  invoice_code: string;
  sender_invoice_no: string;
  sender_branch_code?: string;
  sender_branch_data?: Record<string, any>;
  sender_staff_data?: Record<string, any>;
  sender_staff_code?: string;
  invoice_receiver_code: string;
  invoice_receiver_data: InvoiceReceiverData;
  invoice_description: string;
  tax_type: string;
  enable_expiry?: boolean;
  allow_partial?: boolean;
  minimum_amount?: number | null;
  allow_exceed?: boolean;
  maximum_amount?: number | null;
  amount?: number;
  callback_url: string;
  sender_terminal_code?: string;
  sender_terminal_data?: { name: string | null };
  allow_subscribe?: boolean;
  subscription_interval?: string;
  subscription_webhook?: string;
  note?: string;
  transactions?: InvoiceTransaction[];
}
