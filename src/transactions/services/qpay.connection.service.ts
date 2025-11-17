import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, BadRequestException, HttpException, HttpStatus } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { ApiDataObject } from "src/inquiry/dto/data-package.dto";
import { TokenResponse } from "../dto/token.response.dto";
import { TopupEsim } from "../dto/esimtopup.resquest.dto";
import { InvoiceRequest } from "../dto/invoice.request.dto";
import { EsimItem } from "../dto/esim.package.response.dto";
import { esimOrderResponse } from "../dto/esim.order.response.dto";
import { DataPackageEntity } from "src/entities/data-packages.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CheckPaymentRequest } from "../dto/check.payment.request.dto";

interface InvoiceQpayRequest {
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
    private readonly apiBaseUrl = 'https://api.esimaccess.com/api/v1';
    private readonly accessCode = process.env.ESIM_ACCESS_CODE;
    private readonly qpayInvoiceCode = process.env.QPAY_INVOICE_CODE;

    constructor(
      private readonly httpService: HttpService,
      @InjectRepository(DataPackageEntity)
      private readonly dataPackageRepo: Repository<DataPackageEntity>,
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
            // Construct invoice endpoint (adjust URL path if needed)
            const invoiceUrl = `${this.qpayBaseUrl}/invoice`;
            const token = await this.getToken();
            this.logger.log(`Using access token: ${token.access_token}`); // dahin dahin shine token uusgeh u ? neg duudsangaa DB deer hadgalaad awahu 

            const invoiceQpayData = InvoiceBuilder(invoiceData, this.qpayInvoiceCode!);
            const response: any = await firstValueFrom(
                this.httpService.post<InvoiceResponse>(
                    invoiceUrl,
                    invoiceQpayData,
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

    async checkInvoice(data: CheckPaymentRequest): Promise<any> {
    try {
      this.logger.log(`Checking invoice process: ${data.invoiceId}`);
      const token = await this.getToken();
      const checkUrl = `${this.qpayBaseUrl}/payment/check`;
      
      const response: any = await firstValueFrom(
        this.httpService.post<any>(
          checkUrl,
          {
            object_type: 'INVOICE',
            object_id: data.invoiceId,
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
      this.logger.log(`Invoice status retrieved. invoice_id: ${data.invoiceId}`);

      if(response.data.paid_amount){
        const packages = await this.dataPackageRepo.find({});
        const result: any = [];
        for(const pkg of data.packages){
          const packageCode = pkg.packageCode;
          const count = pkg.quantity;

          const currentPackage = packages.find(pkg => pkg.packageCode === packageCode);
          if (!currentPackage) {
            throw new BadRequestException('Invalid package code.');
          }

          const orderEsim = await this.orderEsimWeb(packageCode, currentPackage.price*count,count);
          this.logger.log(`eSIM ordered. orderNo: ${orderEsim.obj.orderNo}, orderAmount: ${currentPackage.price}`);
          await delay(500);
          const myEsimResponse: any = await this.getMyEsimPackages(1, 500);
          this.logger.log(`Retrieved my eSIM packages to find the ordered eSIM. + ${myEsimResponse}`);
          const found = myEsimResponse?.obj?.esimList?.find(
          (esim: EsimItem) =>
            esim.orderNo === orderEsim.obj.orderNo
          );
          if (found) {
            this.logger.log(`eSIM found in my packages. ICCID: ${found.iccid}`);
          }
          result.push(found);
        }
        return result;

      }
      else
        throw new BadRequestException('Төлбөр хийгдээгүй байна.');
    } catch (error) {
      this.logger.error(`Error checking invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getMyEsimPackages(page: number , limit: number): Promise<any[]> {
    try {
      const url = `${this.apiBaseUrl}/open/esim/query`;
      this.logger.log(`Fetching data packages from: ${url} , MY eSIM menu`);
      const response: any = await firstValueFrom(
        this.httpService.post<ApiResponse>(
          url,
          {
            orderNo: '',
            esimTranNo:'',
            iccid: '',
            pager: 
              { pageNum: page,
                pageSize: limit 
              }
          },
          {
            headers: {
              'RT-AccessCode': this.accessCode,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      this.logger.log(`Data packages fetched successfully from My eSIM menu`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to get My eSIM packages');
    }
  }

  private handleError(error: unknown, message: string): never {
    const errorMessage = this.getErrorMessage(error);
    this.logger.error(
      `${message}: ${errorMessage}`,
      error instanceof Error ? error.stack : undefined,
    );

    throw new HttpException(
      {
        success: false,
        message: message,
        error: errorMessage,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
    getErrorMessage(error: unknown) {
        throw new Error("Method not implemented.");
    }

  async orderEsimWeb(packageCode: string, amount: number, count: number): Promise<esimOrderResponse> {
    const url = `${this.apiBaseUrl}/open/esim/order`;
      this.logger.log(`eSIM order processing ============>: ${url}`);
      const response: any = await firstValueFrom(
          this.httpService.post<ApiResponse>(
              url,
              {
                transactionId: `GOY_SIM-${Date.now()}`,
                amount: amount,
                packageInfoList: [
                  {
                    packageCode: packageCode,
                    count: count,
                    price: amount
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
      return response.data;
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

function InvoiceBuilder(invoiceData: InvoiceRequest, invoiceCode: string): InvoiceQpayRequest {
    return {
        invoice_code: invoiceCode,
        sender_invoice_no:  `GOY_SIM-${Date.now()}`,  // baiguullagaas uusgeh dahin dawtagdashgui dugaar
        invoice_receiver_code: 'GOY_SIM',
        sender_branch_code: invoiceData.phone + ', ' + invoiceData.email,
        invoice_description: 'Default Invoice Description',
        enable_expiry: false,
        allow_partial: false,
        minimum_amount:  null,
        allow_exceed:  false,
        maximum_amount:  null,
        amount: invoiceData.amount,
        callback_url: '',
        sender_staff_code: 'online',
        sender_terminal_code:  null,
        sender_terminal_data:  { name: null },
        allow_subscribe: false,
        note: 'Багцын нэр: '+invoiceData.packages.toString+', Багцын үнэ: ' + invoiceData.amount + 'Худалдан авагчийн мэдээлэл: ' +invoiceData.email + ', ' + invoiceData.phone,
        invoice_receiver_data:  {
            register: 'AYU90031965',
            name: 'JAVKHLANTUGS BAATARSUKH',
            email: 'ESIMGOY@GMAIL.com',
            phone: '99017586'
        }
    };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}