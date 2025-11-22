import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { AuthRequest } from '../auth/interfaces/auth-request.interface';
import { DataPackageDto } from './dto/data-package.dto';
import { LocationDto } from './dto/location.dto';
import { InquiryPackagesService } from './services/inquiry.packages.service';
import { LocationsService } from './services/locations.service';
import { patch } from 'axios';
import { PackageQueryLastDto } from './dto/package.query.last.dto';

export class PackageQueryDto {
  locationCode?: string;
  type?: string;
  slug?: string;
  packageCode?: string;
  iccid?: string;
}

@ApiTags('inquiry')
@Controller('inquiry')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
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

  @Post('savePackages')
  @ApiOperation({
    summary: 'Get all available data packages',
    description: 'eSIM web-с бүх багцуудыг татаж авч, хадгалах',
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
  async saveAllPackages(): Promise<DataPackageDto[]> {
    const packages = await this.inquiryPackagesService.saveAllDataPackages();
    return packages;
  }

  @Get('favPackages')
  @ApiOperation({
    summary: 'Get all liked data packages from local DB',
    description: 'Онцлох багцуудыг local DB-аас авах',
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
  async getFavPackages(): Promise<DataPackageDto[]> {
    const packages = await this.inquiryPackagesService.getFavPackages();
    return packages;
  }

  @Get('myesim/page/:page/limit/:limit')
  @ApiOperation({
    summary: 'Get all bought data packages',
    description: 'eSIM web-с худалсан авсан багцуудыг авах',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved data packages',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch data packages from external API',
  })
  async getMyEsimPackages(
    @Request() req: AuthRequest,
    @Param('page', new ParseIntPipe()) page: number,
    @Param('limit', new ParseIntPipe()) limit: number,
  ): Promise<any> {
    const packages = await this.inquiryPackagesService.getMyEsimPackages(
      page,
      limit,
    );
    return packages;
  }

  @Post('myesim/action/:actionId/transno/:orderNo')
  @ApiOperation({
    summary: 'Get all bought data packages',
    description:
      'eSIM web-с transNo ашиглан тухайн eSIM багц дээр action хийх 1-cancel, 2-suspend, 3-unsuspend, 4-revoke',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved data packages',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch data packages from external API',
  })
  async cancelMyEsimPackage(
    @Param('actionId', new ParseIntPipe()) actionId: number,
    @Param('orderNo') orderNo: string,
    @Request() req: AuthRequest,
  ): Promise<any> {
    const packages = await this.inquiryPackagesService.actionMyEsimPackage(
      actionId,
      orderNo,
    );
    return packages;
  }

  @Post('packages/localsearch')
  @ApiOperation({
    summary: 'Search packages with custom filters from local DB',
    description:
      'Search eSIM packages with custom filter parameters from Local DB',
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
  async searchLocalPackages(
    @Body(new ValidationPipe({ whitelist: true })) body: PackageQueryLastDto,
  ): Promise<any> {
    const packages =
      await this.inquiryPackagesService.getLocalPackagesByFilters(body);

    return packages;
  }

  @Get('localPackages')
  @ApiOperation({
    summary: 'Get all liked data packages from local DB',
    description: 'Онцлох багцуудыг local DB-аас авах',
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
  async getLocalPackages(): Promise<DataPackageDto[]> {
    const packages = await this.inquiryPackagesService.getLocalPackages();
    return packages;
  }
}
