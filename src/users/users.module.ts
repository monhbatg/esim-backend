import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { Customer } from '../entities/customer.entity';
import { EsimInvoice } from '../entities/esim-invoice.entity';
import { ESimPurchase } from '../entities/esim-purchase.entity';
import { ReferencesHistory } from '../entities/reference-history.entity';
import { ConfigVariables } from '../entities/references.entity';
import { Salary } from 'src/entities/salary.entity';
import { Wallet } from 'src/entities/wallet.entity';
import { AdminService } from './admin.service';
import { OperatorService } from './operator.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { Transaction } from 'src/entities/transaction.entity';
import { WalletService } from 'src/wallet/wallet.service';
import { HttpModule } from '@nestjs/axios';
import { QpayConnectionService } from 'src/transactions/services/qpay.connection.service';
import { InquiryPackagesService } from 'src/inquiry/services/inquiry.packages.service';
import { MailService } from 'src/transactions/services/mail.service';
import { DataPackageEntity } from 'src/entities/data-packages.entity';
import { SystemConfig } from 'src/entities/system-config.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
    ConfigVariables,
    ReferencesHistory,
    ESimPurchase,
    EsimInvoice,
    Customer,
    Salary,
    Wallet,
    Transaction,
    User,
    DataPackageEntity,
    SystemConfig
  ]), forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService, AdminService, OperatorService, TransactionsService, 
    WalletService, QpayConnectionService, InquiryPackagesService, MailService],
  exports: [UsersService, AdminService, OperatorService, TransactionsService,
    WalletService, QpayConnectionService, InquiryPackagesService, MailService],
})
export class UsersModule {}