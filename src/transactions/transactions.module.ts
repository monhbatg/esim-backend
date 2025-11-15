import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from '../entities/transaction.entity';
import { ESimPurchase } from '../entities/esim-purchase.entity';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, ESimPurchase]),
    HttpModule, // Import HttpModule for making API calls to eSIM Access
    WalletModule, // Import WalletModule to use WalletService
    forwardRef(() => AuthModule), // Import AuthModule to access TokenBlacklistService for JwtAuthGuard
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService], // Export for use in other modules if needed
})
export class TransactionsModule {}
