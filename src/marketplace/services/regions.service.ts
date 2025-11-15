import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Region } from '../../entities/region.entity';
import { CreateRegionDto } from '../dto/create-region.dto';
import { UpdateRegionDto } from '../dto/update-region.dto';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(Region)
    private readonly regionRepository: Repository<Region>,
  ) {}

  async findAll(): Promise<Region[]> {
    return await this.regionRepository.find({
      order: { name_en: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Region> {
    const region = await this.regionRepository.findOne({
      where: { id },
    });

    if (!region) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }

    return region;
  }

  async create(createRegionDto: CreateRegionDto): Promise<Region> {
    const region = this.regionRepository.create(createRegionDto);
    return await this.regionRepository.save(region);
  }

  async update(id: number, updateRegionDto: UpdateRegionDto): Promise<Region> {
    const region = await this.findOne(id);
    Object.assign(region, updateRegionDto);
    return await this.regionRepository.save(region);
  }

  async remove(id: number): Promise<void> {
    const region = await this.findOne(id);
    await this.regionRepository.remove(region);
  }
}

