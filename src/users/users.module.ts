import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { SettingsReferences } from 'src/entities/references.entity';
import { ReferencesHistory } from 'src/entities/reference-history.entity';
import { Transaction } from 'src/entities/transaction.entity';
import { ESimPurchase } from 'src/entities/esim-purchase.entity';
import { EsimInvoice } from 'src/entities/esim-invoice.entity';
import { Customer } from 'src/entities/customer.entity';
import { Wallet } from 'src/entities/wallet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User,SettingsReferences,ReferencesHistory,ESimPurchase, EsimInvoice,SettingsReferences,Customer,Wallet]), forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
