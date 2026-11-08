import { ApiProperty } from "@nestjs/swagger";

export interface UserPurchaseListDto  extends Request {
  id: number;
  packageName: string;
  country: string;
  date: string;
  price: number;
}