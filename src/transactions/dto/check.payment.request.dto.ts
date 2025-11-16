export interface CheckPaymentRequest extends Request {
    invoiceId: string;
    packages: [
        {
            packageCode: string;
            quantity: number;
        }
    ];
}

