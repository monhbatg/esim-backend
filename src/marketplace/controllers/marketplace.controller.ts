import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CategoryFilterDto,
  CountryFilterDto,
} from '../dto/filter-response.dto';
import { MarketplaceCategoryDto } from '../dto/marketplace-response.dto';
import { QueryMarketplaceDto } from '../dto/query-marketplace.dto';
import { QueryPackagesDto } from '../dto/query-packages.dto';
import { MarketplaceService } from '../services/marketplace.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get()
  @ApiOperation({
    summary: 'Get marketplace data',
    description:
      'Retrieve all categories with all their assigned countries by default. Use query parameters to filter: category_id (filter by category), region_id (filter by region), search (search countries by name). Filters can be combined for precise results.',
  })
  @ApiQuery({
    name: 'category_id',
    required: false,
    type: Number,
    description:
      'Filter by category ID (returns only countries in this category). Can be combined with region_id and search.',
    example: 1,
  })
  @ApiQuery({
    name: 'region_id',
    required: false,
    type: Number,
    description:
      'Filter by region ID (returns only countries in this region). Can be combined with category_id and search.',
    example: 1,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Search countries by name (searches both English and Mongolian names). Can be combined with category_id and region_id.',
    example: 'thailand',
  })
  @ApiResponse({
    status: 200,
    description: 'Marketplace data retrieved successfully',
    type: [MarketplaceCategoryDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Category or Country not found',
  })
  async getMarketplace(
    @Query(ValidationPipe) queryDto?: QueryMarketplaceDto,
  ): Promise<MarketplaceCategoryDto[]> {
    return await this.marketplaceService.getMarketplace({
      category_id: queryDto?.category_id,
      region_id: queryDto?.region_id,
      search: queryDto?.search,
    });
  }

  @Get('countries')
  @ApiOperation({
    summary: 'Get all countries for filtering',
    description:
      'Get a lightweight list of all countries (id, name, country_code) for building filter dropdowns. This is optimized for filter UI components.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all countries retrieved successfully',
    type: [CountryFilterDto],
  })
  async getAllCountriesForFilter(): Promise<CountryFilterDto[]> {
    const countries = await this.marketplaceService.getAllCountriesForFilter();
    if (!countries) {
      throw new NotFoundException('No countries found');
    }
    return countries;
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get all categories for filtering',
    description:
      'Get a lightweight list of all categories (id, name, description) for building filter dropdowns. This is optimized for filter UI components.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all categories retrieved successfully',
    type: [CategoryFilterDto],
  })
  async getAllCategoriesForFilter(): Promise<CategoryFilterDto[]> {
    return await this.marketplaceService.getAllCategoriesForFilter();
  }

  @Get('packages')
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({
    summary: 'Get eSIM packages by country code',
    description:
      'Fetch eSIM data packages from esimaccess API for a specific country. The country_code must match a country_code from the marketplace. Uses locationCode filter internally to query the esimaccess API.',
  })
  @ApiQuery({
    name: 'country_code',
    required: true,
    type: String,
    description:
      'ISO 2-letter country code (e.g., TH, US, GB) to fetch packages for. Must exist in marketplace.',
    example: 'TH',
  })
  @ApiResponse({
    status: 200,
    description: 'eSIM packages retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          packageCode: { type: 'string' },
          slug: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          currencyCode: { type: 'string' },
          volume: { type: 'number' },
          duration: { type: 'number' },
          durationUnit: { type: 'string' },
          location: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found in marketplace',
  })
  async getPackagesByCountryCode(
    @Query(ValidationPipe) queryDto: QueryPackagesDto,
  ): Promise<any[]> {
    return await this.marketplaceService.getPackagesByCountryCode(
      queryDto.country_code,
    );
  }
}
