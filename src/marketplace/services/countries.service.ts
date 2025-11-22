import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from '../../entities/country.entity';
import { Region } from '../../entities/region.entity';
import { CreateCountryDto } from '../dto/create-country.dto';
import { UpdateCountryDto } from '../dto/update-country.dto';
import { QueryCountriesDto } from '../dto/query-countries.dto';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(Region)
    private readonly regionRepository: Repository<Region>,
  ) {}

  async findAll(queryDto?: QueryCountriesDto): Promise<Country[]> {
    const queryBuilder = this.countryRepository
      .createQueryBuilder('country')
      .leftJoinAndSelect('country.region', 'region')
      .orderBy('country.name_en', 'ASC');

    if (queryDto?.region_id) {
      queryBuilder.where('country.region_id = :regionId', {
        regionId: queryDto.region_id,
      });
    }

    return await queryBuilder.getMany();
  }

  async findOne(id: number): Promise<Country> {
    const country = await this.countryRepository.findOne({
      where: { id },
      relations: ['region'],
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${id} not found`);
    }

    return country;
  }

  async create(createCountryDto: CreateCountryDto): Promise<Country> {
    // Verify region exists
    const region = await this.regionRepository.findOne({
      where: { id: createCountryDto.region_id },
    });

    if (!region) {
      throw new BadRequestException(
        `Region with ID ${createCountryDto.region_id} not found`,
      );
    }

    const country = this.countryRepository.create(createCountryDto);
    return await this.countryRepository.save(country);
  }

  async update(
    id: number,
    updateCountryDto: UpdateCountryDto,
  ): Promise<Country> {
    const country = await this.findOne(id);

    // If region_id is being updated, verify the new region exists
    if (updateCountryDto.region_id) {
      const region = await this.regionRepository.findOne({
        where: { id: updateCountryDto.region_id },
      });

      if (!region) {
        throw new BadRequestException(
          `Region with ID ${updateCountryDto.region_id} not found`,
        );
      }
    }

    Object.assign(country, updateCountryDto);
    return await this.countryRepository.save(country);
  }

  async remove(id: number): Promise<void> {
    const country = await this.findOne(id);
    await this.countryRepository.remove(country);
  }
}
