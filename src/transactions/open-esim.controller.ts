import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { EsimQueryResponseDto } from './dto/esim-query-response.dto';
import { QueryEsimDto } from './dto/query-esim.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('open-esim')
@Controller('v1/open/esim')
export class OpenEsimController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * POST /v1/open/esim/query
   *
   * Query eSIM purchases by orderNo, esimTranNo, iccid, or date range
   * Public endpoint matching eSIM Access API format
   *
   * @example Request:
   * POST /api/v1/open/esim/query
   * Body: {
   *   "orderNo": "B23120118131854",
   *   "esimTranNo": "",
   *   "iccid": "",
   *   "pager": {
   *     "pageNum": 1,
   *     "pageSize": 20
   *   }
   * }
   *
   * @example Response:
   * {
   *   "success": true,
   *   "errorCode": "0",
   *   "errorMsg": null,
   *   "obj": {
   *     "esimList": [...],
   *     "pager": {
   *       "pageSize": 20,
   *       "pageNum": 1,
   *       "total": 1
   *     }
   *   }
   * }
   */
  @Post('query')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Query eSIM purchases',
    description:
      'Query eSIM purchases by orderNo, esimTranNo, iccid, or date range. Public endpoint matching eSIM Access API format. Accessible at /api/v1/open/esim/query',
  })
  @ApiBody({ type: QueryEsimDto })
  @ApiResponse({
    status: 200,
    description: 'eSIM query results retrieved successfully',
    type: EsimQueryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async queryEsim(
    @Body(ValidationPipe) queryDto: QueryEsimDto,
  ): Promise<EsimQueryResponseDto> {
    return await this.transactionsService.queryEsimPurchases(queryDto);
  }
}
