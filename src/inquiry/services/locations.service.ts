import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  SubLocationDto,
  LocationDto,
  LocationListResponseDto,
} from '../dto/location.dto';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);
  private readonly apiBaseUrl = 'https://api.esimaccess.com/api/v1';
  private readonly accessCode = process.env.ESIM_ACCESS_CODE;

  constructor(private readonly httpService: HttpService) {}

  /**
   * Get all supported locations/countries
   */
  async getAllLocations(): Promise<LocationDto[]> {
    try {
      const url = `${this.apiBaseUrl}/open/location/list`;

      this.logger.log(`Fetching locations from: ${url}`);

      const response = await firstValueFrom(
        this.httpService.post<LocationListResponseDto>(
          url,
          {},
          {
            headers: {
              'RT-AccessCode': this.accessCode,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          },
        ),
      );

      const data: LocationListResponseDto = response.data;

      if (data && data.success && data.obj && data.obj.locationList) {
        this.logger.log(
          `Successfully fetched ${data.obj.locationList.length} locations`,
        );
        return data.obj.locationList;
      }

      this.logger.warn('No locations found in API response');
      return [];
    } catch (error) {
      this.handleError(error, 'Failed to fetch locations');
    }
  }

  /**
   * Get location details by code
   */
  async getLocationByCode(locationCode: string): Promise<LocationDto | null> {
    try {
      this.logger.log(`Fetching location details for: ${locationCode}`);

      const locations = await this.getAllLocations();

      if (!locations || locations.length === 0) {
        this.logger.warn('Unable to fetch locations for lookup');
        return null;
      }

      const location = locations.find(
        (loc: LocationDto) => loc.code === locationCode.toUpperCase(),
      );

      if (location) {
        this.logger.log(`Found location: ${location.name}`);
        return location;
      }

      this.logger.warn(`Location not found: ${locationCode}`);
      return null;
    } catch (error) {
      this.handleError(
        error,
        `Failed to fetch location details for ${locationCode}`,
      );
    }
  }
  /**
   * Get all locations by type
   */
  async getLocationByType(type: number): Promise<LocationDto[]> {
    try {
      this.logger.log(`Fetching locations for type: ${type}`);

      const locations = await this.getAllLocations();

      if (!locations || locations.length === 0) {
        this.logger.warn('Unable to fetch locations for lookup');
        return [];
      }
      const filteredLocations = locations.filter(
        (loc: LocationDto) => loc.type === type,
      );

      if (filteredLocations.length > 0) {
        this.logger.log(
          `Found ${filteredLocations.length} location(s) with type ${type}`,
        );
        return filteredLocations;
      }

      this.logger.warn(`No locations found for type: ${type}`);
      return [];
    } catch (error) {
      this.handleError(error, `Failed to fetch location details for ${type}`);
    }
  }

  /**
   * Get all single country locations
   */
  async getSingleCountries(): Promise<LocationDto[]> {
    try {
      this.logger.log('Fetching single country locations');

      const locations = await this.getAllLocations();

      if (!locations || locations.length === 0) {
        return [];
      }

      const singleCountries = locations.filter(
        (location: LocationDto) => location.type === 1,
      );

      this.logger.log(
        `Found ${singleCountries.length} single country locations`,
      );
      return singleCountries;
    } catch (error) {
      this.handleError(error, 'Failed to fetch single country locations');
    }
  }

  /**
   * Get all multi-country bundles
   */
  async getCountryBundles(): Promise<LocationDto[]> {
    try {
      this.logger.log('Fetching country bundles');

      const locations = await this.getAllLocations();

      if (!locations || locations.length === 0) {
        return [];
      }

      const bundles = locations.filter(
        (location: LocationDto) => location.type === 2,
      );

      this.logger.log(`Found ${bundles.length} country bundles`);
      return bundles;
    } catch (error) {
      this.handleError(error, 'Failed to fetch country bundles');
    }
  }

  /**
   * Get sub-locations for a bundle
   */
  async getSubLocations(bundleCode: string): Promise<SubLocationDto[]> {
    try {
      this.logger.log(`Fetching sub-locations for bundle: ${bundleCode}`);

      const location = await this.getLocationByCode(bundleCode);

      if (!location) {
        this.logger.warn(`Bundle not found: ${bundleCode}`);
        return [];
      }

      if (location.type !== 2 || !location.subLocationList) {
        this.logger.warn(`${bundleCode} is not a multi-country bundle`);
        return [];
      }

      this.logger.log(`Found ${location.subLocationList.length} sub-locations`);
      return location.subLocationList;
    } catch (error) {
      this.handleError(
        error,
        `Failed to fetch sub-locations for ${bundleCode}`,
      );
    }
  }

  /**
   * Helper method to handle errors
   */
  private handleError(error: unknown, message: string): never {
    const errorMessage = this.getErrorMessage(error);
    this.logger.error(
      `${message}: ${errorMessage}`,
      error instanceof Error ? error.stack : undefined,
    );

    throw new HttpException(
      {
        success: false,
        errorCode: 'SERVICE_ERROR',
        errorMsg: message,
        error: errorMessage,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Helper method to extract error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      const responseData = error.response?.data as
        | Record<string, unknown>
        | undefined;
      if (responseData?.errorMsg && typeof responseData.errorMsg === 'string') {
        return responseData.errorMsg;
      }
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error occurred';
  }
}
