# QPay Invoice Status Check - Frontend Implementation Guide

This guide details how to implement the invoice status check functionality in the frontend application. This endpoint allows you to verify if a specific QPay invoice has been paid.

## Endpoint Overview

The system exposes a protected endpoint to check the status of a QPay invoice. This should be polled or called when the user completes a payment flow or returns to the application after payment.

- **URL**: `/transactions/check/:invoiceId`
- **Method**: `POST`
- **Authentication**: Required (JWT Bearer Token)

## Prerequisites

Before calling this endpoint, ensure:
1.  The user is logged in and you have a valid JWT access token.
2.  You have the `invoiceId` returned from the Invoice Creation step.

## API Specification

### Request

- **Endpoint**: `POST /transactions/check/{invoiceId}`
- **Headers**:
    -   `Authorization`: `Bearer <your_access_token>`
    -   `Content-Type`: `application/json`
- **URL Parameters**:
    -   `invoiceId`: The unique identifier of the invoice to check.

### Response

The response forwards the data returned by the QPay `payment/check` API.

**Success (200 OK)**

The structure typically includes the payment count and details.

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
      "payment_currency": "MNT"
    }
  ]
}
```

> **Note**: If `count` is 0 or `rows` is empty, the invoice has not been paid yet.

**Errors**

-   `401 Unauthorized`: Missing or invalid JWT token.
-   `404 Not Found`: Invoice ID not found.
-   `400 Bad Request`: Invalid parameters.

## Implementation Examples

### 1. JavaScript `fetch` Implementation

This example demonstrates a function to check the invoice status. You might want to implement a polling mechanism to check periodically.

```javascript
/**
 * Checks the status of a specific invoice.
 * 
 * @param {string} invoiceId - The ID of the invoice to check.
 * @param {string} token - The user's JWT authentication token.
 * @returns {Promise<Object>} The payment status response.
 */
async function checkInvoiceStatus(invoiceId, token) {
  const baseUrl = 'https://your-api-domain.com'; // Replace with actual API base URL
  const url = `${baseUrl}/transactions/check/${invoiceId}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized: Please log in again.');
      }
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to check invoice status');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking invoice status:', error);
    throw error;
  }
}

// Usage Example
async function handlePaymentCheck(invoiceId, token) {
  try {
    const result = await checkInvoiceStatus(invoiceId, token);
    
    // Check if payment is successful
    if (result.count > 0 && result.rows.some(row => row.payment_status === 'PAID')) {
      console.log('Payment successful!');
      // Proceed to success screen
    } else {
      console.log('Payment not yet received.');
      // Handle pending state or retry
    }
  } catch (error) {
    // Handle API errors
  }
}
```

### 2. cURL Example

Use this for testing the endpoint directly from the terminal.

```bash
curl -X POST https://your-api-domain.com/transactions/check/YOUR_INVOICE_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

## Integration Logic Recommendations

1.  **Polling Strategy**: After displaying the QPay QR code, initiate a polling interval (e.g., every 3-5 seconds) to call this endpoint.
2.  **Stop Conditions**: Stop polling when:
    -   The response indicates `PAID` status.
    -   A timeout is reached (e.g., 5 minutes).
    -   The user manually cancels or navigates away.
3.  **Feedback**: Provide visual feedback to the user while checking (e.g., "Waiting for payment confirmation...").

