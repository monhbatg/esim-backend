# Migration Guide: User Balance → Separate Wallet Table

## Overview

This guide helps you migrate from balance in the User table to a separate Wallet table (recommended approach).

## Why Migrate?

The separate Wallet table provides:
- ✅ Transaction history and audit trail
- ✅ Better separation of concerns
- ✅ Optimistic locking (prevents race conditions)
- ✅ Support for frozen wallets, multiple currencies
- ✅ Natural integration with TransactionModule

## Migration Steps

### Step 1: Database Migration

Create a migration to:
1. Create `wallets` table
2. Migrate existing balances from `users.balance` to `wallets.balance`
3. Remove `balance` column from `users` table (optional, can keep for backward compatibility)

```typescript
// Example migration file: migrations/XXXXXX-create-wallet-table.ts
import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class CreateWalletTable1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create wallets table
    await queryRunner.createTable(
      new Table({
        name: 'wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'balance',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'currency',
            type: 'varchar',
            default: "'USD'",
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'isFrozen',
            type: 'boolean',
            default: false,
          },
          {
            name: 'frozenReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'int',
            default: 0,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'lastTransactionAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'wallets',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    // Create index for fast lookups
    await queryRunner.query(
      'CREATE INDEX IDX_wallets_userId ON wallets(userId)',
    );

    // Migrate existing balances
    await queryRunner.query(`
      INSERT INTO wallets ("userId", balance, currency, "isActive", "createdAt", "updatedAt")
      SELECT 
        id as "userId",
        COALESCE(balance, 0) as balance,
        COALESCE("preferredCurrency", 'USD') as currency,
        true as "isActive",
        NOW() as "createdAt",
        NOW() as "updatedAt"
      FROM users
      WHERE id NOT IN (SELECT "userId" FROM wallets)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Migrate balances back to users table
    await queryRunner.query(`
      UPDATE users u
      SET balance = COALESCE(w.balance, 0)
      FROM wallets w
      WHERE u.id = w."userId"
    `);

    // Drop foreign key
    const table = await queryRunner.getTable('wallets');
    const foreignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('userId') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('wallets', foreignKey);
    }

    // Drop table
    await queryRunner.dropTable('wallets');
  }
}
```

### Step 2: Update Code

The new Wallet module is already created. You have two options:

#### Option A: Use New Wallet Module (Recommended)
- Use `/wallet/user-profile/:id/add-balance` instead of `/users/user-profile/:id/add-balance`
- Use `/wallet/user-profile/:id/balance` instead of `/users/user-profile/:id/balance`
- Update frontend to use new endpoints

#### Option B: Keep Old Endpoints (Backward Compatibility)
- Update `UsersService` to use `WalletService` internally
- Keep existing endpoints working
- Gradually migrate to new endpoints

### Step 3: Update UsersService (Optional - for backward compatibility)

If you want to keep the old endpoints working:

```typescript
// In users.service.ts
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class UsersService {
  constructor(
    // ... existing dependencies
    private readonly walletService: WalletService, // Add this
  ) {}

  async addBalance(userId: string, amount: number): Promise<User> {
    // Delegate to WalletService
    const wallet = await this.walletService.addBalance(userId, amount);
    
    // Update user entity if you're keeping balance column for backward compatibility
    // Or just return user with balance from wallet
    const user = await this.findById(userId);
    // user.balance = wallet.balance; // if keeping column
    return user;
  }

  async getBalance(userId: string): Promise<number> {
    return await this.walletService.getBalance(userId);
  }
}
```

### Step 4: Update UsersModule

```typescript
// users.module.ts
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    WalletModule, // Add this if using WalletService in UsersService
  ],
  // ...
})
export class UsersModule {}
```

## Comparison: Old vs New

### Old Implementation (Balance in User)
```typescript
// Direct update
user.balance += amount;
await userRepository.save(user);
```

### New Implementation (Separate Wallet)
```typescript
// With transaction safety and optimistic locking
const wallet = await walletService.addBalance(userId, amount);
// Automatically handles:
// - Race conditions (optimistic locking)
// - Frozen wallets
// - Transaction history (when TransactionModule is added)
```

## Benefits of New Approach

1. **Race Condition Prevention**: Optimistic locking with `version` column
2. **Audit Trail**: Ready for TransactionModule integration
3. **Frozen Wallets**: Can freeze/unfreeze wallets for disputes
4. **Multiple Currencies**: Easy to support multiple wallets per user
5. **Better Error Handling**: More specific error messages
6. **Transaction Safety**: Uses database transactions

## Performance

The performance impact is **negligible**:
- Join on indexed `userId` is extremely fast (< 1ms)
- You can add caching if needed
- Benefits far outweigh minimal overhead

## Testing

Test the migration:
1. Create test users with balances
2. Run migration
3. Verify balances are preserved
4. Test add/deduct balance operations
5. Test concurrent updates (race conditions)

## Rollback Plan

The migration includes a `down()` method to rollback:
- Balances are migrated back to `users.balance`
- `wallets` table is dropped
- System returns to previous state

## Next Steps

After migration:
1. ✅ Test all wallet operations
2. ✅ Update API documentation
3. ✅ Implement TransactionModule for full audit trail
4. ✅ Add wallet freeze/unfreeze admin endpoints
5. ✅ Consider removing `balance` column from `users` table (after full migration)

