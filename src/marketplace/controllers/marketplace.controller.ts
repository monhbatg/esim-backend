import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MarketplaceService } from '../services/marketplace.service';
import { MarketplaceCategoryDto } from '../dto/marketplace-response.dto';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get()
  @ApiOperation({
    summary: 'Get marketplace data',
    description:
      'Retrieve all categories with their assigned countries and region information. This is the main endpoint for displaying the marketplace to users.',
  })
  @ApiResponse({
    status: 200,
    description: 'Marketplace data retrieved successfully',
    type: [MarketplaceCategoryDto],
    schema: {
      example: [
        {
          name_en: 'Top Destinations',
          name_mn: 'Шилдэг чиглэлүүд',
          description_en:
            'Most popular travel destinations for Mongolians based on bookings and trends.',
          description_mn: 'Монголчуудын хамгийн их аялдаг, эрэлттэй чиглэлүүд.',
          countries: [
            {
              name_en: 'Thailand',
              name_mn: 'Тайланд',
              image: '/img/flags/th.png',
              region: {
                name_en: 'Asia',
                name_mn: 'Ази',
              },
            },
          ],
        },
      ],
    },
  })
  async getMarketplace(): Promise<MarketplaceCategoryDto[]> {
    return await this.marketplaceService.getMarketplace();
  }
}
