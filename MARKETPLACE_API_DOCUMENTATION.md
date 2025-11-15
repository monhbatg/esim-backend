# Marketplace API Documentation

This document provides comprehensive API documentation for the Marketplace module endpoints. Use this guide to integrate the marketplace features into your Next.js frontend application.

## Base URL

All endpoints are prefixed with your API base URL:
```
http://localhost:3001  (development)
https://your-api-domain.com  (production)
```

## Table of Contents

1. [Regions API](#regions-api)
2. [Countries API](#countries-api)
3. [Categories API](#categories-api)
4. [Marketplace API](#marketplace-api)
5. [Error Handling](#error-handling)
6. [TypeScript Types](#typescript-types)
7. [Integration Examples](#integration-examples)

---

## Regions API

### List All Regions

**Endpoint:** `GET /regions`

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

**Endpoint:** `GET /regions/:id`

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

**Endpoint:** `POST /regions`

**Request Body:**
```json
{
  "name_en": "Asia",
  "name_mn": "Ази"
}
```

**Response:** `201 Created`

### Update Region

**Endpoint:** `PUT /regions/:id`

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

**Endpoint:** `DELETE /regions/:id`

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

**Endpoint:** `GET /countries`

**Query Parameters:**
- `region_id` (number, optional) - Filter countries by region ID

**Examples:**
- `GET /countries` - Get all countries
- `GET /countries?region_id=1` - Get countries in Asia (region_id=1)

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

**Endpoint:** `GET /countries/:id`

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

**Endpoint:** `POST /countries`

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

**Endpoint:** `PUT /countries/:id`

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

**Endpoint:** `DELETE /countries/:id`

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

**Endpoint:** `GET /categories`

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

**Endpoint:** `GET /categories/:id`

**Parameters:**
- `id` (number) - Category ID

**Response:** `200 OK`

### Create Category

**Endpoint:** `POST /categories`

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

**Endpoint:** `PUT /categories/:id`

**Request Body:** (all fields optional)
```json
{
  "name_en": "Top Destinations",
  "description_en": "Updated description"
}
```

**Response:** `200 OK`

### Delete Category

**Endpoint:** `DELETE /categories/:id`

**Response:** `200 OK`

```json
{
  "message": "Category deleted successfully"
}
```

---

## Marketplace API

### Get Marketplace Data

**Endpoint:** `GET /marketplace`

**Description:** This is the main endpoint for displaying the marketplace. It returns all categories with their assigned countries and region information.

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
        "region": {
          "name_en": "Asia",
          "name_mn": "Ази"
        }
      },
      {
        "name_en": "Japan",
        "name_mn": "Япон",
        "image": "/img/flags/jp.png",
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
        "region": {
          "name_en": "Asia",
          "name_mn": "Ази"
        }
      }
    ]
  }
]
```

**Use Case:** This endpoint is perfect for displaying the marketplace homepage where categories are shown with their countries.

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
  region: MarketplaceRegion;
}

export interface MarketplaceCategory {
  name_en: string;
  name_mn: string;
  description_en: string | null;
  description_mn: string | null;
  countries: MarketplaceCountry[];
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
- `GET /countries?region_id=1` to filter countries by region
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
| GET | `/regions` | List all regions |
| GET | `/regions/:id` | Get region by ID |
| POST | `/regions` | Create region |
| PUT | `/regions/:id` | Update region |
| DELETE | `/regions/:id` | Delete region |
| GET | `/countries` | List all countries (optional `?region_id=1`) |
| GET | `/countries/:id` | Get country by ID |
| POST | `/countries` | Create country |
| PUT | `/countries/:id` | Update country |
| DELETE | `/countries/:id` | Delete country |
| GET | `/categories` | List all categories |
| GET | `/categories/:id` | Get category by ID |
| POST | `/categories` | Create category |
| PUT | `/categories/:id` | Update category |
| DELETE | `/categories/:id` | Delete category |
| GET | `/marketplace` | Get marketplace data (categories with countries) |

---

## Notes

1. **All IDs are integers** (not UUIDs)
2. **Country codes** are 2-letter ISO codes (e.g., "TH", "CN", "US")
3. **Image paths** are relative URLs (e.g., "/img/flags/th.png")
4. **Timestamps** are in ISO 8601 format
5. **All text fields** support both English (`name_en`) and Mongolian (`name_mn`)
6. **The marketplace endpoint** is optimized for frontend display and includes all necessary nested data

For Swagger/OpenAPI interactive documentation, visit: `http://localhost:3001/docs` (when running in development mode)

