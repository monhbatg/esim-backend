export interface EsimPackage {
  packageName: string;
  packageCode: string;
  slug: string;
  duration: number;
  volume: number;
  locationCode: string;
  createTime: string;
  esimTranNo: string;
  transactionId: string;
}

export interface EsimItem {
  esimTranNo: string;
  orderNo: string;
  transactionId: string;
  imsi: string;
  iccid: string;
  smsStatus: number;
  msisdn: string;
  ac: string;
  qrCodeUrl: string;
  shortUrl: string;
  smdpStatus: string;
  eid: string;
  activeType: number;
  dataType: number;
  activateTime: string | null;
  expiredTime: string;
  installationTime: string | null;
  totalVolume: number;
  totalDuration: number;
  durationUnit: string;
  orderUsage: number;
  esimStatus: string;
  pin: string;
  puk: string;
  apn: string;
  ipExport: string;
  supportTopUpType: number;
  fupPolicy: string;
  packageList: EsimPackage[];
}

export interface Pager {
  pageSize: number;
  pageNum: number;
  total: number;
}

export interface MyEsimPackagesResponseObj {
  esimList: EsimItem[];
  pager: Pager;
}

export interface MyEsimPackagesResponseDto {
  success: boolean;
  errorCode: string;
  errorMsg: string | null;
  obj: MyEsimPackagesResponseObj;
}
