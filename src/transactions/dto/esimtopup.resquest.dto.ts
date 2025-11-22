export interface TopupEsim extends Request {
  esimTranNo: string;
  iccid: string;
  packageCode: boolean;
  transactionId: string;
}
