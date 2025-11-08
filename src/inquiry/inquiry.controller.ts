import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataPackageDto } from './dto/data-package.dto';
import { LocationDto } from './dto/location.dto';
import { InquiryPackagesService } from './services/inquiry.packages.service';
import { LocationsService } from './services/locations.service';

export class PackageQueryDto {
  locationCode?: string;
  type?: string;
  slug?: string;
  packageCode?: string;
  iccid?: string;
}

@ApiTags('inquiry')
@Controller('inquiry')
export class InquiryController {
  constructor(
    private readonly inquiryPackagesService: InquiryPackagesService,
    private readonly locationsService: LocationsService,
  ) {}

  @Get('packages')
  @ApiOperation({
    summary: 'Get all available data packages',
    description:
      'Fetches all available eSIM data packages from the provider API',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved data packages',
    type: DataPackageDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch data packages from external API',
  })
  async getAllPackages(): Promise<DataPackageDto[]> {
    const packages = await this.inquiryPackagesService.getAllDataPackages();
    return packages;
  }

  @Post('packages/country/:countryCode')
  @ApiOperation({
    summary: 'Get data packages by country',
    description: 'Fetches eSIM data packages available for a specific country',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved data packages for the country',
    type: DataPackageDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid location code',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch data packages from external API',
  })
  async getPackagesByCountry(
    @Body() params: PackageQueryDto,
  ): Promise<DataPackageDto[]> {
    if (!params.locationCode || params.locationCode.trim().length === 0) {
      throw new HttpException(
        {
          success: false,
          errorCode: 'INVALID_LOCATION',
          errorMsg: 'Location code is required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const packages = await this.inquiryPackagesService.getDataPackagesByCountry(
      params.locationCode.toUpperCase(),
      params,
    );

    return packages;
  }

  @Post('packages/search')
  @ApiOperation({
    summary: 'Search packages with custom filters',
    description: 'Search eSIM packages with custom filter parameters',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved filtered packages',
    type: DataPackageDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch packages from external API',
  })
  async searchPackages(
    @Body() params: PackageQueryDto,
  ): Promise<DataPackageDto[]> {
    const packages =
      await this.inquiryPackagesService.getPackagesByFilters(params);

    return packages;
  }

  @Get('locations')
  @ApiOperation({
    summary: 'Get list of all supported locations/countries',
    description:
      'Fetches all supported locations and country bundles with their details',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved locations list',
    type: [LocationDto],
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch locations from external API',
  })
  async getAllLocations(): Promise<LocationDto[]> {
    return await this.locationsService.getAllLocations();
  }

  @Get('locations/:code')
  @ApiOperation({
    summary: 'Get location details by code',
    description: 'Fetches details for a specific location or country bundle',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved location details',
    type: LocationDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Location not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch location details',
  })
  async getLocationDetails(@Param('code') code: string): Promise<LocationDto> {
    if (!code || code.trim().length === 0) {
      throw new HttpException(
        {
          success: false,
          errorCode: 'INVALID_CODE',
          errorMsg: 'Location code is required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const location = await this.locationsService.getLocationByCode(code);

    if (!location) {
      throw new HttpException(
        {
          success: false,
          errorCode: 'NOT_FOUND',
          errorMsg: `Location code ${code} not found`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return location;
  }
  @Get('locations/type/:type')
  @ApiOperation({
    summary: 'Get locations by type',
    description: 'Fetches all locations or country bundles of a specific type',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved locations',
    type: [LocationDto],
  })
  @ApiResponse({
    status: 404,
    description: 'No locations found for the specified type',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch location details',
  })
  async getLocationDetailsByType(
    @Param('type', new ParseIntPipe()) type: number,
  ): Promise<LocationDto[]> {
    if (!type) {
      throw new HttpException(
        {
          success: false,
          errorCode: 'INVALID_TYPE',
          errorMsg: 'Location type is required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const locations = await this.locationsService.getLocationByType(type);

    if (!locations || locations.length === 0) {
      throw new HttpException(
        {
          success: false,
          errorCode: 'NOT_FOUND',
          errorMsg: `No locations found for type ${type}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return locations;
  }
}
