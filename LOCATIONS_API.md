# Locations/Countries API

## Overview

The Locations API provides access to the complete list of supported countries and multi-country bundles, including detailed information about sub-locations and their types.

---

## External API Endpoint

```
POST https://api.esimaccess.com/api/v1/open/location/list
```

**Headers:**
```
RT-AccessCode: YOUR_ACCESS_CODE
Content-Type: application/json
```

**Request Body:**
```json
{}
```

---

## Backend Endpoints

### 1. Get All Locations/Countries

**Endpoint:**
```
GET /inquiry/locations
```

**Description:** Fetches all supported locations and country bundles

**Response:**
```json
{
  "success": true,
  "errorCode": "0",
  "errorMsg": null,
  "obj": {
    "locationList": [
      {
        "code": "ES",
        "name": "Spain",
        "type": 1,
        "subLocationList": null
      },
      {
        "code": "EU-42",
        "name": "Europe (40+ areas)",
        "type": 2,
        "subLocationList": [
          {
            "code": "IS",
            "name": "Iceland"
          },
          {
            "code": "IE",
            "name": "Ireland"
          }
          // ... more countries
        ]
      }
    ]
  }
}
```

**Status Codes:**
- `200 OK` - Successfully retrieved locations
- `500 Internal Server Error` - Failed to fetch from API

---

### 2. Get Location Details by Code

**Endpoint:**
```
GET /inquiry/locations/:code
```

**Parameters:**
- `code` (string, required): Location code (e.g., "ES", "EU-42", "CNJPKR-3")

**Example:**
```
GET /inquiry/locations/EU-42
```

**Response:**
```json
{
  "code": "EU-42",
  "name": "Europe (40+ areas)",
  "type": 2,
  "subLocationList": [
    {
      "code": "IS",
      "name": "Iceland"
    },
    {
      "code": "IE",
      "name": "Ireland"
    },
    // ... more locations
  ]
}
```

**Status Codes:**
- `200 OK` - Location found
- `400 Bad Request` - Invalid or missing location code
- `404 Not Found` - Location code not found
- `500 Internal Server Error` - Failed to fetch from API

---

## Location Types

### Type 1: Single Country
```json
{
  "code": "ES",
  "name": "Spain",
  "type": 1,
  "subLocationList": null
}
```

### Type 2: Multi-Country Bundle
```json
{
  "code": "EU-42",
  "name": "Europe (40+ areas)",
  "type": 2,
  "subLocationList": [
    { "code": "IS", "name": "Iceland" },
    { "code": "IE", "name": "Ireland" },
    // ... more countries
  ]
}
```

---

## Example Usage

### Get All Locations
```bash
curl -X GET http://localhost:3000/inquiry/locations
```

### Get Specific Location
```bash
# Get Europe bundle details
curl -X GET http://localhost:3000/inquiry/locations/EU-42

# Get Spain details
curl -X GET http://localhost:3000/inquiry/locations/ES

# Get China, Japan, Korea bundle
curl -X GET http://localhost:3000/inquiry/locations/CNJPKR-3
```

### TypeScript/JavaScript (axios)
```typescript
import axios from 'axios';

// Get all locations
const response = await axios.get('http://localhost:3000/inquiry/locations');
const locations = response.data.obj.locationList;

// Display locations
locations.forEach(location => {
  console.log(`${location.name} (${location.code})`);
  
  if (location.type === 2 && location.subLocationList) {
    location.subLocationList.forEach(sub => {
      console.log(`  - ${sub.name} (${sub.code})`);
    });
  }
});

// Get specific location
const euResponse = await axios.get('http://localhost:3000/inquiry/locations/EU-42');
const euBundle = euResponse.data;
console.log(`${euBundle.name} covers ${euBundle.subLocationList.length} countries`);
```

---

## Service Methods

### getAllLocations()
Returns the complete location list response from the API

```typescript
const response = await inquiryService.getAllLocations();
// Returns: LocationListResponseDto with all locations
```

### getLocationDetails(code: string)
Returns details for a specific location/bundle

```typescript
const location = await inquiryService.getLocationDetails('EU-42');
// Returns: LocationDto or null
```

---

## Data Structure

### LocationDto
```typescript
{
  code: string;                    // Location code
  name: string;                    // Location name
  type: number;                    // 1 = single, 2 = bundle
  subLocationList?: SubLocationDto[] | null;  // Sub-locations (for type 2)
}
```

### SubLocationDto
```typescript
{
  code: string;                    // Country code
  name: string;                    // Country name
}
```

### LocationListResponseDto
```typescript
{
  success: boolean;                // Request success
  errorCode: string;               // Error code
  errorMsg?: string | null;        // Error message
  obj: {
    locationList: LocationDto[];   // List of all locations
  }
}
```

---

## Common Location Codes

### Single Countries
- `ES` - Spain
- `DE` - Germany
- `FR` - France
- `GB` - United Kingdom
- `IT` - Italy
- `JP` - Japan
- `CN` - China mainland
- `KR` - South Korea
- `US` - United States
- `CA` - Canada
- `AU` - Australia

### Multi-Country Bundles
- `EU-42` - Europe (40+ areas)
- `CNJPKR-3` - China mainland, Japan, South Korea
- `NA-3` - North America
- `ASIA-10` - Asia (10+ areas)

---

## Use Cases

### 1. Display Location Selection
```typescript
const locations = await inquiryService.getAllLocations();

// Filter only single countries
const singleCountries = locations.obj.locationList.filter(l => l.type === 1);

// Filter only bundles
const bundles = locations.obj.locationList.filter(l => l.type === 2);
```

### 2. Get Bundle Details
```typescript
const euBundle = await inquiryService.getLocationDetails('EU-42');

console.log(`${euBundle.name} includes:`);
euBundle.subLocationList.forEach(country => {
  console.log(`  - ${country.name}`);
});
```

### 3. Validate Location Code
```typescript
const location = await inquiryService.getLocationDetails(userInput);

if (!location) {
  console.log('Invalid location code');
} else {
  console.log(`Valid location: ${location.name}`);
}
```

---

## Caching Recommendation

Since the locations list changes infrequently, consider caching:

```typescript
@Cacheable('locations')
async getAllLocations(): Promise<LocationListResponseDto> {
  return await this.inquiryService.getAllLocations();
}
```

---

## Error Handling

| Error | Status | Solution |
|-------|--------|----------|
| Invalid location code | 400 | Provide valid location code |
| Location not found | 404 | Check available locations first |
| API unreachable | 500 | Verify network and API key |

---

## Integration

The locations endpoint integrates with the packages API to filter packages by location:

```typescript
// Get all packages for a specific location
const location = await getLocationDetails('EU-42');
const packages = await getPackagesByCountry('EU-42');
```

---

**Last Updated:** 2024  
**API Version:** v1
