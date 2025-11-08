# Inquiry Service - Quick Start Guide

## 🚀 Quick Start

### 1. Install Dependencies
The required dependencies have already been added to `package.json`. Install them:

```bash
yarn install
```

### 2. Configure Environment
Add your eSIM access code to the `.env` file:

```bash
# Copy the example if you haven't already
cp env.example .env

# Edit .env and add your access code:
ESIM_ACCESS_CODE=your-actual-esim-access-code
```

### 3. Start the Application
```bash
# Development mode with hot reload
yarn start:dev

# Production mode
yarn build
yarn start:prod
```

### 4. Test the Endpoints

#### Get All Data Packages
```bash
curl http://localhost:3000/inquiry/packages
```

#### Get Packages for a Specific Country
```bash
curl "http://localhost:3000/inquiry/packages/country?countryCode=US"
```

#### Try Different Countries
```bash
curl "http://localhost:3000/inquiry/packages/country?countryCode=GB"
curl "http://localhost:3000/inquiry/packages/country?countryCode=JP"
```

### 5. Check Swagger Documentation
Open your browser and navigate to:
```
http://localhost:3000/api
```

The Inquiry endpoints will be listed under the "inquiry" tag.

## 📋 API Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": [
    {
      "id": "pkg_001",
      "name": "1GB Daily Pass",
      "dataAmount": "1GB",
      "price": 4.99,
      "validity": "24 hours"
    }
  ],
  "message": "Data packages retrieved successfully"
}
```

## ⚠️ Error Responses

Missing country code:
```bash
curl "http://localhost:3000/inquiry/packages/country"
# Response: 400 Bad Request
```

API Key not configured:
```bash
curl http://localhost:3000/inquiry/packages
# Response: 500 Internal Server Error (check logs for "ESIM_ACCESS_CODE is undefined")
```

## 🔍 Check Logs

Monitor the application logs for debugging:

```bash
# Watch for info logs
grep "InquiryPackagesService" logs/app.log

# Check errors
grep "ERROR\|Failed to fetch" logs/app.log
```

## 📚 Detailed Documentation

For more detailed information, see:
- `src/inquiry/INQUIRY_README.md` - Complete module documentation
- `INQUIRY_INTEGRATION_SUMMARY.md` - Implementation details
- `env.example` - Environment variables reference

## 🧪 Testing

### Unit Test Example
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { InquiryPackagesService } from './inquiry.packages.service';

describe('InquiryPackagesService', () => {
  let service: InquiryPackagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InquiryPackagesService],
    }).compile();

    service = module.get<InquiryPackagesService>(InquiryPackagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## 🚨 Troubleshooting

### Problem: "Cannot find module '@nestjs/axios'"
**Solution:**
```bash
yarn install
```

### Problem: "ESIM_API_KEY is undefined"
**Solution:** Add to `.env`:
```env
ESIM_ACCESS_CODE=your-access-code-here
```

### Problem: "Connection refused"
**Solution:** Verify:
1. External API is accessible: `curl https://docs.esimaccess.com`
2. Network connectivity is working
3. API endpoint is correct

### Problem: "Request timeout"
**Solution:** 
- The service has a 10-second timeout
- Check if external API is responding slowly
- Verify network latency

## 📝 Next Steps

1. ✅ Install dependencies (`yarn install`)
2. ✅ Configure API key in `.env`
3. ✅ Start the application (`yarn start:dev`)
4. ✅ Test the endpoints (using curl commands above)
5. ✅ Integrate with your frontend
6. 📋 Implement caching for better performance
7. 🔐 Add rate limiting in production

## 💡 Usage Example

### In Your Service
```typescript
import { Injectable } from '@nestjs/common';
import { InquiryPackagesService } from './inquiry/services/inquiry.packages.service';

@Injectable()
export class MyService {
  constructor(private inquiryService: InquiryPackagesService) {}

  async getAvailablePackages() {
    return await this.inquiryService.getAllDataPackages();
  }

  async getPackagesForCountry(code: string) {
    return await this.inquiryService.getDataPackagesByCountry(code);
  }
}
```

### In Your Controller
```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { MyService } from './my.service';

@Controller('my-endpoint')
export class MyController {
  constructor(private myService: MyService) {}

  @Get('packages')
  async getPackages() {
    return this.myService.getAvailablePackages();
  }

  @Get('packages-by-country')
  async getPackagesByCountry(@Query('code') code: string) {
    return this.myService.getPackagesForCountry(code);
  }
}
```

## 📞 Support

For questions or issues:
1. Check the detailed documentation in `src/inquiry/INQUIRY_README.md`
2. Review application logs for error messages
3. Verify API configuration and connectivity
4. Check the eSIM Access API documentation

## ✅ Checklist

- [ ] Dependencies installed (`yarn install`)
- [ ] `.env` file created with `ESIM_ACCESS_CODE`
- [ ] Application builds successfully (`yarn build`)
- [ ] Application starts without errors (`yarn start:dev`)
- [ ] `/inquiry/packages` endpoint responds
- [ ] `/inquiry/packages/country?countryCode=US` endpoint responds
- [ ] Swagger documentation loads (`http://localhost:3000/api`)
- [ ] Ready to integrate with frontend

That's it! You're ready to use the Inquiry Service. 🎉
