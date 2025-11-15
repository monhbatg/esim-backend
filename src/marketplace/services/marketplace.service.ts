import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../entities/category.entity';
import { Country } from '../../entities/country.entity';
import { InquiryPackagesService } from '../../inquiry/services/inquiry.packages.service';
import { MarketplaceCategoryDto } from '../dto/marketplace-response.dto';
import {
  CountryFilterDto,
  CategoryFilterDto,
} from '../dto/filter-response.dto';
import { CURRENCY_CONSTANTS } from '../constants/currency.constants';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    private readonly inquiryPackagesService: InquiryPackagesService,
  ) {}

  /**
   * Get all countries (for filter dropdowns/selection)
   */
  async getAllCountriesForFilter(): Promise<CountryFilterDto[]> {
    const countries = await this.countryRepository.find({
      order: { name_en: 'ASC' },
    });

    return countries.map(
      (country): CountryFilterDto => ({
        id: country.id,
        name_en: country.name_en,
        name_mn: country.name_mn,
        country_code: country.country_code,
        image: country.image,
      }),
    );
  }

  /**
   * Get all categories (for filter dropdowns/selection)
   */
  async getAllCategoriesForFilter(): Promise<CategoryFilterDto[]> {
    const categories = await this.categoryRepository.find({
      order: { name_en: 'ASC' },
    });

    return categories.map(
      (category): CategoryFilterDto => ({
        id: category.id,
        name_en: category.name_en,
        name_mn: category.name_mn,
        description_en: category.description_en,
        description_mn: category.description_mn,
      }),
    );
  }

  async getMarketplace(filters?: {
    category_id?: number;
    region_id?: number;
    search?: string;
  }): Promise<MarketplaceCategoryDto[]> {
    // Build query for categories
    let categoriesQuery = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.countries', 'country')
      .leftJoinAndSelect('country.region', 'region')
      .orderBy('category.name_en', 'ASC');

    // Filter by category_id if provided
    if (filters?.category_id) {
      categoriesQuery = categoriesQuery.where('category.id = :categoryId', {
        categoryId: filters.category_id,
      });
    }

    // Execute query to get categories
    const categories = await categoriesQuery.getMany();

    // Verify category exists if filtering by category_id
    if (filters?.category_id && categories.length === 0) {
      throw new NotFoundException(
        `Category with ID ${filters.category_id} not found`,
      );
    }

    // Filter countries within each category based on region_id and search
    const result = categories.map((category) => {
      let filteredCountries = category.countries || [];

      // Filter by region_id if provided
      if (filters?.region_id) {
        filteredCountries = filteredCountries.filter(
          (country) => country.region_id === filters.region_id,
        );
      }

      // Filter by search term if provided (search in both English and Mongolian names)
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredCountries = filteredCountries.filter(
          (country) =>
            country.name_en.toLowerCase().includes(searchLower) ||
            country.name_mn.toLowerCase().includes(searchLower),
        );
      }

      return {
        name_en: category.name_en,
        name_mn: category.name_mn,
        description_en: category.description_en,
        description_mn: category.description_mn,
        countries: filteredCountries.map((country) => ({
          name_en: country.name_en,
          name_mn: country.name_mn,
          image: country.image,
          country_code: country.country_code,
          region: {
            name_en: country.region.name_en,
            name_mn: country.region.name_mn,
          },
        })),
      };
    });

    // Remove categories with no countries after filtering
    return result.filter((category) => category.countries.length > 0);
  }

  /**
   * Get eSIM packages for a specific country code
   * Uses the country_code from marketplace to fetch packages from esimaccess API
   * Converts prices to MNT using the configured exchange rate
   */
  async getPackagesByCountryCode(
    countryCode: string,
  ): Promise<Array<Record<string, unknown>>> {
    // Validate country code exists in our database
    const country = await this.countryRepository.findOne({
      where: { country_code: countryCode.toUpperCase() },
    });

    if (!country) {
      throw new NotFoundException(
        `Country with code '${countryCode}' not found in marketplace`,
      );
    }

    // Fetch packages from esimaccess API using locationCode
    const packages = await this.inquiryPackagesService.getDataPackagesByCountry(
      countryCode.toUpperCase(),
    );

    // Transform prices: value * 10,000 (10000 = $1.00) then convert to MNT
    return packages.map((pkg) => {
      // Use retailPrice if it exists, otherwise use price as retailPrice
      const basePrice = pkg.retailPrice ?? pkg.price;

      // Calculate USD price from API value
      // Formula: value * 10,000 where 10000 = $1.00
      // The API price is in units where 10000 units = $1.00
      // So USD = price / 10000
      const usdPrice = basePrice / CURRENCY_CONSTANTS.PRICE_MULTIPLIER;

      // Convert USD to MNT using exchange rate
      const retailPriceMnt = Math.round(
        usdPrice * CURRENCY_CONSTANTS.USD_TO_MNT_RATE,
      );

      // Keep both price (original API price) and retailPrice (converted to MNT)
      return {
        ...pkg,
        price: pkg.price, // Original price from API
        retailPrice: pkg.retailPrice, // Converted price in MNT
        priceMnt: retailPriceMnt, // Converted price in MNT
        currencyCode: CURRENCY_CONSTANTS.CURRENCY_CODE as string,
      };
    });
  }
}
