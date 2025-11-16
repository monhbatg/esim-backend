import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Region } from '../entities/region.entity';
import { Country } from '../entities/country.entity';
import { Category } from '../entities/category.entity';
import { InquiryModule } from '../inquiry/inquiry.module';
import { RegionsService } from './services/regions.service';
import { CountriesService } from './services/countries.service';
import { CategoriesService } from './services/categories.service';
import { MarketplaceService } from './services/marketplace.service';
import { RegionsController } from './controllers/regions.controller';
import { CountriesController } from './controllers/countries.controller';
import { CategoriesController } from './controllers/categories.controller';
import { MarketplaceController } from './controllers/marketplace.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Region, Country, Category]),
    InquiryModule,
  ],
  controllers: [
    RegionsController,
    CountriesController,
    CategoriesController,
    MarketplaceController,
  ],
  providers: [
    RegionsService,
    CountriesService,
    CategoriesService,
    MarketplaceService,
  ],
  exports: [
    RegionsService,
    CountriesService,
    CategoriesService,
    MarketplaceService,
  ],
})
export class MarketplaceModule {}
