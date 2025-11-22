/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {
  forwardRef,
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { CreateDataPackageDto } from '../dto/create-data-package.dto';
import { DataPackageMapper } from '../mapper/data-package.mapper';
import { DataPackageEntity } from '../../entities/data-packages.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Util } from '../../transactions/utils/util';
import { EsimItem } from '../dto/esim.package.response.dto';
import { TransactionsService } from '../../transactions/transactions.service';
import { QueryEsimDto } from '../../transactions/dto/query-esim.dto';

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

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(DataPackageEntity)
    private readonly dataPackageRepo: Repository<DataPackageEntity>,
    @Inject(forwardRef(() => TransactionsService))
    private readonly transactionsService: TransactionsService,
  ) {}

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
      const data: any = error.response?.data;

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

  async saveAllDataPackages(): Promise<DataPackage[]> {
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
      const savedEntities: DataPackageEntity[] = [];
      if (
        data &&
        data.success &&
        data.obj &&
        Array.isArray(data.obj.packageList) &&
        data.obj.packageList.length > 0
      ) {
        const packages = data.obj.packageList;
        this.logger.log(`Successfully fetched ${packages.length} packages`);

        // Map API package -> CreateDataPackageDto -> entity using mapper
        const entities: DataPackageEntity[] = packages
          .map((pkg) => {
            try {
              return DataPackageMapper.fromDto(
                pkg as unknown as CreateDataPackageDto,
              ) as unknown as DataPackageEntity;
            } catch (err) {
              this.logger.error(
                'Mapping package to entity failed',
                err as Error,
              );
              return null;
            }
          })
          .filter((e): e is DataPackageEntity => e !== null);

        if (entities.length === 0) {
          this.logger.warn('No mappable entities found - nothing to save');
          return packages;
        }

        // Prefer bulk upsert if available (insert or update on conflict)
        /* 
        // Commented out because upsert overwrites local fields like buyPrice with null/default
        if (typeof (this.dataPackageRepo as any).upsert === 'function') {
          try {
            // Use packageCode as unique key. Adjust conflictPaths if your unique column differs.
            await (this.dataPackageRepo as any).upsert(entities, ['packageCode']);
            this.logger.log(`Upserted ${entities.length} packages using repository.upsert`);
            // Fetch and return saved rows (optional)
            const packageCodes = entities.map((e) => e.packageCode);
            const saved = await this.dataPackageRepo.findBy(packageCodes.length ? { packageCode: packageCodes } as any : {});
            return saved;
          } catch (err) {
            this.logger.error('Bulk upsert failed, falling back to per-item save', err as Error);
          }
        } 
        */

        // Fallback: preload existing and save per item (works with older TypeORM)

        for (const entity of entities) {
          try {
            // Try to preload existing by unique key
            const existing = await this.dataPackageRepo.findOneBy({
              packageCode: entity.packageCode,
            } as any);
            if (existing) {
              const merged = this.dataPackageRepo.merge(existing, entity);
              savedEntities.push(await this.dataPackageRepo.save(merged));
            } else {
              savedEntities.push(await this.dataPackageRepo.save(entity));
            }
          } catch (err) {
            this.logger.error(
              `Failed to save package ${entity.packageCode}`,
              err as Error,
            );
          }
        }

        this.logger.log(
          `Saved ${savedEntities.length} packages to DB (fallback path)`,
        );
        return savedEntities;
      }

      this.logger.warn('No packages found in API response');
      return savedEntities;
    } catch (error) {
      this.handleError(error, 'Failed to fetch data packages');
    }
  }

  async getMyEsimPackages(
    page: number,
    limit: number,
    orderNo?: string,
    esimTranNo?: string,
    iccid?: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `Querying eSIM packages from local database with filters: orderNo=${orderNo || ''}, esimTranNo=${esimTranNo || ''}, iccid=${iccid || ''}`,
      );

      const queryDto: QueryEsimDto = {
        orderNo: orderNo || '',
        esimTranNo: esimTranNo || '',
        iccid: iccid || '',
        pager: {
          pageNum: page,
          pageSize: limit,
        },
      };

      const result =
        await this.transactionsService.queryEsimPurchases(queryDto);

      this.logger.log(
        `Found ${result.obj.esimList.length} eSIM packages (total: ${result.obj.pager.total})`,
      );

      return result;
    } catch (error) {
      this.handleError(error, 'Failed to get My eSIM packages');
    }
  }

  async actionMyEsimPackage(actionNo: number, orderNo: string): Promise<any[]> {
    try {
      this.logger.log(`Performing action ${actionNo} on eSIM: ${orderNo}`);

      // Fetch all eSIM packages
      const myEsimResponse: any = await this.getMyEsimPackages(1, 100);
      // Check if esimTranNo exists in the response
      const found = myEsimResponse?.obj?.esimList?.find(
        (esim: EsimItem) => esim.orderNo === orderNo,
      );

      if (!found) {
        this.logger.warn(`eSIM not found for identifier ${orderNo}`);
        throw new HttpException(
          {
            success: false,
            message: `eSIM not found for identifier ${orderNo}`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const targetEsimTranNo = found.esimTranNo;
      this.logger.log(
        `Found eSIM. esimTranNo=${targetEsimTranNo}, proceeding with action ${actionNo}`,
      );

      const url = `${this.apiBaseUrl}${Util.selectUrl(actionNo)}`;
      this.logger.log(`Fetching data packages from: ${url}`);
      const response: any = await firstValueFrom(
        this.httpService.post<ApiResponse>(
          url,
          {
            esimTranNo: targetEsimTranNo,
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
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to get My eSIM packages');
    }
  }

  // Get from local database
  async getLocalPackages(): Promise<DataPackageEntity[]> {
    try {
      const favs = await this.dataPackageRepo.find({});
      this.logger.log(`Found ${favs.length} all packages`);
      return favs;
    } catch (error) {
      this.handleError(error, 'Failed to get favorite packages');
    }
  }

  async getFavPackages(): Promise<DataPackageEntity[]> {
    try {
      const favs = await this.dataPackageRepo.find({
        where: { favorite: true },
      });
      this.logger.log(`Found ${favs.length} favorite packages`);
      return favs;
    } catch (error) {
      this.handleError(error, 'Failed to get favorite packages');
    }
  }

  async getLocalPackagesByFilters(params: PackageQueryParams): Promise<any> {
    try {
      this.logger.log(
        `Querying local packages with filters: ${JSON.stringify(params)}`,
      );

      const qb = this.dataPackageRepo.createQueryBuilder('p');

      if (params.locationCode) {
        qb.andWhere('p.location = :location', {
          location: params.locationCode,
        });
      }

      if (params.type) {
        // try common type fields on the entity: dataType or activeType or type
        qb.andWhere(
          '(p.dataType = :type OR p.activeType = :type OR p.type = :type)',
          { type: params.type },
        );
      }

      if (params.slug) {
        qb.andWhere('p.slug ILIKE :slug', { slug: `%${params.slug}%` });
      }

      if (params.packageCode) {
        qb.andWhere('p.packageCode = :packageCode', {
          packageCode: params.packageCode,
        });
      }

      const results = await qb.getMany();
      this.logger.log(
        `Found ${results.length} local packages matching filters`,
      );
      return results;
    } catch (error) {
      this.handleError(error, 'Failed to fetch local packages with filters');
    }
  }
}
