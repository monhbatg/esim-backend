import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { Wallet } from '../entities/wallet.entity';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, User]),
    forwardRef(() => AuthModule),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService], // Export for use in TransactionModule later
})
export class WalletModule {}

