/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { ApiDataObject } from '../../inquiry/dto/data-package.dto';
import { SystemConfig } from '../../entities/system-config.entity';
import { TopupEsim } from '../dto/esimtopup.resquest.dto';
import { InvoiceRequest } from '../dto/invoice.request.dto';
import { TokenResponse } from '../dto/token.response.dto';

interface InvoiceResponse {
  invoice_id: string;
  qr_image: string;
  qr_link: string;
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
    private readonly httpService: HttpService,
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
  ) {
    // Validate env vars on service creation
    if (!this.qpayUser || !this.qpaySecret || !this.qpayInvoiceCode) {
      throw new Error(
        'Missing QPAY_API_USER, QPAY_API_SECRET, or QPAY_INVOICE_CODE in .env',
      );
    }
  }

  async getToken(): Promise<TokenResponse> {
    const configKey = 'QPAY_TOKEN';
    const now = new Date();

    // 1. Try to get from DB
    const cachedConfig = await this.configRepo.findOne({
      where: { key: configKey },
    });

    if (
      cachedConfig &&
      cachedConfig.expiresAt &&
      cachedConfig.expiresAt > now
    ) {
      this.logger.log('Using cached QPay token');
      return JSON.parse(cachedConfig.value) as TokenResponse;
    }

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
              password: this.qpaySecret!,
            },
            headers: {
              Authorization: 'Basic',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const tokenData = response.data;
      this.logger.log(`Token fetched successfully ${tokenData.access_token}`);

      // Save to DB
      const expiresAt = new Date(now.getTime() + 86400 * 1000);  // 24 hours token life time

      await this.configRepo.save({
        key: configKey,
        value: JSON.stringify(tokenData),
        expiresAt: expiresAt,
      });

      return tokenData;
    } catch (error) {
      this.logger.error(
        `Error fetching token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async createInvoice(invoiceData: InvoiceRequest): Promise<InvoiceResponse> {
    try {
      this.logger.log(`Creating invoice: ${invoiceData.invoice_code}`);
      const finalInvoiceData = this.buildInvoice(invoiceData);
      // Get bearer token
      const token = await this.getToken();
      this.logger.log(`Using access token: ${token.access_token}`);

      // Construct invoice endpoint (adjust URL path if needed)
      const invoiceUrl = `${this.qpayBaseUrl}/invoice`;

      const response = await firstValueFrom(
        this.httpService.post<InvoiceResponse>(invoiceUrl, finalInvoiceData, {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(
        `Invoice created successfully. invoice_id: ${response.data.invoice_id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error creating invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private buildInvoice(invoiceData: InvoiceRequest): InvoiceRequest {
    return {
      ...invoiceData,
      invoice_code: this.qpayInvoiceCode!,
      sender_invoice_no:
        invoiceData.sender_invoice_no || `GOY_SIM-${Date.now()}`,
      invoice_receiver_code: invoiceData.invoice_receiver_code || 'GOY_SIM',
      sender_branch_code: invoiceData.sender_branch_code || 'BRANCH001',
      invoice_description:
        invoiceData.invoice_description || 'Default Invoice Description',
      enable_expiry: invoiceData.enable_expiry ?? false,
      allow_partial: invoiceData.allow_partial ?? false,
      minimum_amount: invoiceData.minimum_amount ?? null,
      allow_exceed: invoiceData.allow_exceed ?? false,
      maximum_amount: invoiceData.maximum_amount ?? null,
      callback_url: invoiceData.callback_url || '',
      sender_staff_code: invoiceData.sender_staff_code || 'online',
      sender_terminal_code: invoiceData.sender_terminal_code || undefined,
      sender_terminal_data: invoiceData.sender_terminal_data || { name: null },
      allow_subscribe: invoiceData.allow_subscribe ?? false,
      note: invoiceData.note || undefined,
    };
  }

  async checkInvoice(invoiceId: string): Promise<any> {
    try {
      this.logger.log(`Checking invoice status: ${invoiceId}`);

      // Get bearer token
      const token = await this.getToken();

      // Construct check invoice endpoint
      const checkUrl = `${this.qpayBaseUrl}/payment/check`;

      const response = await firstValueFrom(
        this.httpService.post<InvoiceResponse>(
          checkUrl,
          {
            object_type: 'INVOICE',
            object_id: invoiceId,
            offset: {
              page_number: 1,
              page_limit: 100,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.logger.log(
        `Invoice status retrieved. invoice_id: ${invoiceId}, status: ${JSON.stringify(response.data as any)}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error checking invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
              price: 17000,
            },
          ],
        },
        {
          headers: {
            'RT-AccessCode': this.accessCode,
            'Content-Type': 'application/json',
          },
        },
      ),
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
          iccid: '',
          packageCode: body.packageCode,
          transactionId: body.transactionId,
        },
        {
          headers: {
            'RT-AccessCode': this.accessCode,
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    const data: ApiResponse = response.data;
    return data;
  }
}
