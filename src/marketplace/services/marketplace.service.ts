import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../entities/category.entity';
import { MarketplaceCategoryDto } from '../dto/marketplace-response.dto';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async getMarketplace(): Promise<MarketplaceCategoryDto[]> {
    const categories = await this.categoryRepository.find({
      relations: ['countries', 'countries.region'],
      order: { name_en: 'ASC' },
    });

    return categories.map((category) => ({
      name_en: category.name_en,
      name_mn: category.name_mn,
      description_en: category.description_en,
      description_mn: category.description_mn,
      countries: category.countries.map((country) => ({
        name_en: country.name_en,
        name_mn: country.name_mn,
        image: country.image,
        region: {
          name_en: country.region.name_en,
          name_mn: country.region.name_mn,
        },
      })),
    }));
  }
}

