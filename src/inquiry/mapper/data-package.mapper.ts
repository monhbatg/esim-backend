import { CreateDataPackageDto } from '../dto/create-data-package.dto';
import { DataPackageEntity } from '../../entities/data-packages.entity';
import { DataPackageLocation } from '../../entities/data-package-locations.entity';
import { DataPackageOperator } from '../../entities/data-package-operators.entity';

export class DataPackageMapper {
  static fromDto(dto: CreateDataPackageDto): DataPackageEntity {
    const dataPackage = new DataPackageEntity();

    dataPackage.packageCode = dto.packageCode;
    dataPackage.slug = dto.slug;
    dataPackage.name = dto.name;
    dataPackage.price = dto.price;
    dataPackage.currencyCode = dto.currencyCode;
    dataPackage.volume = dto.volume;
    dataPackage.smsStatus = dto.smsStatus;
    dataPackage.dataType = dto.dataType;
    dataPackage.unusedValidTime = dto.unusedValidTime;
    dataPackage.duration = dto.duration;
    dataPackage.durationUnit = dto.durationUnit;
    dataPackage.location = dto.location;
    dataPackage.locationCode = dto.locationCode;
    dataPackage.description = dto.description;
    dataPackage.activeType = dto.activeType;
    dataPackage.favorite = dto.favorite;
    dataPackage.retailPrice = dto.retailPrice;
    dataPackage.speed = dto.speed;
    dataPackage.ipExport = dto.ipExport;
    dataPackage.supportTopUpType = dto.supportTopUpType;
    dataPackage.fupPolicy = dto.fupPolicy;

    if (dto.locationNetworkList && dto.locationNetworkList.length > 0) {
      dataPackage.locationNetworkList = dto.locationNetworkList.map((loc) => {
        const location = new DataPackageLocation();
        location.locationName = loc.locationName;
        location.locationLogo = loc.locationLogo;
        location.locationCode = loc.locationCode;

        if (loc.operatorList && loc.operatorList.length > 0) {
          location.operatorList = loc.operatorList.map((op) => {
            const operator = new DataPackageOperator();
            operator.operatorName = op.operatorName;
            operator.networkType = op.networkType;
            return operator;
          });
        } else {
          location.operatorList = [];
        }

        return location;
      });
    } else {
      dataPackage.locationNetworkList = [];
    }

    return dataPackage;
  }
}
