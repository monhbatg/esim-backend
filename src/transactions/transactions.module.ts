import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from '../entities/transaction.entity';
import { ESimPurchase } from '../entities/esim-purchase.entity';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { QpayConnectionService } from './services/qpay.connection.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Transaction, ESimPurchase]),
    WalletModule, // Import WalletModule to use WalletService
    forwardRef(() => AuthModule), // Import AuthModule to access TokenBlacklistService for JwtAuthGuard
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, QpayConnectionService],
  exports: [TransactionsService, QpayConnectionService], // Export for use in other modules if needed
})
export class TransactionsModule {}
