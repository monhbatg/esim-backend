/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

interface Operator {
  operatorName: string;
  networkType: string;
}

interface LocationNetwork {
  locationName: string;
  locationLogo: string;
  operatorList: Operator[];
}

interface DataPackage {
  packageCode: string;
  slug: string;
  name: string;
  price: number;
  currencyCode: string;
  volume: number;
  smsStatus?: number;
  dataType?: number;
  unusedValidTime?: number;
  duration: number;
  durationUnit: string;
  location: string;
  description: string;
  activeType?: number;
  favorite?: boolean;
  retailPrice?: number;
  speed?: string;
  locationNetworkList: LocationNetwork[];
}

interface ApiDataObject {
  packageList: DataPackage[];
}

interface ApiResponse {
  errorCode: string | null;
  errorMsg: string | null;
  success: boolean;
  obj: ApiDataObject;
}

interface PackageQueryParams {
  locationCode?: string;
  type?: string;
  slug?: string;
  packageCode?: string;
  iccid?: string;
}

@Injectable()
export class InquiryPackagesService {
  private readonly logger = new Logger(InquiryPackagesService.name);
  private readonly apiBaseUrl = 'https://api.esimaccess.com/api/v1';
  private readonly accessCode = process.env.ESIM_ACCESS_CODE;

  constructor(private readonly httpService: HttpService) {}

  /**
   * Get all available data packages from eSIM provider
   */
  async getAllDataPackages(): Promise<DataPackage[]> {
    try {
      const url = `${this.apiBaseUrl}/open/package/list`;
      this.logger.log(`Fetching data packages from: ${url}`);

      const response: any = await firstValueFrom(
        this.httpService.post<ApiResponse>(
          url,
          {
            locationCode: '',
            type: '',
            slug: '',
            packageCode: '',
            iccid: '',
          },
          {
            headers: {
              'RT-AccessCode': this.accessCode,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          },
        ),
      );

      const data: ApiResponse = response.data;

      if (data && data.success && data.obj && data.obj.packageList) {
        this.logger.log(
          `Successfully fetched ${data.obj.packageList.length} packages`,
        );
        return data.obj.packageList;
      }

      this.logger.warn('No packages found in API response');
      return [];
    } catch (error) {
      this.handleError(error, 'Failed to fetch data packages');
    }
  }

  /**
   * Get data packages with filters
   */
  async getDataPackagesByCountry(
    countryCode: string,
    params?: Partial<PackageQueryParams>,
  ): Promise<DataPackage[]> {
    try {
      const url = `${this.apiBaseUrl}/open/package/list`;

      this.logger.log(`Fetching data packages for country: ${countryCode}`);

      const requestBody = {
        locationCode: countryCode,
        type: params?.type || '',
        slug: params?.slug || '',
        packageCode: params?.packageCode || '',
        iccid: params?.iccid || '',
      };

      const response: any = await firstValueFrom(
        this.httpService.post<ApiResponse>(url, requestBody, {
          headers: {
            'RT-AccessCode': this.accessCode,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }),
      );

      const data: ApiResponse = response.data;

      if (data && data.success && data.obj && data.obj.packageList) {
        this.logger.log(
          `Successfully fetched ${data.obj.packageList.length} packages for ${countryCode}`,
        );
        return data.obj.packageList;
      }

      this.logger.warn(`No packages found for country ${countryCode}`);
      return [];
    } catch (error) {
      this.handleError(
        error,
        `Failed to fetch data packages for ${countryCode}`,
      );
    }
  }

  /**
   * Get packages with custom filter parameters
   */
  async getPackagesByFilters(
    params: PackageQueryParams,
  ): Promise<DataPackage[]> {
    try {
      const url = `${this.apiBaseUrl}/open/package/list`;

      this.logger.log(
        `Fetching packages with filters: ${JSON.stringify(params)}`,
      );

      const requestBody = {
        locationCode: params.locationCode || '',
        type: params.type || '',
        slug: params.slug || '',
        packageCode: params.packageCode || '',
        iccid: params.iccid || '',
      };

      const response: any = await firstValueFrom(
        this.httpService.post<ApiResponse>(url, requestBody, {
          headers: {
            'RT-AccessCode': this.accessCode,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }),
      );

      const data: ApiResponse = response.data;

      if (data && data.success && data.obj && data.obj.packageList) {
        this.logger.log(
          `Successfully fetched ${data.obj.packageList.length} packages`,
        );
        return data.obj.packageList;
      }

      this.logger.warn('No packages found with the given filters');
      return [];
    } catch (error) {
      this.handleError(error, 'Failed to fetch packages with filters');
    }
  }

  /**
   * Get all supported regions/countries
   */
  async getSupportedRegions(): Promise<LocationNetwork[]> {
    try {
      this.logger.log('Extracting supported regions from packages');

      // Get all packages
      const packages = await this.getAllDataPackages();

      if (!packages || packages.length === 0) {
        this.logger.warn('No packages found to extract regions from');
        return [];
      }

      // Extract unique regions from all packages
      const regionsMap = new Map<string, LocationNetwork>();

      packages.forEach((pkg: DataPackage) => {
        if (pkg.locationNetworkList && pkg.locationNetworkList.length > 0) {
          pkg.locationNetworkList.forEach((location: LocationNetwork) => {
            const key = location.locationName;

            if (!regionsMap.has(key)) {
              regionsMap.set(key, {
                locationName: location.locationName,
                locationLogo: location.locationLogo,
                operatorList: [],
              });
            }

            // Merge operators, avoiding duplicates
            const existingRegion = regionsMap.get(key);
            if (existingRegion) {
              location.operatorList.forEach((operator: Operator) => {
                const operatorExists = existingRegion.operatorList.some(
                  (op: Operator) =>
                    op.operatorName === operator.operatorName &&
                    op.networkType === operator.networkType,
                );

                if (!operatorExists) {
                  existingRegion.operatorList.push(operator);
                }
              });
            }
          });
        }
      });

      const regions = Array.from(regionsMap.values()).sort((a, b) =>
        a.locationName.localeCompare(b.locationName),
      );

      this.logger.log(`Found ${regions.length} unique regions`);
      return regions;
    } catch (error) {
      this.handleError(error, 'Failed to fetch supported regions');
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
        message: message,
        error: errorMessage,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Helper method to extract error message from various error types
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const data: any = error.response?.data;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      if (data?.message && typeof data.message === 'string') {
        return data.message;
      }
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error occurred';
  }
}
