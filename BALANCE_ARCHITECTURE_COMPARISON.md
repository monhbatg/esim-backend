# Balance Architecture: User Table vs Separate Wallet Table

## Comparison

### Option 1: Balance in User Table (Current Implementation) ❌

**Pros:**
- ✅ Simple and fast queries (no joins)
- ✅ Atomic updates
- ✅ Less database overhead
- ✅ Good for simple use cases

**Cons:**
- ❌ **No transaction history** - Can't track how balance changed
- ❌ **No audit trail** - Can't see who/what changed balance
- ❌ **Hard to debug** - If balance is wrong, no way to trace it
- ❌ **Limited scalability** - Can't support multiple wallets/currencies
- ❌ **No compliance** - Financial systems need audit trails
- ❌ **Race conditions** - Harder to handle concurrent updates safely
- ❌ **No metadata** - Can't track when balance was last updated, by whom, etc.

### Option 2: Separate Wallet Table (Recommended) ✅

**Pros:**
- ✅ **Transaction history** - Full audit trail of all balance changes
- ✅ **Better separation of concerns** - User data vs financial data
- ✅ **Scalability** - Can support multiple wallets per user, multiple currencies
- ✅ **Audit compliance** - Required for financial systems
- ✅ **Easier debugging** - Can trace every balance change
- ✅ **Metadata support** - Track last updated, version, etc.
- ✅ **Better for TransactionModule** - Natural integration point
- ✅ **Optimistic locking** - Prevent race conditions with version field
- ✅ **Future-proof** - Easy to add features like wallet limits, frozen balances, etc.

**Cons:**
- ❌ Slightly more complex queries (one join)
- ❌ One extra table to manage
- ❌ Slightly more database overhead (minimal with proper indexing)

## Recommendation: **Separate Wallet Table** 🎯

For a financial system dealing with eSIM purchases, **Option 2 is strongly recommended** because:

1. **Financial Compliance**: You need audit trails for money transactions
2. **TransactionModule Integration**: Natural fit for transaction history
3. **Debugging**: When a user reports wrong balance, you can trace it
4. **Scalability**: Can easily add features like multiple currencies, wallet limits
5. **Industry Standard**: Most financial systems use separate wallet/account tables

## Performance Note

The performance difference is **negligible**:
- Join on indexed `user_id` is extremely fast
- You can cache balance in memory if needed
- The benefits far outweigh the minimal overhead

## Implementation Strategy

1. Create `Wallet` entity with one-to-one relationship to User
2. Keep balance in Wallet table
3. Create `Transaction` entity for history (future)
4. Use optimistic locking to prevent race conditions
5. Add indexes on `user_id` for fast lookups

