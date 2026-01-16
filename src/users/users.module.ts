import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { Customer } from 'src/entities/customer.entity';
import { EsimInvoice } from 'src/entities/esim-invoice.entity';
import { ESimPurchase } from 'src/entities/esim-purchase.entity';
import { ReferencesHistory } from 'src/entities/reference-history.entity';
import { SettingsReferences } from 'src/entities/settings-references.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    User,
    SettingsReferences,
    ReferencesHistory,
    ESimPurchase,
    EsimInvoice,
    Customer,
  ]), forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}