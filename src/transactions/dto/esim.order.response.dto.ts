export interface esimOrderResponse {
  errorCode: string | null;
  errorMsg: string | null;
  success: boolean;
  obj: {
    orderNo: string;
    transactionId: string;  
    }
}
