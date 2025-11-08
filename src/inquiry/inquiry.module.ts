import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InquiryController } from './inquiry.controller';
import { InquiryPackagesService } from './services/inquiry.packages.service';
import { LocationsService } from './services/locations.service';

@Module({
  imports: [HttpModule],
  controllers: [InquiryController],
  providers: [InquiryPackagesService, LocationsService],
  exports: [InquiryPackagesService, LocationsService],
})
export class InquiryModule {}
