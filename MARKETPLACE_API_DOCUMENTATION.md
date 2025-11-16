# Marketplace API Documentation

This document provides comprehensive API documentation for the Marketplace module endpoints. Use this guide to integrate the marketplace features into your frontend application.

## Base URL

All endpoints are prefixed with `/api`:

- **Development:** `http://localhost:3001/api`
- **Production:** `https://your-api-domain.com/api`

**Important:** All endpoints require the `/api` prefix. For example:
- ✅ Correct: `GET /api/regions`
- ❌ Incorrect: `GET /regions` (will return 404)

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Regions API](#regions-api)
3. [Countries API](#countries-api)
4. [Categories API](#categories-api)
5. [Marketplace API](#marketplace-api)
6. [Marketplace Filtering Strategy](#marketplace-filtering-strategy)
7. [Error Handling](#error-handling)
8. [TypeScript Types](#typescript-types)
9. [Integration Examples](#integration-examples)

---

## Quick Reference

### Marketplace Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/marketplace` | GET | Get marketplace data with optional filters (`category_id`, `region_id`, `search`) |
| `/api/marketplace/countries` | GET | Get all countries for filter dropdowns |
| `/api/marketplace/categories` | GET | Get all categories for filter dropdowns |
| `/api/marketplace/packages` | GET | Get eSIM packages for a specific country code (requires `country_code` parameter) |

### Filter Parameters

The `/api/marketplace` endpoint supports three filter types that can be combined:

1. **`category_id`** (number) - Filter by category ID
2. **`region_id`** (number) - Filter by region ID  
3. **`search`** (string) - Search countries by name (English or Mongolian)

**Example:** `GET /api/marketplace?category_id=1&region_id=1&search=thailand`

---

## Regions API

### List All Regions

**Endpoint:** `GET /api/regions`

**Description:** Retrieve all regions ordered by English name.

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "name_en": "Asia",
    "name_mn": "Ази",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": 2,
    "name_en": "Europe",
    "name_mn": "Европ",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Region by ID

**Endpoint:** `GET /api/regions/:id`

**Parameters:**
- `id` (number) - Region ID

**Response:** `200 OK`

```json
{
  "id": 1,
  "name_en": "Asia",
  "name_mn": "Ази",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error:** `404 Not Found` - Region not found

### Create Region

**Endpoint:** `POST /api/regions`

**Request Body:**
```json
{
  "name_en": "Asia",
  "name_mn": "Ази"
}
```

**Response:** `201 Created`

### Update Region

**Endpoint:** `PUT /api/regions/:id`

**Parameters:**
- `id` (number) - Region ID

**Request Body:**
```json
{
  "name_en": "Asia Pacific",
  "name_mn": "Ази Номхон далай"
}
```

**Response:** `200 OK`

### Delete Region

**Endpoint:** `DELETE /api/regions/:id`

**Parameters:**
- `id` (number) - Region ID

**Response:** `200 OK`

```json
{
  "message": "Region deleted successfully"
}
```

---

## Countries API

### List All Countries

**Endpoint:** `GET /api/countries`

**Query Parameters:**
- `region_id` (number, optional) - Filter countries by region ID

**Examples:**
- `GET /api/countries` - Get all countries
- `GET /api/countries?region_id=1` - Get countries in Asia (region_id=1)

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "name_en": "China",
    "name_mn": "БНХАУ",
    "image": "/img/flags/cn.png",
    "region_id": 1,
    "country_code": "CN",
    "region": {
      "id": 1,
      "name_en": "Asia",
      "name_mn": "Ази",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Country by ID

**Endpoint:** `GET /api/countries/:id`

**Parameters:**
- `id` (number) - Country ID

**Response:** `200 OK`

```json
{
  "id": 5,
  "name_en": "Thailand",
  "name_mn": "Тайланд",
  "image": "/img/flags/th.png",
  "region_id": 1,
  "country_code": "TH",
  "region": {
    "id": 1,
    "name_en": "Asia",
    "name_mn": "Ази",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error:** `404 Not Found` - Country not found

### Create Country

**Endpoint:** `POST /api/countries`

**Request Body:**
```json
{
  "name_en": "Thailand",
  "name_mn": "Тайланд",
  "region_id": 1,
  "country_code": "TH",
  "image": "/img/flags/th.png"
}
```

**Response:** `201 Created`

**Error:** `400 Bad Request` - Invalid input or region not found

### Update Country

**Endpoint:** `PUT /api/countries/:id`

**Parameters:**
- `id` (number) - Country ID

**Request Body:** (all fields optional)
```json
{
  "name_en": "Thailand",
  "name_mn": "Тайланд",
  "region_id": 1,
  "country_code": "TH",
  "image": "/img/flags/th.png"
}
```

**Response:** `200 OK`

### Delete Country

**Endpoint:** `DELETE /api/countries/:id`

**Parameters:**
- `id` (number) - Country ID

**Response:** `200 OK`

```json
{
  "message": "Country deleted successfully"
}
```

---

## Categories API

### List All Categories

**Endpoint:** `GET /api/categories`

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "name_en": "Top Destinations",
    "name_mn": "Шилдэг чиглэлүүд",
    "description_en": "Most popular travel destinations for Mongolians based on bookings and trends.",
    "description_mn": "Монголчуудын хамгийн их аялдаг, эрэлттэй чиглэлүүд.",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Category by ID

**Endpoint:** `GET /api/categories/:id`

**Parameters:**
- `id` (number) - Category ID

**Response:** `200 OK`

### Create Category

**Endpoint:** `POST /api/categories`

**Request Body:**
```json
{
  "name_en": "Top Destinations",
  "name_mn": "Шилдэг чиглэлүүд",
  "description_en": "Most popular travel destinations",
  "description_mn": "Алдартай аялалын чиглэлүүд"
}
```

**Response:** `201 Created`

### Update Category

**Endpoint:** `PUT /api/categories/:id`

**Request Body:** (all fields optional)
```json
{
  "name_en": "Top Destinations",
  "description_en": "Updated description"
}
```

**Response:** `200 OK`

### Delete Category

**Endpoint:** `DELETE /api/categories/:id`

**Response:** `200 OK`

```json
{
  "message": "Category deleted successfully"
}
```

---

## Marketplace API

### Get Marketplace Data

**Endpoint:** `GET /api/marketplace`

**Description:** This is the main endpoint for displaying the marketplace. By default, it returns all categories with all their assigned countries and region information. Use query parameters to filter results for better performance.

**Query Parameters:**
- `category_id` (number, optional) - Filter by category ID (returns only countries in this category)
- `region_id` (number, optional) - Filter by region ID (returns only countries in this region)
- `search` (string, optional) - Search countries by name (searches both English and Mongolian names)

**Filters can be combined** for precise results. For example: `?category_id=1&region_id=1&search=thailand`

**Examples:**

1. **Get all marketplace data (no filters):**
   ```
   GET /api/marketplace
   ```

2. **Filter by category only:**
   ```
   GET /api/marketplace?category_id=1
   ```
   Returns: Only category ID 1 with its countries

3. **Filter by region only:**
   ```
   GET /api/marketplace?region_id=1
   ```
   Returns: All categories, but only countries in region ID 1

4. **Search countries by name:**
   ```
   GET /api/marketplace?search=thailand
   ```
   Returns: All categories, but only countries matching "thailand" in name

5. **Filter by category AND region:**
   ```
   GET /api/marketplace?category_id=1&region_id=1
   ```
   Returns: Category ID 1, but only countries that are in region ID 1

6. **Filter by category AND search:**
   ```
   GET /api/marketplace?category_id=1&search=thailand
   ```
   Returns: Category ID 1, but only countries matching "thailand"

7. **All filters combined:**
   ```
   GET /api/marketplace?category_id=1&region_id=1&search=thailand
   ```
   Returns: Category ID 1, region ID 1, countries matching "thailand"

**Response:** `200 OK`

```json
[
  {
    "name_en": "Top Destinations",
    "name_mn": "Шилдэг чиглэлүүд",
    "description_en": "Most popular travel destinations for Mongolians based on bookings and trends.",
    "description_mn": "Монголчуудын хамгийн их аялдаг, эрэлттэй чиглэлүүд.",
    "countries": [
      {
        "name_en": "Thailand",
        "name_mn": "Тайланд",
        "image": "/img/flags/th.png",
        "country_code": "TH",
        "region": {
          "name_en": "Asia",
          "name_mn": "Ази"
        }
      },
      {
        "name_en": "Japan",
        "name_mn": "Япон",
        "image": "/img/flags/jp.png",
        "country_code": "JP",
        "region": {
          "name_en": "Asia",
          "name_mn": "Ази"
        }
      }
    ]
  },
  {
    "name_en": "Visa-Free",
    "name_mn": "Визгүй орнууд",
    "description_en": "Countries Mongolians can visit without a visa or with visa-on-arrival.",
    "description_mn": "Монголчууд визгүй эсвэл очоод виз авах боломжтой орнууд.",
    "countries": [
      {
        "name_en": "Thailand",
        "name_mn": "Тайланд",
        "image": "/img/flags/th.png",
        "country_code": "TH",
        "region": {
          "name_en": "Asia",
          "name_mn": "Ази"
        }
      }
    ]
  }
]
```

**Error:** `404 Not Found` - Category not found (when filtering by category_id)

**Use Case:** 
- **No filters**: Perfect for displaying the marketplace homepage with all categories and countries
- **With filters**: Use when you need specific data (e.g., show only countries in "Top Destinations" category, or search for a specific country)

### Get All Countries for Filtering

**Endpoint:** `GET /api/marketplace/countries`

**Description:** Get a lightweight list of all countries (id, name, country_code, image) for building filter dropdowns. This is optimized for filter UI components.

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "name_en": "Thailand",
    "name_mn": "Тайланд",
    "country_code": "TH",
    "image": "/img/flags/th.png"
  },
  {
    "id": 2,
    "name_en": "Japan",
    "name_mn": "Япон",
    "country_code": "JP",
    "image": "/img/flags/jp.png"
  }
]
```

**Use Case:** Use this endpoint to populate country filter dropdowns or search autocomplete lists.

### Get All Categories for Filtering

**Endpoint:** `GET /api/marketplace/categories`

**Description:** Get a lightweight list of all categories (id, name, description) for building filter dropdowns. This is optimized for filter UI components.

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "name_en": "Top Destinations",
    "name_mn": "Шилдэг чиглэлүүд",
    "description_en": "Most popular travel destinations for Mongolians based on bookings and trends.",
    "description_mn": "Монголчуудын хамгийн их аялдаг, эрэлттэй чиглэлүүд."
  },
  {
    "id": 2,
    "name_en": "Visa-Free",
    "name_mn": "Визгүй орнууд",
    "description_en": "Countries Mongolians can visit without a visa or with visa-on-arrival.",
    "description_mn": "Монголчууд визгүй эсвэл очоод виз авах боломжтой орнууд."
  }
]
```

**Use Case:** Use this endpoint to populate category filter dropdowns.

### Get eSIM Packages by Country Code

**Endpoint:** `GET /api/marketplace/packages`

**Description:** Fetch eSIM data packages from the esimaccess API for a specific country. The `country_code` must match a country code that exists in the marketplace database. This endpoint uses the `locationCode` filter internally to query the esimaccess API.

**Query Parameters:**
- `country_code` (string, **required**) - ISO 2-letter country code (e.g., `TH`, `US`, `GB`, `JP`). Must exist in marketplace.

**Examples:**

1. **Get packages for Thailand:**
   ```
   GET /api/marketplace/packages?country_code=TH
   ```

2. **Get packages for United States:**
   ```
   GET /api/marketplace/packages?country_code=US
   ```

3. **Get packages for Japan:**
   ```
   GET /api/marketplace/packages?country_code=JP
   ```

**Response:** `200 OK`

```json
[
  {
    "packageCode": "PKG001",
    "slug": "TH-1GB-7D",
    "name": "Thailand 1GB 7 Days",
    "price": 4.99,
    "currencyCode": "USD",
    "volume": 1024,
    "smsStatus": 0,
    "dataType": 1,
    "unusedValidTime": 7,
    "duration": 7,
    "durationUnit": "days",
    "location": "Thailand",
    "description": "1GB data valid for 7 days in Thailand",
    "activeType": 1,
    "favorite": false,
    "retailPrice": 5.99,
    "speed": "4G",
    "locationNetworkList": [
      {
        "locationName": "Thailand",
        "locationLogo": "https://example.com/flags/th.png",
        "operatorList": [
          {
            "operatorName": "AIS",
            "networkType": "4G"
          },
          {
            "operatorName": "True",
            "networkType": "4G"
          }
        ]
      }
    ]
  },
  {
    "packageCode": "PKG002",
    "slug": "TH-3GB-15D",
    "name": "Thailand 3GB 15 Days",
    "price": 9.99,
    "currencyCode": "USD",
    "volume": 3072,
    "duration": 15,
    "durationUnit": "days",
    "location": "Thailand",
    "description": "3GB data valid for 15 days in Thailand",
    "locationNetworkList": []
  }
]
```

**Error Responses:**

1. **400 Bad Request** - Missing or invalid `country_code` parameter:
   ```json
   {
     "statusCode": 400,
     "message": [
       "country_code should not be empty",
       "country_code must be a string"
     ],
     "error": "Bad Request"
   }
   ```

2. **404 Not Found** - Country code doesn't exist in marketplace:
   ```json
   {
     "statusCode": 404,
     "message": "Country with code 'XX' not found in marketplace",
     "error": "Not Found"
   }
   ```

3. **500 Internal Server Error** - esimaccess API error:
   ```json
   {
     "statusCode": 500,
     "message": "Failed to fetch data packages for TH",
     "error": "Internal Server Error"
   }
   ```

**Use Cases:**

1. **Display packages for a selected country:**
   - User selects a country from marketplace (e.g., Thailand with `country_code: "TH"`)
   - Frontend calls `GET /api/marketplace/packages?country_code=TH`
   - Display the returned packages in a list or grid

2. **Filter packages by country:**
   - User filters marketplace by country
   - Use the `country_code` from the filtered country
   - Fetch packages for that country code

3. **Package comparison:**
   - Fetch packages for multiple countries
   - Compare prices, data amounts, and validity periods

**Integration Flow:**

```
1. User browses marketplace → GET /api/marketplace
2. User selects a country → Extract country_code (e.g., "TH")
3. Fetch packages for country → GET /api/marketplace/packages?country_code=TH
4. Display packages to user
```

**Important Notes:**

- The `country_code` must be a valid ISO 2-letter code that exists in your marketplace database
- Country codes are case-insensitive (both `TH` and `th` work)
- The endpoint validates the country exists before calling the esimaccess API
- If no packages are available for a country, an empty array `[]` is returned
- Package data comes directly from the esimaccess API and may vary by country

---

## Error Handling

All endpoints follow standard HTTP status codes:

- `200 OK` - Successful GET, PUT, DELETE requests
- `201 Created` - Successful POST requests
- `400 Bad Request` - Invalid input data or validation errors
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server errors

### Error Response Format

```json
{
  "statusCode": 404,
  "message": "Country with ID 999 not found",
  "error": "Not Found"
}
```

### Validation Errors

When validation fails (400 Bad Request), you'll receive detailed error messages:

```json
{
  "statusCode": 400,
  "message": [
    "name_en must be longer than or equal to 2 characters",
    "region_id must be a number"
  ],
  "error": "Bad Request"
}
```

---

## Marketplace Filtering Strategy

### Recommended Frontend Implementation

1. **Initial Load:**
   - Call `GET /api/marketplace/countries` to populate country filter dropdown
   - Call `GET /api/marketplace/categories` to populate category filter dropdown
   - Call `GET /api/regions` to populate region filter dropdown
   - Call `GET /api/marketplace` to load initial marketplace data

2. **When User Filters:**
   - **Search by country name**: Add `?search=thailand` parameter
   - **Filter by category**: Add `?category_id=1` parameter
   - **Filter by region**: Add `?region_id=1` parameter
   - **Combine filters**: Add multiple parameters `?category_id=1&region_id=1&search=thailand`

3. **Fetching Packages:**
   - After user selects a country, extract the `country_code` from the country object
   - Call `GET /api/marketplace/packages?country_code=TH` to fetch eSIM packages
   - Display packages in a list or grid view

4. **Performance Benefits:**
   - Filtering reduces data transfer significantly
   - Only returns categories that have matching countries after filtering
   - Efficient database queries using TypeORM QueryBuilder
   - Packages are fetched on-demand only when needed

---

## TypeScript Types

Here are the TypeScript interfaces for the API responses and requests:

```typescript
// Region Types
export interface Region {
  id: number;
  name_en: string;
  name_mn: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRegionDto {
  name_en: string;
  name_mn: string;
}

export interface UpdateRegionDto {
  name_en?: string;
  name_mn?: string;
}

// Country Types
export interface Country {
  id: number;
  name_en: string;
  name_mn: string;
  image: string | null;
  region_id: number;
  country_code: string | null;
  region?: Region;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCountryDto {
  name_en: string;
  name_mn: string;
  region_id: number;
  country_code: string;
  image?: string | null;
}

export interface UpdateCountryDto {
  name_en?: string;
  name_mn?: string;
  region_id?: number;
  country_code?: string;
  image?: string | null;
}

export interface QueryCountriesDto {
  region_id?: number;
}

// Category Types
export interface Category {
  id: number;
  name_en: string;
  name_mn: string;
  description_en: string | null;
  description_mn: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryDto {
  name_en: string;
  name_mn: string;
  description_en?: string | null;
  description_mn?: string | null;
}

export interface UpdateCategoryDto {
  name_en?: string;
  name_mn?: string;
  description_en?: string | null;
  description_mn?: string | null;
}

// Marketplace Types
export interface MarketplaceRegion {
  name_en: string;
  name_mn: string;
}

export interface MarketplaceCountry {
  name_en: string;
  name_mn: string;
  image: string | null;
  country_code: string | null;
  region: MarketplaceRegion;
}

export interface CountryFilter {
  id: number;
  name_en: string;
  name_mn: string;
  country_code: string | null;
  image: string | null;
}

export interface CategoryFilter {
  id: number;
  name_en: string;
  name_mn: string;
  description_en: string | null;
  description_mn: string | null;
}

export interface QueryMarketplace {
  category_id?: number;
  region_id?: number;
  search?: string;
}

export interface MarketplaceCategory {
  name_en: string;
  name_mn: string;
  description_en: string | null;
  description_mn: string | null;
  countries: MarketplaceCountry[];
}

// Package Types
export interface Operator {
  operatorName: string;
  networkType: string;
}

export interface LocationNetwork {
  locationName: string;
  locationLogo: string;
  operatorList: Operator[];
}

export interface DataPackage {
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

export interface QueryPackages {
  country_code: string;
}
```

---

## Best Practices

### 1. Error Handling

Always handle HTTP errors appropriately:
- Check response status codes (200, 201, 400, 404, 500)
- Parse error messages from the response body
- Display user-friendly error messages

### 2. Request Headers

Include proper headers for API requests:
- `Content-Type: application/json` for POST/PUT requests
- `Authorization: Bearer <token>` if authentication is required

### 3. Query Parameters

Use query parameters for filtering:
- `GET /api/countries?region_id=1` to filter countries by region
- Always validate query parameters on the frontend before sending

### 4. Caching

Consider implementing caching strategies:
- Marketplace data doesn't change frequently, cache for 5-10 minutes
- Use appropriate cache headers or client-side caching libraries

### 5. Image Handling

- Image paths are relative URLs (e.g., `/img/flags/th.png`)
- Always check for null/undefined images before displaying
- Provide fallback images or placeholders when images are missing

### 6. Language Support

- All endpoints return both English (`name_en`, `description_en`) and Mongolian (`name_mn`, `description_mn`) fields
- Use the appropriate field based on user's language preference
- Default to English if language preference is not set

### 7. Type Safety

- Use the provided TypeScript interfaces for type safety
- Validate API responses match expected types
- Handle nullable fields appropriately (`image`, `description_en`, etc.)

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/regions` | List all regions |
| GET | `/api/regions/:id` | Get region by ID |
| POST | `/api/regions` | Create region |
| PUT | `/api/regions/:id` | Update region |
| DELETE | `/api/regions/:id` | Delete region |
| GET | `/api/countries` | List all countries (optional `?region_id=1`) |
| GET | `/api/countries/:id` | Get country by ID |
| POST | `/api/countries` | Create country |
| PUT | `/api/countries/:id` | Update country |
| DELETE | `/api/countries/:id` | Delete country |
| GET | `/api/categories` | List all categories |
| GET | `/api/categories/:id` | Get category by ID |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |
| GET | `/api/marketplace` | Get marketplace data (categories with countries). Supports filtering with `?category_id=1&region_id=1&search=name` |
| GET | `/api/marketplace/countries` | Get all countries for filter dropdowns |
| GET | `/api/marketplace/categories` | Get all categories for filter dropdowns |
| GET | `/api/marketplace/packages` | Get eSIM packages for a country (requires `?country_code=TH` parameter) |

---

## Notes

1. **All IDs are integers** (not UUIDs)
2. **Country codes** are 2-letter ISO codes (e.g., "TH", "CN", "US")
3. **Image paths** are relative URLs (e.g., "/img/flags/th.png")
4. **Timestamps** are in ISO 8601 format
5. **All text fields** support both English (`name_en`) and Mongolian (`name_mn`)
6. **The marketplace endpoint** is optimized for frontend display and includes all necessary nested data
7. **The packages endpoint** requires a valid `country_code` that exists in the marketplace database. It fetches data from the esimaccess API using the `locationCode` filter.

For Swagger/OpenAPI interactive documentation, visit: `http://localhost:3001/docs` (when running in development mode)

---

## Integration Examples

### Example 1: Fetch Packages for a Selected Country

This example shows how to fetch eSIM packages when a user selects a country from the marketplace.

```typescript
// 1. User selects Thailand from marketplace
const selectedCountry = {
  name_en: "Thailand",
  name_mn: "Тайланд",
  country_code: "TH",
  // ... other fields
};

// 2. Fetch packages for Thailand
const fetchPackages = async (countryCode: string) => {
  try {
    const response = await fetch(
      `/api/marketplace/packages?country_code=${countryCode}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch packages: ${response.statusText}`);
    }
    
    const packages: DataPackage[] = await response.json();
    return packages;
  } catch (error) {
    console.error('Error fetching packages:', error);
    return [];
  }
};

// 3. Use the function
const packages = await fetchPackages(selectedCountry.country_code);
console.log(`Found ${packages.length} packages for ${selectedCountry.name_en}`);
```

### Example 2: Complete Marketplace Flow with Packages

This example shows a complete flow from browsing marketplace to displaying packages.

```typescript
// Step 1: Load marketplace data
const loadMarketplace = async () => {
  const response = await fetch('/api/marketplace');
  const categories: MarketplaceCategory[] = await response.json();
  return categories;
};

// Step 2: User filters by category
const filterByCategory = async (categoryId: number) => {
  const response = await fetch(`/api/marketplace?category_id=${categoryId}`);
  const categories: MarketplaceCategory[] = await response.json();
  return categories;
};

// Step 3: User selects a country and views packages
const viewCountryPackages = async (countryCode: string) => {
  // Fetch packages
  const response = await fetch(
    `/api/marketplace/packages?country_code=${countryCode}`
  );
  
  if (response.status === 404) {
    throw new Error('Country not found in marketplace');
  }
  
  const packages: DataPackage[] = await response.json();
  
  // Display packages
  packages.forEach(pkg => {
    console.log(`${pkg.name}: ${pkg.price} ${pkg.currencyCode}`);
    console.log(`  Data: ${pkg.volume}MB`);
    console.log(`  Validity: ${pkg.duration} ${pkg.durationUnit}`);
  });
  
  return packages;
};

// Complete flow
const categories = await loadMarketplace();
const filteredCategories = await filterByCategory(1);
const selectedCountry = filteredCategories[0].countries[0];
const packages = await viewCountryPackages(selectedCountry.country_code);
```

### Example 3: React Component Example

```typescript
import React, { useState, useEffect } from 'react';
import { DataPackage, MarketplaceCountry } from './types';

interface CountryPackagesProps {
  country: MarketplaceCountry;
}

const CountryPackages: React.FC<CountryPackagesProps> = ({ country }) => {
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPackages = async () => {
      if (!country.country_code) {
        setError('Country code is missing');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/marketplace/packages?country_code=${country.country_code}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('Country not found in marketplace');
          } else {
            setError('Failed to fetch packages');
          }
          return;
        }

        const data: DataPackage[] = await response.json();
        setPackages(data);
      } catch (err) {
        setError('Network error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [country.country_code]);

  if (loading) return <div>Loading packages...</div>;
  if (error) return <div>Error: {error}</div>;
  if (packages.length === 0) return <div>No packages available</div>;

  return (
    <div>
      <h2>Packages for {country.name_en}</h2>
      <div className="packages-grid">
        {packages.map((pkg) => (
          <div key={pkg.packageCode} className="package-card">
            <h3>{pkg.name}</h3>
            <p>{pkg.description}</p>
            <div className="package-details">
              <span>Price: {pkg.price} {pkg.currencyCode}</span>
              <span>Data: {pkg.volume}MB</span>
              <span>Valid: {pkg.duration} {pkg.durationUnit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CountryPackages;
```

### Example 4: Error Handling Best Practices

```typescript
const fetchPackagesWithErrorHandling = async (
  countryCode: string
): Promise<DataPackage[] | null> => {
  try {
    const response = await fetch(
      `/api/marketplace/packages?country_code=${countryCode}`
    );

    // Handle different error status codes
    if (response.status === 400) {
      const error = await response.json();
      console.error('Validation error:', error.message);
      throw new Error('Invalid country code format');
    }

    if (response.status === 404) {
      const error = await response.json();
      console.error('Not found:', error.message);
      throw new Error('Country not found in marketplace');
    }

    if (response.status === 500) {
      const error = await response.json();
      console.error('Server error:', error.message);
      throw new Error('Failed to fetch packages from provider');
    }

    if (!response.ok) {
      throw new Error(`Unexpected error: ${response.statusText}`);
    }

    const packages: DataPackage[] = await response.json();
    return packages;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError) {
      console.error('Network error:', error.message);
      throw new Error('Unable to connect to server');
    }
    
    throw error;
  }
};
```

### Example 5: Using Axios

```typescript
import axios from 'axios';

const API_BASE_URL = '/api';

// Fetch packages with Axios
const getPackagesByCountry = async (
  countryCode: string
): Promise<DataPackage[]> => {
  try {
    const response = await axios.get<DataPackage[]>(
      `${API_BASE_URL}/marketplace/packages`,
      {
        params: {
          country_code: countryCode,
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error('Country not found in marketplace');
      }
      if (error.response?.status === 400) {
        throw new Error('Invalid country code');
      }
    }
    throw error;
  }
};
```

