# API Endpoint Update - POST Method Implementation

## ✅ Updates Complete

The eSIM Inquiry Service has been updated to use the correct **POST** endpoint format as specified in the eSIM Access API documentation.

## What Changed

### 1. HTTP Method
**Before:** GET requests  
**After:** POST requests

### 2. Endpoint URL
**Before:** `GET /api/v1/packages`  
**After:** `POST /api/v1/open/package/list`

### 3. Request Format
**Before:** Query parameters  
**After:** JSON request body

### 4. Request Body Structure
```json
{
  "locationCode": "",      // ISO country code
  "type": "",              // Package type
  "slug": "",              // Package slug
  "packageCode": "",       // Specific package code
  "iccid": ""              // ICCID identifier
}
```

## Updated Endpoints

### 1. Get All Packages
```
POST /inquiry/packages
```
Body: `{}` (empty object or all fields empty)

### 2. Get Packages by Country
```
POST /inquiry/packages/country/:countryCode
```
Body:
```json
{
  "locationCode": "US",
  "type": "",
  "slug": "",
  "packageCode": "",
  "iccid": ""
}
```

### 3. Search Packages (New)
```
POST /inquiry/packages/search
```
Body with filters:
```json
{
  "locationCode": "US",
  "type": "data",
  "slug": "NA-3_1_7",
  "packageCode": "",
  "iccid": ""
}
```

## API Integration Points

### External API
```
POST https://api.esimaccess.com/api/v1/open/package/list
RT-AccessCode: YOUR_ACCESS_CODE
Content-Type: application/json

{
  "locationCode": "US",
  "type": "",
  "slug": "NA-3_1_7",
  "packageCode": "",
  "iccid": ""
}
```

## Service Methods

### getAllDataPackages()
Fetches all available packages (no filters)

```typescript
const packages = await this.inquiryService.getAllDataPackages();
```

### getDataPackagesByCountry(countryCode, params?)
Fetches packages for a specific country with optional filters

```typescript
const packages = await this.inquiryService.getDataPackagesByCountry('US', {
  type: 'data',
  slug: 'NA-3_1_7'
});
```

### getPackagesByFilters(params)
Searches packages with custom filters

```typescript
const packages = await this.inquiryService.getPackagesByFilters({
  locationCode: 'US',
  type: 'data',
  slug: 'NA-3_1_7',
  packageCode: 'PKG123',
  iccid: '8901234567890123456789'
});
```

## Files Updated

### Service Layer
- ✅ `src/inquiry/services/inquiry.packages.service.ts`
  - Changed from GET to POST
  - Updated endpoint to `/open/package/list`
  - Added request body parameter support
  - Added `getPackagesByFilters()` method

### Controller
- ✅ `src/inquiry/inquiry.controller.ts`
  - Changed from `@Get` to `@Post` decorators
  - Updated endpoints to POST
  - Added request body handling with `@Body()` decorator
  - Added new search endpoint

### Documentation
- ✅ `ESIM_API_SPEC.md` - Complete API specification with POST format
- ✅ `src/inquiry/INQUIRY_README.md` - Updated endpoint examples
- ✅ `INQUIRY_QUICKSTART.md` - Updated testing instructions
- ✅ `INQUIRY_INTEGRATION_SUMMARY.md` - Updated API details

## Example Usage

### cURL
```bash
# Get all packages
curl --location 'http://localhost:3000/inquiry/packages' \
  --header 'Content-Type: application/json' \
  --data '{}'

# Get US packages
curl --location 'http://localhost:3000/inquiry/packages/country/US' \
  --header 'Content-Type: application/json' \
  --data '{
    "locationCode": "US",
    "type": "",
    "slug": "",
    "packageCode": "",
    "iccid": ""
  }'

# Search with filters
curl --location 'http://localhost:3000/inquiry/packages/search' \
  --header 'Content-Type: application/json' \
  --data '{
    "locationCode": "US",
    "type": "data",
    "slug": "NA-3_1_7",
    "packageCode": "",
    "iccid": ""
  }'
```

### TypeScript/JavaScript (axios)
```typescript
// Get all packages
const response = await axios.post('http://localhost:3000/inquiry/packages', {});

// Get US packages
const response = await axios.post('http://localhost:3000/inquiry/packages/country/US', {
  locationCode: 'US',
  type: '',
  slug: '',
  packageCode: '',
  iccid: ''
});

// Search with filters
const response = await axios.post('http://localhost:3000/inquiry/packages/search', {
  locationCode: 'US',
  type: 'data',
  slug: 'NA-3_1_7',
  packageCode: '',
  iccid: ''
});
```

## Verification

✅ **Build Status:** Successful  
✅ **Linting Status:** No errors  
✅ **Type Safety:** Fully maintained  
✅ **Swagger Documentation:** Updated  

## Migration Notes

If you have existing code using the old GET endpoints:

### Before
```typescript
// Old GET endpoint
const packages = await fetch('http://localhost:3000/inquiry/packages?countryCode=US', {
  method: 'GET'
});
```

### After
```typescript
// New POST endpoint
const packages = await fetch('http://localhost:3000/inquiry/packages/country/US', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    locationCode: 'US',
    type: '',
    slug: '',
    packageCode: '',
    iccid: ''
  })
});
```

## Request Body Parameters

All parameters in the request body are **optional** and can be empty strings:

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| locationCode | string | Country/location filter | "US", "GB", "JP" |
| type | string | Package type filter | "data", "voice" |
| slug | string | Package slug identifier | "NA-3_1_7" |
| packageCode | string | Specific package code | "PKG123" |
| iccid | string | ICCID number filter | "8901234567890123456789" |

## Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": [
    {
      "id": "pkg_001",
      "name": "Package Name",
      "dataAmount": "1GB",
      "price": 4.99,
      "validity": "24 hours"
    }
  ],
  "message": "Packages retrieved successfully"
}
```

## Error Handling

Errors are returned with appropriate HTTP status codes:

| Status | Error | Example |
|--------|-------|---------|
| 200 | Success | Data returned |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing RT-AccessCode |
| 500 | Server Error | API unreachable |

## Testing the Endpoints

### Start the Application
```bash
yarn start:dev
```

### Test All Packages Endpoint
```bash
curl -X POST http://localhost:3000/inquiry/packages \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test Country Filter
```bash
curl -X POST http://localhost:3000/inquiry/packages/country/US \
  -H "Content-Type: application/json" \
  -d '{"locationCode":"US","type":"","slug":"","packageCode":"","iccid":""}'
```

### Test Search with Filters
```bash
curl -X POST http://localhost:3000/inquiry/packages/search \
  -H "Content-Type: application/json" \
  -d '{"locationCode":"US","type":"data","slug":"NA-3_1_7","packageCode":"","iccid":""}'
```

## Next Steps

1. ✅ Update your client code to use POST method
2. ✅ Update request format to JSON body
3. ✅ Update endpoints in your frontend/external services
4. ✅ Test all three endpoints
5. ✅ Verify responses match expected format

## Backward Compatibility

⚠️ **Breaking Change:** The old GET endpoints are no longer supported. All clients must be updated to use the new POST endpoints.

## Support

For questions or issues:
- See `ESIM_API_SPEC.md` for detailed API documentation
- See `src/inquiry/INQUIRY_README.md` for module documentation
- See `INQUIRY_QUICKSTART.md` for quick start guide

---

**Status:** ✅ All updates complete and tested  
**Last Updated:** 2024  
**Version:** 2.0
