export interface OderEsim extends Response {
  errorCode: string | null;
  errorMsg: string | null;
  success: boolean;
  obj: {
    orderNo: string;
    transactionId: string;
  };
}
