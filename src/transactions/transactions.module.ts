import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { CustomerTransactionsController } from './customer-transactions.controller';
import { OpenEsimController } from './open-esim.controller';
import { Transaction } from '../entities/transaction.entity';
import { ESimPurchase } from '../entities/esim-purchase.entity';
import { Customer } from '../entities/customer.entity';
import { EsimInvoice } from '../entities/esim-invoice.entity';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { QpayConnectionService } from './services/qpay.connection.service';
import { SystemConfig } from '../entities/system-config.entity';
import { InquiryModule } from '../inquiry/inquiry.module';
import { MailService } from './services/mail.service';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [
    HttpModule, // Import HttpModule for making API calls to eSIM Access
    TypeOrmModule.forFeature([
      Transaction,
      ESimPurchase,
      Customer,
      EsimInvoice,
      SystemConfig, // SystemConfig entity for QPay token caching
      User
    ]),
    WalletModule, // Import WalletModule to use WalletService
    forwardRef(() => AuthModule), // Import AuthModule to access TokenBlacklistService for JwtAuthGuard
    forwardRef(() => InquiryModule), // Import InquiryModule to use InquiryPackagesService
  ],
  controllers: [TransactionsController, CustomerTransactionsController, OpenEsimController],
  providers: [TransactionsService, QpayConnectionService, MailService],
  exports: [TransactionsService, QpayConnectionService, MailService], // Export for use in other modules if needed
})
export class TransactionsModule {}
