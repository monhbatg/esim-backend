# Troubleshooting 401 Unauthorized on Invoice Check Endpoint

## Common Causes of 401 Unauthorized

The `POST /transactions/check/:invoiceId` endpoint requires JWT authentication. Here are the most common reasons for 401 errors:

### 1. Missing Authorization Header

**Error**: `"No token provided"`

**Solution**: Ensure the request includes the Authorization header:
```bash
Authorization: Bearer <your_jwt_token>
```

**Check**:
- Header name is exactly `Authorization` (case-sensitive)
- Value starts with `Bearer ` (note the space after Bearer)
- Token is included after `Bearer `

### 2. Invalid or Expired JWT Token

**Error**: `"Unauthorized"` or `"jwt expired"`

**Solution**: 
- Get a fresh token by logging in again
- Check token expiration time
- Verify token hasn't been tampered with

**How to check token expiration**:
```javascript
// Decode JWT (without verification) to check expiration
const token = 'your_token_here';
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Expires at:', new Date(payload.exp * 1000));
console.log('Current time:', new Date());
```

### 3. Wrong JWT Secret

**Error**: `"invalid signature"` or `"jwt malformed"`

**Solution**: 
- Verify `JWT_SECRET` environment variable matches the secret used to sign tokens
- Check `.env` file has correct `JWT_SECRET` value
- Restart application after changing `JWT_SECRET`

### 4. User Not Found or Inactive

**Error**: `"Invalid token or user not found"` or `"User not found or inactive"`

**Solution**:
- Verify the user exists in the database
- Check `users.isActive` is `true` for the user
- Ensure user ID in token payload matches existing user

**Database Check**:
```sql
SELECT id, email, "isActive" FROM users WHERE id = '<user_id_from_token>';
```

### 5. Token Format Issues

**Error**: `"jwt malformed"`

**Solution**: 
- Ensure token is a valid JWT (three parts separated by dots: `header.payload.signature`)
- Don't include quotes around the token
- Don't include extra spaces

**Correct Format**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

## Debugging Steps

### Step 1: Verify Request Headers

```bash
# Test with cURL to see exact request
curl -v -X POST http://localhost:3000/transactions/check/INV-123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Look for:
- `Authorization` header in request
- Status code in response
- Error message in response body

### Step 2: Check Backend Logs

Enable logging in development to see detailed errors:

```typescript
// In jwt-auth.guard.ts, add logging:
canActivate(context: ExecutionContext) {
  const request = context.switchToHttp().getRequest<Request>();
  const authHeader = request.headers.authorization;
  
  console.log('Auth header:', authHeader ? 'Present' : 'Missing');
  console.log('Header value:', authHeader);
  
  // ... rest of guard logic
}
```

### Step 3: Verify Token Validity

```javascript
// Test token validation
const jwt = require('jsonwebtoken');
const token = 'your_token_here';
const secret = process.env.JWT_SECRET;

try {
  const decoded = jwt.verify(token, secret);
  console.log('Token is valid:', decoded);
} catch (error) {
  console.error('Token validation error:', error.message);
}
```

### Step 4: Check User Status

```sql
-- Check if user exists and is active
SELECT 
  id, 
  email, 
  "isActive", 
  "createdAt"
FROM users 
WHERE id = '<user_id_from_token_payload>';
```

## Quick Fixes

### Fix 1: Re-authenticate
```bash
# Get a new token
POST /auth/login
Body: { "email": "user@example.com", "password": "password" }
Response: { "accessToken": "...", "expiresIn": 3600 }
```

### Fix 2: Check Environment Variables
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Or in .env file
cat .env | grep JWT_SECRET
```

### Fix 3: Verify User is Active
```sql
-- Activate user if needed
UPDATE users SET "isActive" = true WHERE id = '<user_id>';
```

## Testing Authentication

### Test 1: Valid Token
```bash
TOKEN="your_valid_token"
curl -X POST http://localhost:3000/transactions/check/INV-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Test 2: Missing Token
```bash
curl -X POST http://localhost:3000/transactions/check/INV-123 \
  -H "Content-Type: application/json"
# Should return 401
```

### Test 3: Invalid Token Format
```bash
curl -X POST http://localhost:3000/transactions/check/INV-123 \
  -H "Authorization: Bearer invalid_token_here" \
  -H "Content-Type: application/json"
# Should return 401
```

## Common Mistakes

1. **Missing "Bearer " prefix**
   ```bash
   # Wrong
   Authorization: <token>
   
   # Correct
   Authorization: Bearer <token>
   ```

2. **Extra spaces**
   ```bash
   # Wrong
   Authorization: Bearer  <token>
   
   # Correct
   Authorization: Bearer <token>
   ```

3. **Token in wrong header**
   ```bash
   # Wrong
   X-Auth-Token: <token>
   
   # Correct
   Authorization: Bearer <token>
   ```

4. **Using expired token**
   - Tokens typically expire after 1 hour
   - Get a new token by logging in again

5. **Token from different environment**
   - Development tokens won't work in production
   - Ensure token matches the environment's JWT_SECRET

## Making Endpoint Public (If Needed)

If you need to make this endpoint public (not recommended for production), you can:

### Option 1: Remove Guard from Specific Endpoint

```typescript
@Post('check/:invoiceId')
@HttpCode(HttpStatus.OK)
@Public() // Custom decorator to skip auth
async checkInvoiceStatus(
  @Param('invoiceId') invoiceId: string,
): Promise<any> {
  return await this.qpayConnectionService.checkInvoice(invoiceId);
}
```

### Option 2: Create Public Guard Override

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Then modify the guard:
```typescript
canActivate(context: ExecutionContext) {
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  
  if (isPublic) {
    return true;
  }
  
  // ... existing auth logic
}
```

**⚠️ Warning**: Making invoice check public is a security risk. Anyone could check any invoice status.

## Still Getting 401?

1. **Check backend logs** for detailed error messages
2. **Verify JWT_SECRET** matches in all environments
3. **Test with Postman** to isolate frontend issues
4. **Check network tab** in browser DevTools for actual request headers
5. **Verify token expiration** hasn't passed
6. **Ensure user account** is active in database

## Support

If the issue persists:
1. Share the exact error message from response
2. Include request headers (without token)
3. Check backend application logs
4. Verify environment variables are loaded correctly

