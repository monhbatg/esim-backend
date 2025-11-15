export interface InvoiceRequest extends Request {
  invoice_code: string;
  sender_invoice_no: string;
  invoice_receiver_code: string;
  sender_branch_code: string;
  invoice_description: string;
  enable_expiry: boolean;
  allow_partial: boolean;
  minimum_amount: number | null;
  allow_exceed: boolean;
  maximum_amount: number | null;
  amount: number;
  callback_url: string;
  sender_staff_code: string;
  sender_terminal_code: string | null;
  sender_terminal_data: { name: string | null };
  allow_subscribe: boolean;
  note: string | null;
  transactions: Array<{
    description: string;
    amount: string;
    accounts: Array<{
      account_bank_code: string;
      account_name: string;
      account_number: string;
      iban_number: string;
      account_currency: string;
      is_default: boolean;
    }>;
  }>;
  invoice_receiver_data: {
    register: string;
    name: string;
    email: string;
    phone: string;
  };
}