import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { RegionsService } from '../services/regions.service';
import { CreateRegionDto } from '../dto/create-region.dto';
import { UpdateRegionDto } from '../dto/update-region.dto';
import { RegionResponseDto } from '../dto/region-response.dto';

@ApiTags('marketplace-regions')
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all regions',
    description: 'Retrieve a list of all regions ordered by English name',
  })
  @ApiResponse({
    status: 200,
    description: 'Regions retrieved successfully',
    type: [RegionResponseDto],
  })
  async findAll(): Promise<RegionResponseDto[]> {
    return await this.regionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get region by ID',
    description: 'Retrieve a specific region by its ID',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Region ID' })
  @ApiResponse({
    status: 200,
    description: 'Region retrieved successfully',
    type: RegionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Region not found',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RegionResponseDto> {
    return await this.regionsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new region',
    description: 'Create a new region with English and Mongolian names',
  })
  @ApiBody({ type: CreateRegionDto })
  @ApiResponse({
    status: 201,
    description: 'Region created successfully',
    type: RegionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async create(
    @Body(ValidationPipe) createRegionDto: CreateRegionDto,
  ): Promise<RegionResponseDto> {
    return await this.regionsService.create(createRegionDto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a region',
    description: 'Update an existing region by its ID',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Region ID' })
  @ApiBody({ type: UpdateRegionDto })
  @ApiResponse({
    status: 200,
    description: 'Region updated successfully',
    type: RegionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 404,
    description: 'Region not found',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateRegionDto: UpdateRegionDto,
  ): Promise<RegionResponseDto> {
    return await this.regionsService.update(id, updateRegionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a region',
    description:
      'Delete a region by its ID. This will cascade delete all associated countries.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Region ID' })
  @ApiResponse({
    status: 200,
    description: 'Region deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Region deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Region not found',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.regionsService.remove(id);
    return { message: 'Region deleted successfully' };
  }
}
