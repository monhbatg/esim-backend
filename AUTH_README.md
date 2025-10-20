# Authentication System Documentation

This NestJS application includes a comprehensive authentication system with JWT tokens, password hashing, and PostgreSQL integration.

## Features

- **User Registration & Login**: Secure signup and signin endpoints
- **JWT Authentication**: Token-based authentication with configurable expiration
- **Password Security**: Bcrypt hashing with salt rounds (12)
- **Input Validation**: Comprehensive DTO validation with class-validator
- **Database Integration**: TypeORM with PostgreSQL
- **Protected Routes**: JWT guards for securing endpoints
- **User Management**: CRUD operations for user accounts

## API Endpoints

### Authentication Endpoints

#### POST `/auth/signup`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true,
  "lastLoginAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "accessToken": "jwt-token",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

#### POST `/auth/signin`
Authenticate an existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** Same as signup response

#### POST `/auth/refresh`
Refresh JWT token (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "accessToken": "new-jwt-token",
  "expiresIn": 3600
}
```

#### GET `/auth/profile`
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true,
  "lastLoginAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

### JWT Configuration
- Secret key from environment variables
- 1-hour token expiration
- Bearer token authentication

### Database Security
- Passwords hashed with bcrypt (12 salt rounds)
- User data validation
- Unique email constraints
- Soft user deactivation

## Environment Variables

Create a `.env` file based on `env.example`:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/esim_db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random

# Application Configuration
NODE_ENV=development
PORT=3000
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Examples

### Using the Authentication Guard

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Controller('protected')
export class ProtectedController {
  @Get()
  @UseGuards(JwtAuthGuard)
  getProtectedData(@Request() req: AuthRequest) {
    // req.user contains the authenticated user
    return { message: 'This is protected data', user: req.user };
  }
}
```

### Error Handling

The system provides comprehensive error handling:

- **400 Bad Request**: Invalid input data or validation errors
- **401 Unauthorized**: Invalid credentials or expired tokens
- **409 Conflict**: User already exists during signup
- **404 Not Found**: User not found

## Testing the API

### Using curl

```bash
# Sign up
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Sign in
curl -X POST http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'

# Get profile (replace TOKEN with actual JWT)
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer TOKEN"
```

## Development

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Set up environment variables:
   ```bash
   cp env.example .env
   # Edit .env with your database and JWT secret
   ```

3. Start the development server:
   ```bash
   yarn start:dev
   ```

4. The API will be available at `http://localhost:3000`

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **JWT Secret**: Use a strong, random secret key
3. **Password Hashing**: Passwords are automatically hashed with bcrypt
4. **Input Validation**: All inputs are validated and sanitized
5. **HTTPS**: Use HTTPS in production
6. **Token Expiration**: Tokens expire after 1 hour for security
7. **Rate Limiting**: Consider implementing rate limiting for auth endpoints
