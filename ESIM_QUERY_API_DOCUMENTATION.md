# eSIM Query API Documentation

## Overview

The eSIM Query API allows you to search and retrieve eSIM purchase records from the database. This endpoint matches the eSIM Access API format and provides a public interface for querying eSIM purchases by various criteria.

## Endpoint

**URL:** `/api/v1/open/esim/query`  
**Method:** `POST`  
**Authentication:** None (Public endpoint)

## Base URL

- **Development:** `http://localhost:3001/api/v1/open/esim/query`
- **Production:** `https://your-api-domain.com/api/v1/open/esim/query`

## Request Format

### Request Body

The request body is a JSON object with the following optional parameters:

#### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `orderNo` | string | No | Filter by eSIM provider order number | `"B23120118131854"` |
| `esimTranNo` | string | No | Filter by eSIM transaction number | `"23120118156818"` |
| `iccid` | string | No | Filter by eSIM ICCID | `"8943108170000775671"` |
| `startTime` | string | No | Filter by start date (ISO UTC format) | `"2023-12-01T00:00:00+00:00"` |
| `endTime` | string | No | Filter by end date (ISO UTC format) | `"2023-12-31T23:59:59+00:00"` |
| `pager` | object | No | Pagination parameters (defaults applied if omitted) | See below |

#### Pagination Object (`pager`)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `pageNum` | number | No | `1` | Page number (starts from 1) |
| `pageSize` | number | No | `20` | Number of items per page (max 100) |

### Request Examples

**Query by Order Number:**
- Include `orderNo` with the specific order number
- Leave other filter fields empty or omit them
- Include `pager` object for pagination

**Query by ICCID:**
- Include `iccid` with the specific ICCID
- Leave other filter fields empty or omit them
- Include `pager` object for pagination

**Query by Date Range:**
- Include `startTime` and/or `endTime` in ISO UTC format
- Leave other filter fields empty or omit them
- Include `pager` object for pagination

**Query All (with pagination):**
- Omit all filter fields or leave them empty
- Include `pager` object to control pagination

**Note:** Empty strings (`""`) in filter fields are treated as "no filter" and will be ignored.

## Response Format

### Success Response

**Status Code:** `200 OK`

The response follows this structure:

```json
{
  "success": true,
  "errorCode": "0",
  "errorMsg": null,
  "obj": {
    "esimList": [...],
    "pager": {...}
  }
}
```

### Response Fields

#### Top Level

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful requests |
| `errorCode` | string | Error code (always `"0"` for success) |
| `errorMsg` | string \| null | Error message (always `null` for success) |
| `obj` | object | Response data object |

#### Response Object (`obj`)

| Field | Type | Description |
|-------|------|-------------|
| `esimList` | array | Array of eSIM purchase records |
| `pager` | object | Pagination information |

#### eSIM Item (`esimList[]`)

Each item in the `esimList` array contains the following fields:

| Field | Type | Description | Notes |
|-------|------|-------------|-------|
| `esimTranNo` | string | eSIM transaction number | May be empty string |
| `orderNo` | string | Order number from eSIM provider | May be empty string |
| `transactionId` | string | Internal transaction ID | Always present |
| `imsi` | string \| null | International Mobile Subscriber Identity | From metadata |
| `iccid` | string \| null | Integrated Circuit Card Identifier | May be null if not activated |
| `smsStatus` | number \| null | SMS status code | From metadata |
| `msisdn` | string \| null | Mobile Station International Subscriber Directory Number | From metadata |
| `ac` | string \| null | Activation code | May be null |
| `qrCodeUrl` | string \| null | QR code image URL | May be null |
| `shortUrl` | string \| null | Short URL for QR code | May be null |
| `smdpStatus` | string \| null | SM-DP+ server status | From metadata (e.g., "RELEASED", "ENABLED", "DISABLED", "DELETED") |
| `eid` | string | eSIM Identifier | May be empty string |
| `activeType` | number \| null | Active type indicator | Default: 1 |
| `dataType` | number \| null | Data type indicator | Default: 1 |
| `activateTime` | string \| null | Activation timestamp | ISO format with +0000 timezone, null if not activated |
| `expiredTime` | string \| null | Expiration timestamp | ISO format with +0000 timezone, null if not set |
| `totalVolume` | number | Total data volume in bytes | Always present |
| `totalDuration` | number | Duration value | Always present |
| `durationUnit` | string | Duration unit | e.g., "DAY", "MONTH" |
| `orderUsage` | number \| null | Usage indicator | Default: 0 |
| `esimStatus` | string | eSIM status | See status values below |
| `pin` | string | PIN code | May be empty string |
| `puk` | string | PUK code | May be empty string |
| `apn` | string \| null | Access Point Name | From metadata |
| `packageList` | array | Package information array | See below |

#### eSIM Status Values

The `esimStatus` field can have the following values:

- `"GOT_RESOURCE"` - New eSIM, resource obtained but not activated
- `"IN_USE"` - eSIM is currently in use
- `"USED_UP"` - eSIM data has been depleted
- `"CANCEL"` - eSIM has been cancelled or is inactive

**Status Determination Logic:**
- If `isActive` is `false`: Status is `"CANCEL"`
- If `isActivated` is `true`: Status comes from metadata or defaults to `"IN_USE"`
- Otherwise: Status is `"GOT_RESOURCE"`

#### Package Information (`packageList[]`)

Each package in the `packageList` array contains:

| Field | Type | Description |
|-------|------|-------------|
| `packageName` | string | Full package name |
| `packageCode` | string | Package code identifier |
| `slug` | string | Package slug |
| `duration` | number | Duration value |
| `volume` | number | Data volume in bytes |
| `locationCode` | string | Location/country code (first country if multiple) |
| `createTime` | string | Creation timestamp (ISO format with +0000) |

#### Pagination Object (`pager`)

| Field | Type | Description |
|-------|------|-------------|
| `pageSize` | number | Number of items per page |
| `pageNum` | number | Current page number |
| `total` | number | Total number of records matching the query |

### Error Response

**Status Code:** `400 Bad Request`

Occurs when:
- Invalid date format in `startTime` or `endTime`
- Invalid pagination parameters (negative numbers, etc.)
- Invalid request body structure

## Usage Guidelines

### Filtering

1. **Single Filter:** Use one filter parameter at a time for best results
2. **Multiple Filters:** You can combine filters (AND logic)
3. **Empty Strings:** Empty strings in filter fields are ignored
4. **Date Range:** Use ISO UTC format for date filters

### Pagination

1. **Default Values:** If `pager` is omitted, defaults to page 1 with 20 items
2. **Page Numbers:** Start from 1 (not 0)
3. **Page Size:** Maximum recommended is 100 items per page
4. **Total Count:** Use `pager.total` to determine total pages: `Math.ceil(total / pageSize)`

### Date Format

- Use ISO 8601 format with UTC timezone
- Format: `YYYY-MM-DDTHH:mm:ss+00:00`
- Example: `"2023-12-01T00:00:00+00:00"`

### Response Handling

1. **Check Success:** Always check `success === true` before processing data
2. **Check Error Code:** `errorCode === "0"` indicates success
3. **Handle Null Values:** Many fields can be `null` or empty strings
4. **Metadata Fields:** Fields like `imsi`, `msisdn`, `smsStatus` come from metadata and may be `null` if not available

## Common Use Cases

### Find eSIM by Order Number

**Use Case:** User wants to look up their eSIM purchase by order number.

**Approach:**
- Send request with `orderNo` set to the specific order number
- Include pagination (usually page 1, pageSize 20)
- Check if `esimList` contains results

### List All User's eSIMs

**Use Case:** Display all eSIM purchases for a user.

**Approach:**
- Omit all filter parameters or use date range
- Implement pagination to handle multiple pages
- Display results with pagination controls

### Check eSIM Status

**Use Case:** Determine if an eSIM is active, expired, or cancelled.

**Approach:**
- Query by `orderNo` or `iccid`
- Check `esimStatus` field in response
- Check `expiredTime` to see if expired
- Check `isActive` equivalent through status values

### Get QR Code for Activation

**Use Case:** Retrieve QR code URL for eSIM activation.

**Approach:**
- Query by `orderNo` or `iccid`
- Check `qrCodeUrl` field in response
- If `qrCodeUrl` is null, check `ac` field for activation code
- Display QR code image or activation code to user

## Best Practices

1. **Error Handling:** Always implement error handling for network requests
2. **Loading States:** Show loading indicators while fetching data
3. **Empty States:** Handle cases where `esimList` is empty
4. **Pagination UI:** Provide navigation controls for paginated results
5. **Date Formatting:** Format dates for display in user's local timezone
6. **Data Validation:** Validate response structure before accessing nested fields
7. **Caching:** Consider caching query results to reduce API calls
8. **Debouncing:** If implementing search, debounce input to avoid excessive requests

## Integration Notes

- This is a **public endpoint** - no authentication token required
- The endpoint matches the eSIM Access API format for compatibility
- All timestamps use UTC timezone with `+0000` offset
- Empty strings in filter fields are treated as "no filter"
- The endpoint queries your internal database, not the external eSIM Access API

## Troubleshooting

### No Results Returned

- Verify the filter parameters are correct
- Check if the order number, ICCID, or transaction number exists in the database
- Ensure date ranges are valid and in correct format
- Check if pagination is set correctly

### Null Values in Response

- Many fields can be `null` if data is not available (especially metadata fields)
- This is expected behavior for eSIMs that haven't been fully activated
- Check `packageMetadata` equivalent fields may not be populated

### Date Format Issues

- Ensure dates are in ISO 8601 format with UTC timezone
- Use `+00:00` timezone offset, not `Z`
- Format: `YYYY-MM-DDTHH:mm:ss+00:00`

### Pagination Issues

- Page numbers start from 1, not 0
- Check `pager.total` to determine if more pages exist
- Ensure `pageSize` doesn't exceed 100

## Invoice Check Endpoint

### Overview

The invoice check endpoint allows you to verify if a QPay invoice has been paid and automatically retrieves the eSIM order number when the payment is confirmed.

**URL:** `/api/transactions/check/:invoiceId`  
**Method:** `POST`  
**Authentication:** None (Public endpoint)

### Endpoint Details

- **Development:** `http://localhost:3001/api/transactions/check/{invoiceId}`
- **Production:** `https://your-api-domain.com/api/transactions/check/{invoiceId}`

### Request

**Path Parameter:**
- `invoiceId` (string, required): The QPay invoice ID to check

**Example:**
```
POST /api/transactions/check/INV-123456789
```

### Response Format

The endpoint returns different response structures based on the invoice status:

#### Success Response - Invoice Paid and Order Placed

**Status Code:** `200 OK`

When the invoice is paid and the eSIM order is successfully placed:

```json
{
  "count": 1,
  "rows": [
    {
      "payment_status": "PAID"
    }
  ],
  "orderPlaced": true,
  "orderNo": "B23120118131854",
  "esimOrderNo": "B23120118131854",
  "transactionId": "TXN-20240101-ABC123",
  "message": "Invoice paid and eSIM order placed successfully"
}
```

#### Success Response - Invoice Already Processed

**Status Code:** `200 OK`

When the invoice was already processed previously:

```json
{
  "count": 1,
  "rows": [
    {
      "payment_status": "PAID"
    }
  ],
  "orderPlaced": true,
  "alreadyProcessed": true,
  "orderNo": "B23120118131854",
  "esimOrderNo": "B23120118131854",
  "message": "Invoice already processed"
}
```

#### Response - Invoice Not Paid

**Status Code:** `200 OK`

When the invoice has not been paid yet:

```json
{
  "count": 0,
  "rows": [],
  "orderPlaced": false,
  "message": "Invoice not paid yet"
}
```

#### Error Response - Invoice Paid but Order Failed

**Status Code:** `200 OK`

When the invoice is paid but the eSIM order placement failed:

```json
{
  "count": 1,
  "rows": [
    {
      "payment_status": "PAID"
    }
  ],
  "orderPlaced": false,
  "error": "Failed to place eSIM order: <error details>",
  "message": "Invoice is paid but eSIM order failed"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `count` | number | Number of payment records found |
| `rows` | array | Array of payment status records |
| `orderPlaced` | boolean | Whether eSIM order was placed successfully |
| `orderNo` | string \| undefined | eSIM order number (when order is placed or already processed) |
| `esimOrderNo` | string \| undefined | Explicit eSIM order number field (same as orderNo) |
| `transactionId` | string \| undefined | Internal transaction ID (when order is placed) |
| `alreadyProcessed` | boolean | Whether invoice was already processed (only present if true) |
| `error` | string \| undefined | Error message (only present if order failed) |
| `message` | string | Human-readable status message |

### eSIM Order Number

The endpoint automatically retrieves and returns the eSIM `orderNo` in the following scenarios:

1. **New Order Placed:** When an invoice is paid and a new eSIM order is successfully placed, the `orderNo` is retrieved from the created eSIM purchase records.

2. **Already Processed:** When checking an invoice that was already processed, the `orderNo` is retrieved from existing eSIM purchase records associated with that invoice.

3. **Response Fields:** The order number is available in both `orderNo` and `esimOrderNo` fields for clarity and compatibility.

### Usage Guidelines

1. **Polling:** This endpoint is designed to be polled periodically to check invoice payment status
2. **Order Number:** Always check for `orderNo` or `esimOrderNo` in the response when `orderPlaced` is `true`
3. **Error Handling:** Check `orderPlaced` and `error` fields to handle order failures
4. **Already Processed:** Use `alreadyProcessed` flag to detect if invoice was previously processed
5. **Query eSIM:** Once you have the `orderNo`, you can use the eSIM Query endpoint to get full eSIM details

### Integration Flow

1. **Create Invoice:** User creates an invoice for eSIM purchase
2. **Payment:** User completes payment via QPay
3. **Poll Status:** Frontend polls this endpoint with the invoice ID
4. **Check Payment:** Verify `count > 0` and payment status is "PAID"
5. **Get Order Number:** Extract `orderNo` or `esimOrderNo` from response
6. **Query eSIM:** Use the order number with the eSIM Query endpoint to get full details

### Best Practices

1. **Polling Interval:** Poll every 2-5 seconds while waiting for payment
2. **Timeout:** Set a maximum polling duration (e.g., 5 minutes)
3. **Error Handling:** Handle cases where order placement fails even though payment succeeded
4. **Order Number Storage:** Store the `orderNo` for future reference and eSIM queries
5. **User Feedback:** Show appropriate messages based on `orderPlaced` and `alreadyProcessed` flags

### Example Use Case

**Scenario:** User pays for eSIM and you need to retrieve the order number.

**Steps:**
1. User completes QPay payment and receives invoice ID
2. Frontend starts polling `/api/transactions/check/{invoiceId}`
3. When payment is confirmed, response includes `orderNo`
4. Frontend stores `orderNo` and can query full eSIM details using the eSIM Query endpoint
5. Display eSIM information to user

## Related Endpoints

- **User eSIM Purchases:** `GET /api/transactions/my-esims` (requires authentication)
- **Specific Purchase:** `GET /api/transactions/my-esims/:purchaseId` (requires authentication)
- **Purchase eSIM:** `POST /api/transactions/purchase-esim` (requires authentication)
- **Query eSIM by Order Number:** `POST /api/v1/open/esim/query` (use `orderNo` parameter)

## Support

For issues or questions:
- Check API response `errorMsg` field for details
- Verify request format matches documentation
- Ensure all required fields are properly formatted
- Check `orderPlaced` and `error` fields for order status

