# Inquiry Module - eSIM Data Packages

This module provides endpoints to fetch data packages from the external eSIM Access API.

## Overview

The Inquiry module integrates with the eSIM provider API to retrieve available data packages and packages for specific countries.

## Features

- **Get All Data Packages**: Fetch all available data packages from the eSIM provider
- **Get Packages by Country**: Filter data packages by country code
- **Error Handling**: Comprehensive error handling and logging
- **Type Safety**: Full TypeScript support with proper interfaces

## Setup

### Environment Configuration

Add the following to your `.env` file:

```env
ESIM_ACCESS_CODE=your-esim-access-code-here
```

### Module Structure

```
inquiry/
├── dto/
│   └── data-package.dto.ts      # Data transfer objects for API responses
├── services/
│   └── inquiry.packages.service.ts  # Service for API calls
├── inquiry.controller.ts        # Controller with endpoints
├── inquiry.module.ts            # Module configuration
└── INQUIRY_README.md           # This file
```

## API Endpoints

### 1. Get All Data Packages

**Endpoint:** `POST /inquiry/packages`

**Description:** Retrieves all available eSIM data packages

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pkg_001",
      "name": "1GB Daily Pass",
      "dataAmount": "1GB",
      "price": 4.99,
      "validity": "24 hours"
    }
  ],
  "message": "Data packages retrieved successfully"
}
```

**Status Codes:**
- `200 OK` - Packages retrieved successfully
- `500 Internal Server Error` - Failed to fetch from external API

### 2. Get Packages by Country

**Endpoint:** `POST /inquiry/packages/country/:countryCode`

**Description:** Fetches eSIM data packages for a specific country

**Request Body:**
```json
{
  "locationCode": "US",
  "type": "",
  "slug": "",
  "packageCode": "",
  "iccid": ""
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pkg_002",
      "name": "5GB Weekly Pass",
      "dataAmount": "5GB",
      "price": 14.99,
      "validity": "7 days"
    }
  ],
  "message": "Data packages for US retrieved successfully"
}
```

**Status Codes:**
- `200 OK` - Packages retrieved successfully
- `400 Bad Request` - Missing or invalid location code
- `500 Internal Server Error` - Failed to fetch from external API

### 3. Search Packages with Filters

**Endpoint:** `POST /inquiry/packages/search`

**Description:** Search packages with custom filter parameters

**Request Body:**
```json
{
  "locationCode": "US",
  "type": "data",
  "slug": "NA-3_1_7",
  "packageCode": "",
  "iccid": ""
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pkg_003",
      "name": "Custom Package",
      "dataAmount": "10GB",
      "price": 29.99,
      "validity": "30 days"
    }
  ],
  "message": "Packages retrieved successfully"
}
```

**Status Codes:**
- `200 OK` - Packages retrieved successfully
- `500 Internal Server Error` - Failed to fetch from external API

## Service Methods

### `getAllDataPackages(): Promise<DataPackage[]>`

Fetches all available data packages from the eSIM provider API.

**Usage:**
```typescript
const packages = await this.inquiryPackagesService.getAllDataPackages();
```

### `getDataPackagesByCountry(countryCode: string): Promise<DataPackage[]>`

Fetches data packages filtered by country.

**Usage:**
```typescript
const packages = await this.inquiryPackagesService.getDataPackagesByCountry('US');
```

## Data Types

### DataPackage Interface

```typescript
interface DataPackage {
  id: string;
  name: string;
  dataAmount?: string;
  price?: number;
  validity?: string;
}
```

### API Response Interface

```typescript
interface ApiResponse {
  success: boolean;
  data?: DataPackage[];
  message?: string;
}
```

## Error Handling

The service handles the following errors:

1. **Network Errors**: Connection timeouts, connection refused
2. **API Errors**: Invalid responses, missing data
3. **Authorization Errors**: Invalid or missing API key
4. **Timeout Errors**: Requests exceeding the 10-second timeout

All errors are logged using the NestJS Logger and returned as HTTP exceptions with appropriate status codes.

## Example Usage

### In a Controller

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { InquiryPackagesService } from './services/inquiry.packages.service';

@Controller('inquiry')
export class InquiryController {
  constructor(private readonly inquiryPackagesService: InquiryPackagesService) {}

  @Get('packages')
  async getAllPackages() {
    const packages = await this.inquiryPackagesService.getAllDataPackages();
    return {
      success: true,
      data: packages,
    };
  }
}
```

## Testing

To test the endpoints, you can use curl:

```bash
# Get all packages
curl http://localhost:3000/inquiry/packages

# Get packages for a specific country
curl "http://localhost:3000/inquiry/packages/country?countryCode=US"
```

## API Integration Points

### External API Endpoint
- **Base URL:** `https://api.esimaccess.com/api/v1`
- **Endpoint:** `/packages`
- **Authentication:** RT-AccessCode header
- **Timeout:** 10 seconds

### Request Format
```http
GET /api/v1/packages?country=US
RT-AccessCode: YOUR_ACCESS_CODE
Content-Type: application/json
```

## API Key Security

The access code is retrieved from the environment variable `ESIM_ACCESS_CODE` and passed in the RT-AccessCode header:

```
RT-AccessCode: YOUR_ACCESS_CODE
```

Make sure to:
- Never commit `.env` files to version control
- Store access codes securely in your deployment environment
- Rotate access codes regularly
- Monitor API usage and rate limits

## Rate Limiting

The external API may have rate limits. Consider implementing:
- Request caching with cache-manager
- Rate limiting middleware
- Request queuing for bulk operations

## Future Enhancements

- [ ] Implement caching for package data
- [ ] Add pagination support
- [ ] Add search/filter capabilities
- [ ] Add webhook support for package updates
- [ ] Implement request retry logic with exponential backoff
- [ ] Add metrics and monitoring
