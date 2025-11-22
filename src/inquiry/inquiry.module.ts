import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InquiryController } from './inquiry.controller';
import { InquiryPackagesService } from './services/inquiry.packages.service';
import { LocationsService } from './services/locations.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataPackageEntity } from '../entities/data-packages.entity';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([DataPackageEntity]),
    forwardRef(() => TransactionsModule), // Use forwardRef to handle circular dependency
  ],
  controllers: [InquiryController],
  providers: [InquiryPackagesService, LocationsService],
  exports: [InquiryPackagesService, LocationsService],
})
export class InquiryModule {}
