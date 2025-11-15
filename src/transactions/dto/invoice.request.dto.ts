export interface InvoiceRequest extends Request {
    email: string;
    phone: string;
    amount: number;
    packageCode: string;
}

