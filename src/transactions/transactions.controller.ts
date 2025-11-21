import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthRequest } from '../auth/interfaces/auth-request.interface';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  TransactionResponseDto,
  TransactionListResponseDto,
} from './dto/transaction-response.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { PurchaseEsimDto } from './dto/purchase-esim.dto';
import { ESimPurchaseResponseDto } from './dto/esim-purchase-response.dto';
import { OrderEsimDto } from './dto/order-esim.dto';
import { OrderEsimResponseDto } from './dto/order-esim-response.dto';
import {
  TransactionStatus,
  TransactionType,
} from '../users/dto/transaction-types.enum';
import { Transaction } from '../entities/transaction.entity';
import { ESimPurchase } from '../entities/esim-purchase.entity';
import { QpayConnectionService } from './services/qpay.connection.service';
import type { InvoiceRequest } from './dto/invoice.request.dto';
import { TokenResponse } from './dto/token.response.dto';
import * as esimTopupResquestDto from './dto/esimtopup.resquest.dto';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly qpayConnectionService: QpayConnectionService,
  ) {}

  /**
   * POST /transactions
   *
   * Create and process a new transaction
   * Charges money from user's wallet if type is WITHDRAWAL
   *
   * @example Request:
   * POST /transactions
   * Body: {
   *   "type": "WITHDRAWAL",
   *   "amount": 50.00,
   *   "description": "Purchase eSIM package",
   *   "referenceId": "ORDER-12345"
   * }
   *
   * @example Response:
   * {
   *   "id": "123e4567-e89b-12d3-a456-426614174000",
   *   "transactionId": "TXN-20240101-ABC123",
   *   "userId": "user-uuid",
   *   "type": "WITHDRAWAL",
   *   "status": "COMPLETED",
   *   "amount": 50.00,
   *   "currency": "USD",
   *   "balanceBefore": 100.00,
   *   "balanceAfter": 50.00,
   *   "description": "Purchase eSIM package",
   *   "referenceId": "ORDER-12345",
   *   "createdAt": "2024-01-01T10:00:00.000Z",
   *   "completedAt": "2024-01-01T10:00:01.000Z"
   * }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create and process a transaction',
    description:
      "Creates a new transaction and processes it. For WITHDRAWAL type, charges money from user's wallet. Throws error if balance is insufficient.",
  })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({
    status: 201,
    description: 'Transaction created and processed successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input data, insufficient balance, or invalid transaction type',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User or wallet not found',
  })
  async createTransaction(
    @Request() req: AuthRequest,
    @Body(ValidationPipe) createTransactionDto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.transactionsService.processTransaction(
      req.user.id,
      createTransactionDto,
    );

    return this.mapToResponseDto(transaction);
  }

  /**
   * GET /transactions
   *
   * Get transaction history for the authenticated user
   *
   * @example Request:
   * GET /transactions?type=WITHDRAWAL&status=COMPLETED&page=1&limit=10
   *
   * @example Response:
   * {
   *   "transactions": [...],
   *   "total": 100,
   *   "page": 1,
   *   "limit": 10,
   *   "totalPages": 10
   * }
   */
  @Get()
  @ApiOperation({
    summary: 'Get transaction history',
    description:
      'Retrieve transaction history for the authenticated user with optional filters and pagination',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['DEPOSIT', 'WITHDRAWAL', 'REFUND', 'TRANSFER', 'ADJUSTMENT'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
    type: TransactionListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async getTransactions(
    @Request() req: AuthRequest,
    @Query(ValidationPipe) queryDto: QueryTransactionsDto,
  ): Promise<TransactionListResponseDto> {
    const result = await this.transactionsService.getUserTransactions(
      req.user.id,
      queryDto,
    );

    return {
      transactions: result.transactions.map((t) =>
        this.mapToResponseDto(
          t as Transaction & { esimPurchase?: ESimPurchase },
        ),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * GET /transactions/:transactionId
   *
   * Get a specific transaction by transaction ID
   *
   * @example Request:
   * GET /transactions/TXN-20240101-ABC123
   */
  @Get(':transactionId')
  @ApiOperation({
    summary: 'Get transaction by ID',
    description: 'Retrieve a specific transaction by its unique transaction ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async getTransaction(
    @Request() req: AuthRequest,
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionResponseDto> {
    const transaction =
      await this.transactionsService.getTransactionByTransactionId(
        transactionId,
      );

    // Ensure user can only access their own transactions
    if (transaction.userId !== req.user.id) {
      throw new NotFoundException('Transaction not found');
    }

    // Load eSIM purchase if exists (by transactionId)
    const esimPurchase =
      await this.transactionsService.getEsimPurchaseByTransactionId(
        transaction.transactionId,
        req.user.id,
      );

    return this.mapToResponseDto({
      ...transaction,
      esimPurchase: esimPurchase || undefined,
    } as Transaction & { esimPurchase?: ESimPurchase });
  }

  /**
   * GET /transactions/me/summary
   *
   * Get transaction summary for the authenticated user
   */
  @Get('me/summary')
  @ApiOperation({
    summary: 'Get transaction summary',
    description:
      "Get summary statistics for the authenticated user's transactions",
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction summary retrieved successfully',
  })
  async getTransactionSummary(@Request() req: AuthRequest) {
    // Get all transactions for summary
    const allTransactions = await this.transactionsService.getUserTransactions(
      req.user.id,
      { page: 1, limit: 1000 }, // Get a large number for summary
    );

    const transactions = allTransactions.transactions;

    const summary = {
      totalTransactions: transactions.length,
      totalCompleted: transactions.filter(
        (t) => t.status === TransactionStatus.COMPLETED,
      ).length,
      totalFailed: transactions.filter(
        (t) => t.status === TransactionStatus.FAILED,
      ).length,
      totalPending: transactions.filter(
        (t) => t.status === TransactionStatus.PENDING,
      ).length,
      totalWithdrawn: transactions
        .filter(
          (t) =>
            t.type === TransactionType.WITHDRAWAL &&
            t.status === TransactionStatus.COMPLETED,
        )
        .reduce((sum, t) => sum + Number(t.amount), 0),
      totalDeposited: transactions
        .filter(
          (t) =>
            t.type === TransactionType.DEPOSIT &&
            t.status === TransactionStatus.COMPLETED,
        )
        .reduce((sum, t) => sum + Number(t.amount), 0),
    };

    return summary;
  }

  /**
   * POST /transactions/purchase-esim
   *
   * Purchase an eSIM card
   * Charges money from user's wallet and creates eSIM purchase record
   *
   * @example Request:
   * POST /transactions/purchase-esim
   * Body: {
   *   "packageCode": "CKH491",
   *   "slug": "NA-3_1_7",
   *   "packageName": "North America 1GB 7Days",
   *   "price": 57.00,
   *   "currency": "USD",
   *   "dataVolume": 1073741824,
   *   "duration": 7,
   *   "durationUnit": "DAY",
   *   "location": "MX,US,CA",
   *   "description": "North America 1GB 7Days"
   * }
   */
  @Post('purchase-esim')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Purchase an eSIM card',
    description:
      "Purchases an eSIM card, charges money from user's wallet, and creates transaction and eSIM purchase records. Throws error if balance is insufficient.",
  })
  @ApiBody({ type: PurchaseEsimDto })
  @ApiResponse({
    status: 201,
    description: 'eSIM purchased successfully',
    type: ESimPurchaseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or insufficient balance',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User or wallet not found',
  })
  async purchaseEsim(
    @Request() req: AuthRequest,
    @Body(ValidationPipe) purchaseEsimDto: PurchaseEsimDto,
  ): Promise<ESimPurchaseResponseDto> {
    const result = await this.transactionsService.purchaseEsim(
      req.user.id,
      purchaseEsimDto,
    );
    const { transaction, purchase } = result;

    return {
      transaction: this.mapToResponseDto(transaction),
      purchaseId: purchase.id,
      packageCode: purchase.packageCode,
      slug: purchase.slug,
      packageName: purchase.packageName,
      price: Number(purchase.price),
      currency: purchase.currency,
      dataVolume: Number(purchase.dataVolume),
      duration: purchase.duration,
      durationUnit: purchase.durationUnit,
      location: purchase.location,
      description: purchase.description,
      iccid: purchase.iccid,
      isActivated: purchase.isActivated,
      isActive: purchase.isActive,
      activatedAt: purchase.activatedAt,
      expiresAt: purchase.expiresAt,
      purchasedAt: purchase.createdAt,
    };
  }

  /**
   * POST /transactions/order-esim
   *
   * Order eSIM profiles from eSIM Access API
   * Deducts balance from user's wallet and places order with eSIM provider
   *
   * @example Request:
   * POST /transactions/order-esim
   * Body: {
   *   "transactionId": "TXN-20240101-ABC123",
   *   "amount": 15000,
   *   "packageInfoList": [{
   *     "packageCode": "7aa948d363",
   *     "count": 1,
   *     "price": 15000
   *   }]
   * }
   */
  @Post('order-esim')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Order eSIM profiles',
    description:
      "Orders eSIM profiles from eSIM Access API, deducts balance from user's wallet, and creates transaction record. Throws error if balance is insufficient or order fails.",
  })
  @ApiBody({ type: OrderEsimDto })
  @ApiResponse({
    status: 201,
    description: 'eSIM order placed successfully',
    type: OrderEsimResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input data, insufficient balance, duplicate transaction ID, or order failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User or wallet not found',
  })
  async orderEsim(
    @Request() req: AuthRequest,
    @Body(ValidationPipe) orderEsimDto: OrderEsimDto,
  ): Promise<OrderEsimResponseDto> {
    return await this.transactionsService.orderEsim(req.user.id, orderEsimDto);
  }

  /**
   * GET /transactions/my-esims
   *
   * Get all eSIM purchases for the authenticated user
   */
  @Get('my-esims')
  @ApiOperation({
    summary: 'Get my eSIM purchases',
    description: 'Retrieve all eSIM cards purchased by the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'eSIM purchases retrieved successfully',
    type: [ESimPurchaseResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async getMyEsimPurchases(
    @Request() req: AuthRequest,
  ): Promise<ESimPurchaseResponseDto[]> {
    const purchases: ESimPurchase[] =
      await this.transactionsService.getUserEsimPurchases(req.user.id);

    return purchases.map((purchase: ESimPurchase) => ({
      transaction: purchase.transaction
        ? this.mapToResponseDto(
            purchase.transaction as Transaction & {
              esimPurchase?: ESimPurchase;
            },
          )
        : null,
      purchaseId: purchase.id,
      packageCode: purchase.packageCode,
      slug: purchase.slug,
      packageName: purchase.packageName,
      price: Number(purchase.price),
      currency: purchase.currency,
      dataVolume: Number(purchase.dataVolume),
      duration: purchase.duration,
      durationUnit: purchase.durationUnit,
      location: purchase.location,
      description: purchase.description,
      iccid: purchase.iccid,
      isActivated: purchase.isActivated,
      isActive: purchase.isActive,
      activatedAt: purchase.activatedAt,
      expiresAt: purchase.expiresAt,
      purchasedAt: purchase.createdAt,
    }));
  }

  /**
   * GET /transactions/my-esims/:purchaseId
   *
   * Get specific eSIM purchase by ID
   */
  @Get('my-esims/:purchaseId')
  @ApiOperation({
    summary: 'Get eSIM purchase by ID',
    description: 'Retrieve a specific eSIM purchase by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'eSIM purchase retrieved successfully',
    type: ESimPurchaseResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'eSIM purchase not found',
  })
  async getEsimPurchase(
    @Request() req: AuthRequest,
    @Param('purchaseId') purchaseId: string,
  ): Promise<ESimPurchaseResponseDto> {
    const purchase: ESimPurchase =
      await this.transactionsService.getEsimPurchaseById(
        purchaseId,
        req.user.id,
      );

    return {
      transaction: purchase.transaction
        ? this.mapToResponseDto(
            purchase.transaction as Transaction & {
              esimPurchase?: ESimPurchase;
            },
          )
        : null,
      purchaseId: purchase.id,
      packageCode: purchase.packageCode,
      slug: purchase.slug,
      packageName: purchase.packageName,
      price: Number(purchase.price),
      currency: purchase.currency,
      dataVolume: Number(purchase.dataVolume),
      duration: purchase.duration,
      durationUnit: purchase.durationUnit,
      location: purchase.location,
      description: purchase.description,
      iccid: purchase.iccid,
      isActivated: purchase.isActivated,
      isActive: purchase.isActive,
      activatedAt: purchase.activatedAt,
      expiresAt: purchase.expiresAt,
      purchasedAt: purchase.createdAt,
    };
  }

  /**
   * Map Transaction entity to Response DTO
   */
  private mapToResponseDto(
    transaction: Transaction & { esimPurchase?: ESimPurchase },
  ): TransactionResponseDto {
    const dto: TransactionResponseDto = {
      id: transaction.id,
      transactionId: transaction.transactionId,
      userId: transaction.userId,
      type: transaction.type,
      status: transaction.status,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      balanceBefore: transaction.balanceBefore
        ? Number(transaction.balanceBefore)
        : null,
      balanceAfter: transaction.balanceAfter
        ? Number(transaction.balanceAfter)
        : null,
      description: transaction.description,
      referenceId: transaction.referenceId,
      metadata: transaction.metadata,
      failureReason: transaction.failureReason,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      completedAt: transaction.completedAt,
    };

    // Add eSIM info if this transaction has an associated eSIM purchase
    if (transaction.esimPurchase) {
      dto.esimInfo = {
        packageCode: transaction.esimPurchase.packageCode,
        slug: transaction.esimPurchase.slug,
        packageName: transaction.esimPurchase.packageName,
        dataVolume: Number(transaction.esimPurchase.dataVolume),
        duration: transaction.esimPurchase.duration,
        durationUnit: transaction.esimPurchase.durationUnit,
        location: transaction.esimPurchase.location,
        description: transaction.esimPurchase.description,
        purchaseId: transaction.esimPurchase.id,
        isActivated: transaction.esimPurchase.isActivated,
        expiresAt: transaction.esimPurchase.expiresAt,
      };
    }

    return dto;
  }

  @Post('createInvoice')
  @ApiOperation({
    summary: 'Create QPay invoice',
    description:"QPay-с нэхэмжлэл үүсгэх",
  })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({
    status: 200,
    description: 'Invoice created successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input data, insufficient balance, or invalid transaction type',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User or wallet not found',
  })
  async createInvoice(
     @Request() req: InvoiceRequest,
  ): Promise<any> {
    return await this.qpayConnectionService.createInvoice(req);
  }

  @Post('check/:invoiceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check QPay invoice status',
    description: 'Нэхэмжлэл төлөгдсөн эсэхийг шалгах',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice status retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid invoice ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async checkInvoiceStatus(
    @Request() req: AuthRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<any> {
    return await this.qpayConnectionService.checkInvoice(invoiceId);
  }

  @Post('order/esim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check QPay invoice status',
    description: 'Нэхэмжлэл төлөгдсөн эсэхийг шалгах',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice status retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid invoice ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async orderEsim(
    @Request() req: AuthRequest,
  ): Promise<any> {
    return await this.qpayConnectionService.orderEsim();
  }

  @Post('esim/topup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'top up esim',
    description: 'eSIM цэнэглэх',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice status retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid invoice ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async topupEsim(
    @Request() req: AuthRequest,
    @Body() body: esimTopupResquestDto.TopupEsim,
  ): Promise<any> {
    return await this.qpayConnectionService.topupEsim(body);
  }
}