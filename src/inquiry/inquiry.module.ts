import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InquiryController } from './inquiry.controller';
import { InquiryPackagesService } from './services/inquiry.packages.service';
import { LocationsService } from './services/locations.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataPackageEntity } from 'src/entities/data-packages.entity';

@Module({
  imports: [HttpModule,
  TypeOrmModule.forFeature([DataPackageEntity]),],
  controllers: [InquiryController],
  providers: [InquiryPackagesService, LocationsService],
  exports: [InquiryPackagesService, LocationsService],
})
export class InquiryModule {}
