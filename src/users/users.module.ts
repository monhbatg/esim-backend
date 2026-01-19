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

@Module({
  imports: [TypeOrmModule.forFeature([
    User,
    ConfigVariables,
    ReferencesHistory,
    ESimPurchase,
    EsimInvoice,
    Customer,
    Salary,
    Wallet
  ]), forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}