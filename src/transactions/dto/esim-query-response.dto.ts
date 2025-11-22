import { ApiProperty } from '@nestjs/swagger';

/**
 * Package information in eSIM query response
 */
export class EsimPackageInfoDto {
  @ApiProperty({ example: 'Spain 5GB 30Days' })
  packageName: string;

  @ApiProperty({ example: 'CKH003' })
  packageCode: string;

  @ApiProperty({ example: 'ES_5_30' })
  slug: string;

  @ApiProperty({ example: 30 })
  duration: number;

  @ApiProperty({ example: 5368709120 })
  volume: number;

  @ApiProperty({ example: 'ES' })
  locationCode: string;

  @ApiProperty({ example: '2023-12-01T18:34:17+0000' })
  createTime: string;
}

/**
 * eSIM item in query response
 */
export class EsimQueryItemDto {
  @ApiProperty({ example: '23120118156818' })
  esimTranNo: string;

  @ApiProperty({ example: 'B23120118131854' })
  orderNo: string;

  @ApiProperty({ example: 'test344343433' })
  transactionId: string;

  @ApiProperty({ example: '232104070077567', nullable: true })
  imsi: string | null;

  @ApiProperty({ example: '8943108170000775671', nullable: true })
  iccid: string | null;

  @ApiProperty({ example: 1, nullable: true })
  smsStatus: number | null;

  @ApiProperty({ example: '436789040077567', nullable: true })
  msisdn: string | null;

  @ApiProperty({ example: 'LPA:1$rsp-eu.redteamobile.com$43DE23C67EE747BCAD6B63E8B67B261F', nullable: true })
  ac: string | null;

  @ApiProperty({ example: 'https://p.qrsim.net/0fa4f29eb25b4d6c84ff4b8422a1da54.png', nullable: true })
  qrCodeUrl: string | null;

  @ApiProperty({ example: 'https://p.qrsim.net/0fa4f29eb25b4d6c84ff4b8422a1da54', nullable: true })
  shortUrl: string | null;

  @ApiProperty({ example: 'RELEASED', nullable: true })
  smdpStatus: string | null;

  @ApiProperty({ example: '', nullable: true })
  eid: string | null;

  @ApiProperty({ example: 1, nullable: true })
  activeType: number | null;

  @ApiProperty({ example: 1, nullable: true })
  dataType: number | null;

  @ApiProperty({ example: null, nullable: true })
  activateTime: string | null;

  @ApiProperty({ example: '2024-05-29T18:34:17+0000', nullable: true })
  expiredTime: string | null;

  @ApiProperty({ example: 5368709120 })
  totalVolume: number;

  @ApiProperty({ example: 30 })
  totalDuration: number;

  @ApiProperty({ example: 'DAY' })
  durationUnit: string;

  @ApiProperty({ example: 0, nullable: true })
  orderUsage: number | null;

  @ApiProperty({ example: 'CANCEL' })
  esimStatus: string;

  @ApiProperty({ example: '', nullable: true })
  pin: string | null;

  @ApiProperty({ example: '', nullable: true })
  puk: string | null;

  @ApiProperty({ example: 'drei.at', nullable: true })
  apn: string | null;

  @ApiProperty({ type: [EsimPackageInfoDto] })
  packageList: EsimPackageInfoDto[];
}

/**
 * Pager information in response
 */
export class EsimQueryPagerDto {
  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 1 })
  pageNum: number;

  @ApiProperty({ example: 1 })
  total: number;
}

/**
 * Response object containing eSIM list and pager
 */
export class EsimQueryResponseObjDto {
  @ApiProperty({ type: [EsimQueryItemDto] })
  esimList: EsimQueryItemDto[];

  @ApiProperty({ type: EsimQueryPagerDto })
  pager: EsimQueryPagerDto;
}

/**
 * Complete eSIM query response matching API format
 */
export class EsimQueryResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: '0' })
  errorCode: string;

  @ApiProperty({ example: null, nullable: true })
  errorMsg: string | null;

  @ApiProperty({ type: EsimQueryResponseObjDto })
  obj: EsimQueryResponseObjDto;
}

