# Fix Foreign Key Constraint Error

## The Problem
The foreign key constraint `FK_7d2ec0657c352c127a7196bfe4a` still exists in your database even though we removed it from the TypeORM entity. This constraint is causing insert failures.

## Solution: Drop the Constraint

Run this SQL command on your database:

```sql
ALTER TABLE esim_purchases 
DROP CONSTRAINT IF EXISTS "FK_7d2ec0657c352c127a7196bfe4a";
```

## How to Run It

### Option 1: Using psql (if you have direct database access)
```bash
psql $DATABASE_URL -c 'ALTER TABLE esim_purchases DROP CONSTRAINT IF EXISTS "FK_7d2ec0657c352c127a7196bfe4a";'
```

### Option 2: Using a database GUI tool
- Connect to your database
- Open a SQL query window
- Run the SQL command above

### Option 3: Using TypeORM QueryRunner (temporary fix)
You can add this to your code temporarily to drop it on startup, then remove it after running once.

## Why This Happened
- TypeORM's `synchronize: true` only creates/updates schema, it doesn't drop existing constraints
- Removing the `@ManyToOne` decorator prevents TypeORM from creating the constraint in the future, but doesn't remove existing ones
- The constraint needs to be manually dropped from the database

## After Dropping
Once the constraint is dropped, the `invoiceId` column will still work as a reference (storing the UUID), but without the foreign key constraint enforcement. This prevents the transaction timing issues you were experiencing.

