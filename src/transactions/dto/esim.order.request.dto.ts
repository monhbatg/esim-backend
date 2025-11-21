export interface esimOrderReq extends Request{
  transactionId: string;      // transactionId as a string
  amount: number;             // amount as a number
  packageInfoList: packageInfo[];
}

interface packageInfo {
  packageCode: string,
  count: number,
  price: number
}