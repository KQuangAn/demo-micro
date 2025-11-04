# DTOs Reorganization - Presentation Layer ✅

## Changes Made

Successfully extracted Request DTOs from controller to dedicated `dtos` folder following Clean Architecture principles.

---

## New File Structure

```
src/inventory/
  ├── dtos/                                      # ✅ NEW - Presentation Layer DTOs
  │   ├── create-inventory-item.request.dto.ts  # HTTP Request DTO
  │   ├── reserve-inventory.request.dto.ts      # HTTP Request DTO
  │   └── index.ts                              # Barrel export
  │
  ├── controllers/
  │   └── inventory.controller.ts               # ✅ UPDATED - Now imports from dtos/
  │
  └── inventory.module.ts
```

---

## Files Created

### 1. **create-inventory-item.request.dto.ts** ✅

```typescript
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsNumber,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class CreateInventoryItemRequest {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  images: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  categories: string[];

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;
}
```

**Features Added:**

- ✅ `class-validator` decorators for automatic validation
- ✅ `@IsNotEmpty()` - Ensures required fields aren't empty
- ✅ `@Min(0)` - Validates positive numbers
- ✅ `@ArrayMinSize(1)` - Ensures arrays aren't empty
- ✅ `@IsString({ each: true })` - Validates each array element

---

### 2. **reserve-inventory.request.dto.ts** ✅

```typescript
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReserveInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  currency: string;
}

export class ReserveInventoryRequest {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveInventoryItemDto)
  @ArrayMinSize(1)
  items: ReserveInventoryItemDto[];
}
```

**Features Added:**

- ✅ Nested DTO validation with `@ValidateNested()`
- ✅ `@Type()` transformer for nested object validation
- ✅ Matches `ReserveInventoryCommand` structure (productId, quantity, currency)
- ✅ Array validation with minimum 1 item

---

### 3. **index.ts** (Barrel Export) ✅

```typescript
export { CreateInventoryItemRequest } from './create-inventory-item.request.dto';
export { ReserveInventoryRequest } from './reserve-inventory.request.dto';
```

**Purpose:** Clean imports in controller

---

## Files Updated

### **inventory.controller.ts** ✅

**Before:**

```typescript
// DTOs defined inline in controller
class CreateInventoryItemRequest {
  title: string;
  brand: string;
  // ... no validation
}

class ReserveInventoryRequest {
  userId: string;
  items: Array<{ itemId: string; quantity: number }>;
}
```

**After:**

```typescript
import { CreateInventoryItemRequest, ReserveInventoryRequest } from '../dtos';

@Controller('inventory')
export class InventoryController {
  // Now uses validated DTOs from dtos/ folder
}
```

---

## Benefits of This Approach

### 1. **Automatic Validation** ✅

NestJS will automatically validate incoming requests:

```typescript
// ❌ Invalid Request
POST /inventory
{
  "title": "",           // ❌ Fails @IsNotEmpty()
  "quantity": -5,        // ❌ Fails @Min(0)
  "images": []           // ❌ Fails @ArrayMinSize(1)
}

// Returns 400 Bad Request with validation errors
```

### 2. **Better Organization** ✅

```
✅ Presentation DTOs → src/inventory/dtos/
✅ Application DTOs → application/dtos/
✅ Commands → application/commands/
✅ Queries → application/queries/
✅ Domain Entities → domain/entities/
```

### 3. **Reusability** ✅

```typescript
// Can be reused in multiple controllers
import { CreateInventoryItemRequest } from '../dtos';

// Can be used in tests
import { CreateInventoryItemRequest } from '@/inventory/dtos';
```

### 4. **Type Safety** ✅

```typescript
// TypeScript ensures the shape matches
const command = new ReserveInventoryCommand(
  request.userId,
  request.items, // ✅ Matches { productId, quantity, currency }[]
);
```

---

## Clean Architecture Layers - Clarified

```
┌─────────────────────────────────────────────────┐
│ PRESENTATION LAYER (src/inventory/)             │
│                                                  │
│ dtos/ ✅                                         │
│   ├── *.request.dto.ts  (HTTP Requests)         │
│   └── *.response.dto.ts (HTTP Responses)        │
│                                                  │
│ controllers/ ✅                                  │
│   └── inventory.controller.ts                   │
│                                                  │
│ Purpose: HTTP/GraphQL concerns                  │
└────────────────┬────────────────────────────────┘
                 │ converts to
┌────────────────▼────────────────────────────────┐
│ APPLICATION LAYER (application/)                │
│                                                  │
│ commands/ ✅                                     │
│   └── *.command.ts (CQRS Commands)              │
│                                                  │
│ queries/ ✅                                      │
│   └── *.query.ts (CQRS Queries)                 │
│                                                  │
│ dtos/ ✅                                         │
│   └── *.dto.ts (Use Case Responses)             │
│                                                  │
│ use-cases/ ✅                                    │
│   └── *.use-case.ts (Business Orchestration)    │
│                                                  │
│ Purpose: Business use case orchestration        │
└────────────────┬────────────────────────────────┘
                 │ uses
┌────────────────▼────────────────────────────────┐
│ DOMAIN LAYER (domain/)                          │
│                                                  │
│ entities/ ✅                                     │
│   └── *.entity.ts (Rich Domain Entities)        │
│                                                  │
│ value-objects/ ✅                                │
│   └── *.vo.ts (Immutable Value Objects)         │
│                                                  │
│ events/ ✅                                       │
│   └── *.events.ts (Domain Events)               │
│                                                  │
│ repositories/ ✅                                 │
│   └── *.repository.interface.ts (Ports)         │
│                                                  │
│ ❌ NO DTOs HERE! Domain is pure business logic  │
│                                                  │
│ Purpose: Core business rules and logic          │
└─────────────────────────────────────────────────┘
```

---

## Validation Example

With the new DTOs, NestJS automatically validates:

### **Request:**

```json
POST /inventory
{
  "title": "MacBook Pro",
  "brand": "Apple",
  "description": "14-inch M3 Pro",
  "images": ["img1.jpg", "img2.jpg"],
  "categories": ["laptops", "electronics"],
  "quantity": 50,
  "price": 1999.99,
  "currencyCode": "USD"
}
```

### **Validation Happens Automatically:**

```typescript
@Post()
async createInventoryItem(
  @Body() request: CreateInventoryItemRequest,  // ✅ Validated here!
): Promise<InventoryItemDto> {
  // If we reach here, data is guaranteed to be valid
  const command = new CreateInventoryItemCommand(...);
  return await this.createInventoryItemUseCase.execute(command);
}
```

---

## Enable Validation in NestJS

Make sure you have validation enabled in `main.ts`:

```typescript
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error on extra properties
      transform: true, // Auto-transform to DTO class instance
    }),
  );

  await app.listen(3000);
}
```

---

## Testing DTOs

```typescript
// test/inventory/dtos/create-inventory-item.dto.spec.ts
import { validate } from 'class-validator';
import { CreateInventoryItemRequest } from '@/inventory/dtos';

describe('CreateInventoryItemRequest', () => {
  it('should validate a valid request', async () => {
    const dto = new CreateInventoryItemRequest();
    dto.title = 'MacBook Pro';
    dto.brand = 'Apple';
    // ... set all required fields

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail with empty title', async () => {
    const dto = new CreateInventoryItemRequest();
    dto.title = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('title');
  });
});
```

---

## Summary

✅ **Extracted DTOs** from controller to `src/inventory/dtos/`  
✅ **Added validation decorators** using class-validator  
✅ **Fixed type mismatch** between request and command (productId, currency)  
✅ **Clean Architecture maintained** - DTOs stay in presentation layer  
✅ **Better organization** - Reusable, testable, validated DTOs  
✅ **Automatic validation** - NestJS validates all incoming requests

---

## Next Steps (Optional)

1. **Add Swagger/OpenAPI decorators:**

   ```typescript
   import { ApiProperty } from '@nestjs/swagger';

   export class CreateInventoryItemRequest {
     @ApiProperty({ example: 'MacBook Pro' })
     @IsString()
     title: string;
   }
   ```

2. **Add response DTOs:**

   ```typescript
   // src/inventory/dtos/inventory-item.response.dto.ts
   export class InventoryItemResponse {
     // Transform application DTO to HTTP response
   }
   ```

3. **Add custom validators:**

   ```typescript
   import { registerDecorator } from 'class-validator';

   export function IsCurrencyCode() {
     return function (object: Object, propertyName: string) {
       registerDecorator({
         name: 'isCurrencyCode',
         target: object.constructor,
         propertyName: propertyName,
         validator: {
           validate(value: any) {
             return /^[A-Z]{3}$/.test(value); // ISO 4217
           },
         },
       });
     };
   }
   ```

---

All DTOs are now properly organized! 🎉
