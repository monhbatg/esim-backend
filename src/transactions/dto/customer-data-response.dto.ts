import { ApiProperty } from '@nestjs/swagger';

export class InvoiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  senderInvoiceNo: string;

  @ApiProperty({ nullable: true })
  qpayInvoiceId: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  packageCode: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  invoiceData: any;
}

export class ESimPurchaseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  packageCode: string;

  @ApiProperty()
  packageName: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  dataVolume: number;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  durationUnit: string;

  @ApiProperty()
  location: string;

  @ApiProperty({ nullable: true })
  iccid: string | null;

  @ApiProperty({ nullable: true })
  activationCode: string | null;

  @ApiProperty({ nullable: true })
  activatedAt: Date | null;

  @ApiProperty({ nullable: true })
  expiresAt: Date | null;

  @ApiProperty()
  isActivated: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class CustomerDataResponseDto {
  @ApiProperty()
  customerId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ type: [InvoiceResponseDto] })
  activeInvoices: InvoiceResponseDto[];
}

