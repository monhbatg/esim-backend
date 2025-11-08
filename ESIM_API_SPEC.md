# eSIM Access API Specification

## Overview
The Inquiry Service integrates with the eSIM Access API to fetch data packages. This document outlines the correct API configuration and endpoints.

## API Connection Details

### Base URL
```
https://api.esimaccess.com/api/v1
```

### HTTP Method
**POST** - All requests use POST method with JSON request body

### Authentication
All requests require the `RT-AccessCode` header:
```
RT-AccessCode: YOUR_ACCESS_CODE
```

**Configuration:**
- Environment Variable: `ESIM_ACCESS_CODE`
- Header Name: `RT-AccessCode`
- Header Value Format: Direct access code (not Bearer token)

### Content-Type
All requests use:
```
Content-Type: application/json
```

### Timeout
Default request timeout: **10 seconds**

## Endpoints

### 1. Get All Data Packages

**Endpoint:**
```
POST /api/v1/open/package/list
```

**Full URL:**
```
https://api.esimaccess.com/api/v1/open/package/list
```

**Headers:**
```
RT-AccessCode: YOUR_ACCESS_CODE
Content-Type: application/json
```

**Request Body:**
```json
{
  "locationCode": "",
  "type": "",
  "slug": "",
  "packageCode": "",
  "iccid": ""
}
```

**Response Example:**
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
    },
    {
      "id": "pkg_002",
      "name": "5GB Weekly Pass",
      "dataAmount": "5GB",
      "price": 14.99,
      "validity": "7 days"
    }
  ],
  "message": "Success"
}
```

### 2. Get Packages by Location (Country)

**Endpoint:**
```
POST /api/v1/open/package/list
```

**Full URL:**
```
https://api.esimaccess.com/api/v1/open/package/list
```

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

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pkg_us_001",
      "name": "1GB Daily Pass - USA",
      "dataAmount": "1GB",
      "price": 4.99,
      "validity": "24 hours",
      "countryCode": "US"
    }
  ],
  "message": "Success"
}
```

### 3. Search Packages with Filters

**Endpoint:**
```
POST /api/v1/open/package/list
```

**Request Body with Multiple Filters:**
```json
{
  "locationCode": "US",
  "type": "data",
  "slug": "NA-3_1_7",
  "packageCode": "PKG123",
  "iccid": "8901234567890123456789"
}
```

## Request Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| locationCode | string | No | ISO 2-letter country code (e.g., US, GB, JP) |
| type | string | No | Package type filter |
| slug | string | No | Package slug identifier |
| packageCode | string | No | Specific package code |
| iccid | string | No | ICCID filter |

## cURL Examples

### Get All Packages
```bash
curl --location 'https://api.esimaccess.com/api/v1/open/package/list' \
  --header 'RT-AccessCode: YOUR_ACCESS_CODE' \
  --header 'Content-Type: application/json' \
  --data '{
    "locationCode": "",
    "type": "",
    "slug": "",
    "packageCode": "",
    "iccid": ""
  }'
```

### Get Packages for Specific Country
```bash
curl --location 'https://api.esimaccess.com/api/v1/open/package/list' \
  --header 'RT-AccessCode: YOUR_ACCESS_CODE' \
  --header 'Content-Type: application/json' \
  --data '{
    "locationCode": "US",
    "type": "",
    "slug": "",
    "packageCode": "",
    "iccid": ""
  }'
```

### Search with Multiple Filters
```bash
curl --location 'https://api.esimaccess.com/api/v1/open/package/list' \
  --header 'RT-AccessCode: YOUR_ACCESS_CODE' \
  --header 'Content-Type: application/json' \
  --data '{
    "locationCode": "US",
    "type": "data",
    "slug": "NA-3_1_7",
    "packageCode": "",
    "iccid": ""
  }'
```

## Error Responses

### Missing Access Code
**Status:** 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid or missing RT-AccessCode"
}
```

### Invalid Request Body
**Status:** 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request parameters"
}
```

### Server Error
**Status:** 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

### Request Timeout
**Status:** 408 Request Timeout
```json
{
  "success": false,
  "message": "Request timeout"
}
```

## Data Types

### PackageQueryParams Object
```typescript
{
  locationCode?: string;    // ISO country code
  type?: string;            // Package type
  slug?: string;            // Package slug
  packageCode?: string;     // Specific package code
  iccid?: string;           // ICCID identifier
}
```

### DataPackage Object
```typescript
{
  id: string;              // Unique identifier
  name: string;            // Package name
  dataAmount?: string;     // e.g., "1GB", "5GB"
  price?: number;          // Price in USD
  validity?: string;       // Validity period
}
```

### API Response Object
```typescript
{
  success: boolean;        // Request success status
  data?: DataPackage[];    // Array of packages
  message?: string;        // Response message
  error?: string;          // Error details (if failed)
}
```

## Rate Limiting

The API may implement rate limiting. Recommended practices:
- Implement exponential backoff for retries
- Cache responses when possible
- Use the cache-manager package in NestJS
- Monitor rate limit headers in responses

## Best Practices

1. **Always include RT-AccessCode header**
   - Never hardcode the access code in requests
   - Use environment variables
   - Rotate access codes regularly

2. **Handle errors gracefully**
   - Implement retry logic with exponential backoff
   - Log all errors for debugging
   - Return appropriate HTTP status codes to clients

3. **Optimize performance**
   - Cache package data when appropriate
   - Implement request throttling
   - Use connection pooling

4. **Security**
   - Use HTTPS only
   - Store access codes securely
   - Validate all inputs
   - Implement request signing if required

## Testing the Connection

### Using Node.js
```javascript
const axios = require('axios');

const response = await axios.post('https://api.esimaccess.com/api/v1/open/package/list', {
  locationCode: 'US',
  type: '',
  slug: '',
  packageCode: '',
  iccid: ''
}, {
  headers: {
    'RT-AccessCode': 'YOUR_ACCESS_CODE',
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

console.log(response.data);
```

### Using our NestJS Service
```typescript
import { InquiryPackagesService } from './inquiry/services/inquiry.packages.service';

// Inject the service
constructor(private inquiryService: InquiryPackagesService) {}

// Get all packages
const packages = await this.inquiryService.getAllDataPackages();

// Get packages by country
const usPackages = await this.inquiryService.getDataPackagesByCountry('US');

// Search with custom filters
const filteredPackages = await this.inquiryService.getPackagesByFilters({
  locationCode: 'US',
  type: 'data',
  slug: 'NA-3_1_7'
});
```

## Configuration

### Environment Setup
Create a `.env` file in the project root:

```env
# eSIM API Configuration
ESIM_ACCESS_CODE=your-actual-access-code-here
```

### Module Setup
The InquiryModule is already configured in `app.module.ts`:

```typescript
import { InquiryModule } from './inquiry/inquiry.module';

@Module({
  imports: [
    // ... other modules
    InquiryModule,
  ],
})
export class AppModule {}
```

## Troubleshooting

### Issue: "Invalid or missing RT-AccessCode"
- Verify `ESIM_ACCESS_CODE` is set in `.env`
- Check that the access code is correct
- Ensure the access code hasn't expired

### Issue: "Invalid request parameters"
- Verify request body format is JSON
- Check that all parameters are strings or null
- Ensure no extra fields in request body

### Issue: "Connection refused"
- Verify network connectivity
- Check if API URL is correct: `https://api.esimaccess.com/api/v1/open/package/list`
- Ensure firewall allows HTTPS (port 443)

### Issue: "Request timeout"
- Check network latency
- Increase timeout if needed (currently 10 seconds)
- Verify external API is responding

## Support and Documentation

For more information:
- eSIM Access API Documentation: https://docs.esimaccess.com
- This module README: `src/inquiry/INQUIRY_README.md`
- Integration Summary: `INQUIRY_INTEGRATION_SUMMARY.md`
- Quick Start Guide: `INQUIRY_QUICKSTART.md`

## Version History

### Current Version (v1)
- Base URL: `https://api.esimaccess.com/api/v1`
- Endpoint: `POST /open/package/list`
- Authentication: `RT-AccessCode` header
- Request Method: POST with JSON body
- Supports: All packages, Country-filtered packages, Custom filtered search

---

Last Updated: 2024
