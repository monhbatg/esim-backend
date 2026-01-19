/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CustomerPurchaseDto } from './dto/customer-purchase.dto';
import { CustomerLookupDto } from './dto/customer-lookup.dto';
import { CustomerDataResponseDto } from './dto/customer-data-response.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('customer-transactions')
@Controller('customer/transactions')
export class CustomerTransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService
) {}

  @Post('purchase')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Customer purchase eSIM',
    description: 'Create QPay invoice for customer',
  })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully',
  })
  async purchase(@Body(ValidationPipe) dto: CustomerPurchaseDto): Promise<any> {
    return await this.transactionsService.processCustomerPurchase(dto);
  }

  @Get('lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customer data by email or phone',
    description: 'Returns active QPay invoices and purchased SIM cards for the customer',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer data retrieved successfully',
    type: CustomerDataResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getCustomerData(
    @Query(ValidationPipe) query: CustomerLookupDto,
  ): Promise<CustomerDataResponseDto> {
    const data = await this.transactionsService.getCustomerData(
      query.email,
      query.phoneNumber,
    );
    return data;
  }

  @Post('purchaseTopup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Customer purchase eSIM',
    description: 'Create QPay invoice for customer',
  })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully',
  })
  async topup(@Body(ValidationPipe) dto: CustomerPurchaseDto ): Promise<any> {
    return await this.transactionsService.processCustomerTopup(dto);
  }
}