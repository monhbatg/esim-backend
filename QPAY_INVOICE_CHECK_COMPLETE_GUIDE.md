# QPay Invoice Status Check - Complete Implementation Guide

This comprehensive guide covers the QPay invoice status check endpoint from backend implementation to frontend integration.

## Table of Contents
1. [Endpoint Overview](#endpoint-overview)
2. [Backend Implementation](#backend-implementation)
3. [API Specification](#api-specification)
4. [Response Structure](#response-structure)
5. [Error Handling](#error-handling)
6. [Frontend Integration](#frontend-integration)
7. [Testing Guide](#testing-guide)
8. [Best Practices](#best-practices)

---

## Endpoint Overview

**Endpoint**: `POST /transactions/check/:invoiceId`  
**Controller**: `TransactionsController.checkInvoiceStatus()`  
**Service**: `QpayConnectionService.checkInvoice()`  
**Authentication**: Required (JWT Bearer Token)  
**Purpose**: Check if a QPay invoice has been paid by querying the QPay payment/check API

---

## Backend Implementation

### Controller Layer (`transactions.controller.ts`)

```typescript
@Post('check/:invoiceId')
@HttpCode(HttpStatus.OK)
@ApiOperation({
  summary: 'Check QPay invoice status',
  description: 'Нэхэмжлэл төлөгдсөн эсэхийг шалгах',
})
async checkInvoiceStatus(
  @Request() req: AuthRequest,
  @Param('invoiceId') invoiceId: string,
): Promise<any> {
  return await this.qpayConnectionService.checkInvoice(invoiceId);
}
```

**Key Points:**
- Protected by `JwtAuthGuard` (inherited from controller level)
- Accepts `invoiceId` as URL parameter
- Returns raw QPay API response
- HTTP 200 status code on success

### Service Layer (`qpay.connection.service.ts`)

The service method:
1. Retrieves a valid QPay access token (cached or fresh)
2. Calls QPay `/payment/check` endpoint
3. Returns the payment status response

**Request Payload to QPay:**
```json
{
  "object_type": "INVOICE",
  "object_id": "<invoiceId>",
  "offset": {
    "page_number": 1,
    "page_limit": 100
  }
}
```

---

## API Specification

### Request

**URL**: `POST /transactions/check/{invoiceId}`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Path Parameters:**
- `invoiceId` (string, required): The QPay invoice ID to check

**Example Request:**
```bash
POST /transactions/check/INV-123456789
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Response

**Success Response (200 OK)**

The response structure matches QPay's payment/check API response:

```json
{
  "count": 1,
  "paid_amount": 5000,
  "rows": [
    {
      "payment_id": "123456789",
      "payment_status": "PAID",
      "payment_date": "2024-01-01 12:00:00",
      "payment_fee": 0,
      "payment_currency": "MNT",
      "invoice_id": "INV-123456789"
    }
  ]
}
```

**Unpaid Invoice Response:**
```json
{
  "count": 0,
  "paid_amount": 0,
  "rows": []
}
```

**Response Fields:**
- `count` (number): Number of payments found (0 = unpaid, >0 = paid)
- `paid_amount` (number): Total amount paid in the smallest currency unit (MNT)
- `rows` (array): Array of payment records
  - `payment_id` (string): Unique payment identifier
  - `payment_status` (string): Payment status (typically "PAID")
  - `payment_date` (string): Payment timestamp
  - `payment_fee` (number): Transaction fee
  - `payment_currency` (string): Currency code (usually "MNT")

### Error Responses

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**400 Bad Request**
```json
{
  "statusCode": 400,
  "message": "Invalid invoice ID"
}
```

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Invoice not found"
}
```

**500 Internal Server Error**
```json
{
  "statusCode": 500,
  "message": "Error checking invoice: <error details>"
}
```

---

## Response Structure

### Payment Status Detection

To determine if an invoice is paid:

```javascript
function isInvoicePaid(response) {
  return response.count > 0 && 
         response.rows.length > 0 && 
         response.rows.some(row => row.payment_status === 'PAID');
}
```

### Amount Conversion

QPay returns amounts in the smallest currency unit (MNT). To convert to main currency:

```javascript
// MNT to main currency (divide by 100)
const amountInMainCurrency = response.paid_amount / 100;
```

---

## Error Handling

### Common Error Scenarios

1. **Invalid Invoice ID**
   - QPay returns error for non-existent invoice
   - Backend forwards the error to client
   - Handle with user-friendly message

2. **Token Expiration**
   - QPay token may expire
   - Service automatically refreshes token
   - Retry logic handled internally

3. **Network Errors**
   - Connection timeout to QPay
   - Service logs error and throws
   - Frontend should implement retry logic

4. **Authentication Errors**
   - JWT token expired or invalid
   - Returns 401 Unauthorized
   - Frontend should redirect to login

---

## Frontend Integration

### Basic Implementation

```javascript
/**
 * Check QPay invoice payment status
 * @param {string} invoiceId - QPay invoice ID
 * @param {string} token - JWT authentication token
 * @returns {Promise<Object>} Payment status response
 */
async function checkInvoiceStatus(invoiceId, token) {
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.example.com';
  const url = `${API_BASE_URL}/transactions/check/${invoiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to check invoice status');
  }

  return await response.json();
}
```

### Polling Implementation

```javascript
/**
 * Poll invoice status until paid or timeout
 * @param {string} invoiceId - Invoice ID to check
 * @param {string} token - JWT token
 * @param {Object} options - Polling options
 * @returns {Promise<Object>} Payment status when paid
 */
async function pollInvoiceStatus(invoiceId, token, options = {}) {
  const {
    interval = 3000,      // Check every 3 seconds
    timeout = 300000,      // 5 minutes timeout
    onStatus = null        // Callback for each check
  } = options;

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          reject(new Error('Payment check timeout'));
          return;
        }

        const result = await checkInvoiceStatus(invoiceId, token);
        
        // Call status callback if provided
        if (onStatus) {
          onStatus(result);
        }

        // Check if paid
        if (result.count > 0 && result.rows.some(r => r.payment_status === 'PAID')) {
          resolve(result);
        } else {
          // Continue polling
          setTimeout(poll, interval);
        }
      } catch (error) {
        // On auth error, stop polling
        if (error.message.includes('Unauthorized')) {
          reject(error);
        } else {
          // Retry on other errors
          setTimeout(poll, interval);
        }
      }
    };

    poll();
  });
}

// Usage
pollInvoiceStatus(invoiceId, token, {
  interval: 3000,
  timeout: 300000,
  onStatus: (status) => {
    console.log('Payment status:', status);
    // Update UI with status
  }
})
  .then(result => {
    console.log('Payment confirmed!', result);
    // Navigate to success page
  })
  .catch(error => {
    console.error('Payment check failed:', error);
    // Show error message
  });
```

### React Hook Example

```javascript
import { useState, useEffect, useRef } from 'react';

function useInvoiceStatus(invoiceId, token, enabled = true) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPaid, setIsPaid] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled || !invoiceId || !token) return;

    const checkStatus = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await checkInvoiceStatus(invoiceId, token);
        setStatus(result);
        setIsPaid(result.count > 0 && result.rows.some(r => r.payment_status === 'PAID'));
      } catch (err) {
        setError(err.message);
        if (err.message.includes('Unauthorized')) {
          // Stop polling on auth error
          clearInterval(intervalRef.current);
        }
      } finally {
        setLoading(false);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 3 seconds
    intervalRef.current = setInterval(checkStatus, 3000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [invoiceId, token, enabled]);

  // Stop polling when paid
  useEffect(() => {
    if (isPaid && intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [isPaid]);

  return { status, loading, error, isPaid };
}

// Component usage
function PaymentStatus({ invoiceId, token }) {
  const { status, loading, error, isPaid } = useInvoiceStatus(invoiceId, token);

  if (loading && !status) {
    return <div>Checking payment status...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (isPaid) {
    return <div>Payment confirmed! Amount: {status.paid_amount / 100} MNT</div>;
  }

  return <div>Waiting for payment... (Last checked: {new Date().toLocaleTimeString()})</div>;
}
```

---

## Testing Guide

### Manual Testing with cURL

```bash
# Replace with your actual values
INVOICE_ID="INV-123456789"
TOKEN="your_jwt_token_here"
BASE_URL="https://api.example.com"

curl -X POST "${BASE_URL}/transactions/check/${INVOICE_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -v
```

### Postman Collection

**Request:**
- Method: `POST`
- URL: `{{baseUrl}}/transactions/check/{{invoiceId}}`
- Headers:
  - `Authorization`: `Bearer {{jwt_token}}`
  - `Content-Type`: `application/json`

**Tests:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has count field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('count');
});

pm.test("Response has rows array", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('rows');
    pm.expect(jsonData.rows).to.be.an('array');
});
```

### Unit Testing Example

```javascript
describe('checkInvoiceStatus', () => {
  it('should return payment status for valid invoice', async () => {
    const invoiceId = 'INV-123456789';
    const mockResponse = {
      count: 1,
      paid_amount: 5000,
      rows: [{
        payment_id: '123',
        payment_status: 'PAID',
        payment_date: '2024-01-01 12:00:00'
      }]
    };

    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await checkInvoiceStatus(invoiceId, 'token');
    expect(result.count).toBe(1);
    expect(result.rows[0].payment_status).toBe('PAID');
  });
});
```

---

## Best Practices

### 1. Polling Strategy
- **Interval**: 3-5 seconds is optimal (balance between responsiveness and server load)
- **Timeout**: 5-10 minutes maximum
- **Exponential Backoff**: Consider increasing interval after multiple checks
- **Stop Conditions**: Stop when paid, timeout, or user navigates away

### 2. Error Handling
- Always handle network errors gracefully
- Show user-friendly error messages
- Implement retry logic for transient errors
- Log errors for debugging

### 3. User Experience
- Show loading indicators during checks
- Display last check timestamp
- Provide cancel/stop polling option
- Show clear success/failure states

### 4. Security
- Never expose JWT tokens in logs
- Validate invoice IDs before sending
- Implement rate limiting on frontend
- Use HTTPS for all API calls

### 5. Performance
- Cache token to avoid unnecessary auth calls
- Debounce rapid status checks
- Clean up intervals on component unmount
- Consider WebSocket for real-time updates (if available)

### 6. Backend Considerations
- Monitor QPay API rate limits
- Implement caching for frequently checked invoices
- Log all invoice checks for audit trail
- Handle QPay API downtime gracefully

---

## Integration Flow Diagram

```
User Initiates Payment
    ↓
Create Invoice (POST /transactions/createInvoice)
    ↓
Receive invoiceId and QR code
    ↓
Display QR code to user
    ↓
Start Polling (POST /transactions/check/:invoiceId)
    ↓
    ├─→ [Every 3 seconds] Check status
    │   ├─→ Unpaid → Continue polling
    │   └─→ Paid → Stop polling, show success
    │
    ├─→ [Timeout] Stop polling, show timeout message
    └─→ [Error] Handle error, allow retry
```

---

## Troubleshooting

### Issue: Always returns count: 0
**Solution**: Verify invoice ID is correct and invoice was created successfully

### Issue: 401 Unauthorized
**Solution**: Check JWT token is valid and not expired. Refresh token if needed.

### Issue: Polling never stops
**Solution**: Ensure you're checking `count > 0` and `payment_status === 'PAID'`

### Issue: Network errors
**Solution**: Implement retry logic with exponential backoff

### Issue: Token refresh issues
**Solution**: Backend handles token refresh automatically. Check logs for QPay authentication errors.

---

## Additional Resources

- QPay API Documentation: [QPay Payment Check API](https://doc.qpay.mn/)
- Related Endpoints:
  - `POST /transactions/createInvoice` - Create QPay invoice
  - `GET /transactions` - View transaction history

---

## Support

For issues or questions:
1. Check backend logs for detailed error messages
2. Verify QPay API status
3. Review authentication token validity
4. Contact backend team with invoice ID and timestamp

