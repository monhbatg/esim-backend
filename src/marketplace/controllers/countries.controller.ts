import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { CountriesService } from '../services/countries.service';
import { CreateCountryDto } from '../dto/create-country.dto';
import { UpdateCountryDto } from '../dto/update-country.dto';
import { QueryCountriesDto } from '../dto/query-countries.dto';
import { CountryResponseDto } from '../dto/country-response.dto';

@ApiTags('marketplace-countries')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all countries',
    description:
      'Retrieve a list of all countries with optional filtering by region_id',
  })
  @ApiQuery({
    name: 'region_id',
    required: false,
    type: Number,
    description: 'Filter countries by region ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Countries retrieved successfully',
    type: [CountryResponseDto],
  })
  async findAll(
    @Query(ValidationPipe) queryDto?: QueryCountriesDto,
  ): Promise<CountryResponseDto[]> {
    return await this.countriesService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get country by ID',
    description:
      'Retrieve a specific country by its ID with region information',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Country ID' })
  @ApiResponse({
    status: 200,
    description: 'Country retrieved successfully',
    type: CountryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CountryResponseDto> {
    return await this.countriesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new country',
    description:
      'Create a new country with English and Mongolian names, region, and country code',
  })
  @ApiBody({ type: CreateCountryDto })
  @ApiResponse({
    status: 201,
    description: 'Country created successfully',
    type: CountryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or region not found',
  })
  async create(
    @Body(ValidationPipe) createCountryDto: CreateCountryDto,
  ): Promise<CountryResponseDto> {
    return await this.countriesService.create(createCountryDto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a country',
    description: 'Update an existing country by its ID',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Country ID' })
  @ApiBody({ type: UpdateCountryDto })
  @ApiResponse({
    status: 200,
    description: 'Country updated successfully',
    type: CountryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or region not found',
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateCountryDto: UpdateCountryDto,
  ): Promise<CountryResponseDto> {
    return await this.countriesService.update(id, updateCountryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a country',
    description: 'Delete a country by its ID',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Country ID' })
  @ApiResponse({
    status: 200,
    description: 'Country deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Country deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.countriesService.remove(id);
    return { message: 'Country deleted successfully' };
  }
}
