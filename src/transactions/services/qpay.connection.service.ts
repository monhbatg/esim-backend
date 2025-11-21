import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { TokenResponse } from "../dto/token.response.dto";
import { ApiDataObject } from "src/inquiry/dto/data-package.dto";
import { TopupEsim } from "../dto/esimtopup.resquest.dto";

interface InvoiceRequest {
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
  invoice_receiver_data: {
    register: string;
    name: string;
    email: string;
    phone: string;
  };
}

interface InvoiceResponse {
  invoice_id: string;
  qr_image: string;
  qr_link: string;
  // add other response fields as needed
}

interface PaymentCheckRequest {
  object_type: string;
  object_id: string;
  offset: {
    "page_number": number,
    "page_limit":number
  };
  // add other response fields as needed
}

interface ApiResponse {
  errorCode: string | null;
  errorMsg: string | null;
  success: boolean;
  obj: ApiDataObject;
}

@Injectable()
export class QpayConnectionService {
    
    private readonly logger = new Logger(QpayConnectionService.name);
    private readonly qpayBaseUrl = process.env.QPAY_API_URL;
    private readonly qpayUser = process.env.QPAY_API_USER;
    private readonly qpaySecret = process.env.QPAY_API_SECRET;
    private readonly qpayInvoiceCode = process.env.QPAY_INVOICE_CODE;
    private readonly apiBaseUrl = 'https://api.esimaccess.com/api/v1';
    private readonly accessCode = process.env.ESIM_ACCESS_CODE;

    constructor(
        private readonly httpService: HttpService
    ) {
      // Validate env vars on service creation
      if (!this.qpayUser || !this.qpaySecret) {
        throw new Error('Missing QPAY_API_USER or QPAY_API_SECRET in .env');
      }
      }

    async getToken(): Promise<TokenResponse> {
        try {
            const url = `${this.qpayBaseUrl}/auth/token`;
            this.logger.log(`Fetching token from: ${url}`);
            
            const response: any = await firstValueFrom(
                this.httpService.post<TokenResponse>(
                    url,
                    {},
                    {
                        auth: {
                            username: this.qpayUser!, 
                            password: this.qpaySecret!
                        },
                        headers: {
                            'Authorization': 'Basic' ,
                            'Content-Type': 'application/json',
                        }
                    }
                )
            );

            this.logger.log(`Token fetched successfully ${response.access_token}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching token: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async createInvoice(invoiceData: InvoiceRequest): Promise<InvoiceResponse> {
        try {
            this.logger.log(`Creating invoice: ${invoiceData.invoice_code}`);
            invoiceData = InvoiceBuilder(invoiceData);
            // Get bearer token
            const token = await this.getToken();
            this.logger.log(`Using access token: ${token.access_token}`);

            // Construct invoice endpoint (adjust URL path if needed)
            const invoiceUrl = `${this.qpayBaseUrl}/invoice`;
            
            const response: any = await firstValueFrom(
                this.httpService.post<InvoiceResponse>(
                    invoiceUrl,
                    invoiceData,
                    {
                        headers: {
                            'Authorization': `Bearer ${token.access_token}`,
                            'Content-Type': 'application/json',
                        },
                    }
                )
            );

            this.logger.log(`Invoice created successfully. invoice_id: ${response.data.invoice_id}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Error creating invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async checkInvoice(invoiceId: string): Promise<any> {
    try {
      this.logger.log(`Checking invoice status: ${invoiceId}`);

      // Get bearer token
      const token = await this.getToken();

      // Construct check invoice endpoint
      const checkUrl = `${this.qpayBaseUrl}/payment/check`;
      
      const response: any = await firstValueFrom(
        this.httpService.post<any>(
          checkUrl,
          {
            object_type: 'INVOICE',
            object_id: invoiceId,
            offset: {
              "page_number": 1,
              "page_limit": 100
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )
      );

      this.logger.log(`Invoice status retrieved. invoice_id: ${invoiceId}, status: ${response.data.status}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error checking invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async orderEsim() {
    const url = `${this.apiBaseUrl}/open/esim/order`;
      this.logger.log(`Fetching data packages from: ${url}`);
      const response: any = await firstValueFrom(
          this.httpService.post<ApiResponse>(
              url,
              {
                transactionId: `GOY_SIM-2025111511`,
                amount: 17000,
                packageInfoList: [
                  {
                    packageCode: 'JC053',
                    count: 1,
                    price: 17000
                  }
                ]
              },
              {
                  headers: {
                    'RT-AccessCode': this.accessCode,
                    'Content-Type': 'application/json',
                  }
              }
          )
      );
      const data: ApiResponse = response.data;
      return data;
  }

  async topupEsim(body: TopupEsim): Promise<ApiResponse> {
    const url = `${this.apiBaseUrl}/open/esim/topup`;
      this.logger.log(`Fetching data packages from: ${url}`);
      const response: any = await firstValueFrom(
          this.httpService.post<ApiResponse>(
              url,
              {
                esimTranNo: body.esimTranNo,
                iccid: "",
                packageCode: body.packageCode,
                transactionId: body.transactionId
              },
              {
                  headers: {
                    'RT-AccessCode': this.accessCode,
                    'Content-Type': 'application/json',
                  }
              }
          )
      );
      const data: ApiResponse = response.data;
      return data;
  }
}

function InvoiceBuilder(invoiceData: InvoiceRequest): InvoiceRequest {
    return {
        invoice_code: this.qpayInvoiceCode,
        sender_invoice_no:  `GOY_SIM-${Date.now()}`,  // baiguullagaas uusgeh dahin dawtagdashgui dugaar
        invoice_receiver_code: 'GOY_SIM',
        sender_branch_code: 'BRANCH001',
        invoice_description: 'Default Invoice Description',
        enable_expiry: false,
        allow_partial: false,
        minimum_amount:  null,
        allow_exceed:  false,
        maximum_amount:  null,
        amount: 100,
        callback_url: '',
        sender_staff_code: 'online',
        sender_terminal_code:  null,
        sender_terminal_data:  { name: null },
        allow_subscribe: false,
        note: null,
        invoice_receiver_data:  {
            register: 'AYU90031965',
            name: 'JAVKHLANTUGS BAATARSUKH',
            email: 'ESIMGOY@GMAIL.com',
            phone: '99017586'
        }
    };
}
