# eSIM Order Endpoint - Frontend Integration Guide

## Overview

This document provides guidance for integrating the eSIM order endpoint (`POST /api/transactions/order-esim`) into a Next.js frontend application. The endpoint allows users to order eSIM profiles, automatically deducts balance from their wallet, and places orders with the eSIM Access provider.

## Endpoint Details

**URL:** `/api/transactions/order-esim`  
**Method:** `POST`  
**Authentication:** Required (JWT Bearer Token)  
**Content-Type:** `application/json`

## Authentication

All requests to this endpoint require JWT authentication. The token must be included in the Authorization header:

```
Authorization: Bearer {your_jwt_token}
```

The JWT token is obtained through the sign-in endpoint (`POST /api/auth/signin`). Store the token securely (e.g., in httpOnly cookies or secure storage) and include it in all API requests.

## Request Format

### Required Fields

- **amount** (number): Total amount for the order. This should be the sum of all package prices multiplied by their counts. The amount is in the smallest currency unit (e.g., cents for USD).

- **packageInfoList** (array): Array of package objects to order. Each package object must contain:
  - **packageCode** (string): The eSIM package code from the eSIM Access API
  - **count** (number): Number of profiles to order (minimum: 1)
  - **price** (number): Price per package in smallest currency unit

### Optional Fields

- **transactionId** (string): Unique transaction identifier. If not provided, the backend will auto-generate one. If provided, it must be unique across all transactions.

- **periodNum** (number): Period number for daily plans (number of days). Only required for daily plan packages.

### Request Body Structure

The request body should be a JSON object with the following structure:

- `transactionId`: Optional unique identifier
- `amount`: Total order amount (sum of all package prices × counts)
- `packageInfoList`: Array of package objects
  - Each package object contains: `packageCode`, `count`, `price`
- `periodNum`: Optional period number for daily plans

## Response Format

### Success Response (201 Created)

On successful order placement, the endpoint returns:

- **orderNo** (string): Order number from eSIM provider (e.g., "B23051616050537")
- **transactionId** (string): Transaction ID used for the order
- **amount** (number): Total amount charged
- **transactionStatus** (string): Status of the transaction (typically "COMPLETED")
- **balanceBefore** (number): User's wallet balance before the transaction
- **balanceAfter** (number): User's wallet balance after the transaction

### Error Responses

#### 400 Bad Request - Insufficient Balance

Returned when the user's wallet balance is less than the required amount.

Error response includes:
- Status code: 400
- Message indicating current balance and required amount

#### 400 Bad Request - Duplicate Transaction ID

Returned when the provided transaction ID already exists in the system.

Error response includes:
- Status code: 400
- Message indicating the transaction ID already exists

#### 400 Bad Request - Order Failed

Returned when the eSIM Access API call fails or returns an error.

Error response includes:
- Status code: 400
- Message with details about the API failure

#### 401 Unauthorized

Returned when:
- No authentication token is provided
- The authentication token is invalid or expired

#### 404 Not Found

Returned when:
- User or wallet is not found in the system

## Integration Steps

### 1. Prerequisites

Before integrating the order endpoint, ensure:

- User authentication is implemented (sign-in/sign-up)
- JWT token is stored and accessible
- Wallet balance checking functionality exists
- Package information is available from the inquiry/packages endpoint

### 2. Pre-Order Validation

Before calling the order endpoint, validate:

- User is authenticated (has valid JWT token)
- User's wallet balance is sufficient for the order
- All package codes are valid
- Amount calculation is correct (sum of all package prices × counts)
- Transaction ID is unique (if providing custom transaction ID)

### 3. Order Flow

The recommended order flow:

1. **User selects packages** - User selects eSIM packages from the marketplace/inquiry results
2. **Calculate total amount** - Sum up all package prices multiplied by their counts
3. **Check wallet balance** - Verify user has sufficient balance (call wallet balance endpoint)
4. **Prepare order request** - Build the request body with package information
5. **Place order** - Call the order endpoint with authentication
6. **Handle response** - Process success or error response
7. **Update UI** - Show order confirmation or error message
8. **Refresh balance** - Update wallet balance display

### 4. Error Handling Strategy

Implement comprehensive error handling:

- **Network errors**: Handle connection failures, timeouts
- **Authentication errors**: Redirect to login if token is invalid
- **Insufficient balance**: Show balance information and suggest adding funds
- **Duplicate transaction**: Generate new transaction ID and retry
- **API failures**: Show user-friendly error message, log details for debugging

### 5. User Experience Considerations

- **Loading states**: Show loading indicator during order processing
- **Confirmation dialogs**: Confirm order before placing (especially for large amounts)
- **Success feedback**: Display order number and updated balance
- **Error messages**: Show clear, actionable error messages
- **Transaction history**: Optionally redirect to transaction history after successful order

## Best Practices

### Security

- Never expose the JWT token in client-side code that could be logged
- Store tokens securely (httpOnly cookies recommended)
- Implement token refresh mechanism for expired tokens
- Validate all user inputs before sending to the API

### Performance

- Cache package information when possible
- Implement request debouncing to prevent duplicate orders
- Show optimistic UI updates where appropriate
- Handle long-running requests with proper timeout handling

### Reliability

- Implement retry logic for transient failures (with exponential backoff)
- Store order information locally before API call (for recovery)
- Implement idempotency checks (transaction ID uniqueness)
- Log all order attempts for debugging and audit purposes

### User Experience

- Provide clear feedback at each step of the order process
- Show order summary before final confirmation
- Display estimated processing time
- Allow order cancellation (if supported) before completion
- Provide order tracking capabilities

## Order Status Flow

After placing an order:

1. **Order Placed**: Transaction created with PENDING status
2. **API Call**: Request sent to eSIM Access API
3. **Order Processing**: eSIM provider allocates profiles asynchronously
4. **Order Complete**: Transaction status updated to COMPLETED
5. **Profile Allocation**: Profiles are allocated (query via `/api/v1/open/esim/query`)

Note: The order endpoint returns immediately with an order number. Profile allocation happens asynchronously. You may need to implement polling or webhook handling to check when profiles are ready.

## Transaction ID Management

### Auto-Generation (Recommended)

If you don't provide a `transactionId`, the backend will auto-generate one in the format: `TXN-YYYYMMDD-XXXXXX`

Benefits:
- Guaranteed uniqueness
- Automatic formatting
- No need to manage ID generation

### Custom Transaction ID

If you provide a custom `transactionId`:

- Must be unique across all transactions
- Recommended format: Include timestamp and user identifier
- Handle duplicate ID errors gracefully
- Consider using UUIDs for guaranteed uniqueness

## Amount Calculation

The `amount` field should be calculated as:

```
amount = sum(package.price × package.count) for all packages
```

Example:
- Package 1: price = 10000, count = 2 → subtotal = 20000
- Package 2: price = 5000, count = 1 → subtotal = 5000
- Total amount = 25000

## Package Information

Package codes and prices should come from:

- The inquiry/packages endpoint (`GET /api/inquiry/packages`)
- The marketplace endpoint (`GET /api/marketplace/packages`)
- Package details stored from previous API calls

Ensure package codes are valid and prices match current pricing from the eSIM provider.

## Balance Management

### Before Ordering

Always check the user's wallet balance before allowing order placement:

1. Call the wallet balance endpoint
2. Compare balance with required amount
3. Show insufficient balance warning if needed
4. Provide option to add funds

### After Ordering

After successful order:

1. The balance is automatically deducted by the backend
2. Refresh wallet balance display
3. Show updated balance to the user
4. Optionally show transaction in recent transactions list

## Testing Checklist

Before deploying to production, test:

- [ ] Successful order with single package
- [ ] Successful order with multiple packages
- [ ] Order with auto-generated transaction ID
- [ ] Order with custom transaction ID
- [ ] Insufficient balance error handling
- [ ] Duplicate transaction ID error handling
- [ ] Invalid package code error handling
- [ ] Network failure handling
- [ ] Authentication token expiration handling
- [ ] Order confirmation UI flow
- [ ] Balance update after successful order
- [ ] Error message display

## Monitoring and Logging

Track the following metrics:

- Order success rate
- Average order processing time
- Error rates by error type
- Balance deduction accuracy
- Transaction ID collision rate

Log important events:
- Order attempts (with transaction ID)
- Order successes (with order number)
- Order failures (with error details)
- Balance changes

## Support and Troubleshooting

### Common Issues

**Issue**: Order fails with "Insufficient balance" but user has enough funds
- **Solution**: Check if amount is in correct currency unit (smallest unit, e.g., cents)

**Issue**: Duplicate transaction ID error
- **Solution**: Ensure transaction IDs are unique, or let backend auto-generate

**Issue**: Order succeeds but profiles not available
- **Solution**: Profile allocation is asynchronous, query the eSIM query endpoint to check status

**Issue**: Authentication errors
- **Solution**: Verify token is valid and not expired, implement token refresh

### Debugging Tips

- Check network tab for actual request/response
- Verify request body format matches documentation
- Confirm authentication header is included
- Review backend logs for detailed error information
- Test with different package combinations
- Verify amount calculations are correct

## Related Endpoints

- `GET /api/wallet/me` - Get current wallet balance
- `GET /api/transactions/me` - Get transaction history
- `GET /api/inquiry/packages` - Get available packages
- `POST /api/auth/signin` - Authenticate user

## Next Steps

After successful order placement:

1. Store order number for reference
2. Implement profile query functionality (to check when profiles are allocated)
3. Display order confirmation with order number
4. Update wallet balance display
5. Add order to transaction history
6. Optionally send confirmation email/notification

## Additional Notes

- The order endpoint uses database transactions to ensure atomicity
- If the eSIM Access API call fails, the wallet balance is NOT deducted
- Order information is stored in the transaction metadata
- The order number from eSIM Access is returned for tracking purposes
- Profile allocation happens asynchronously after order placement

