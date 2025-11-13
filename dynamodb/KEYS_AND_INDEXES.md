# DynamoDB Keys and Indexes Explained

partitions : parts of data in the same table
shards : parts of data across multiple db

Partition Key (Hash Key)
Purpose: Distributes data across partitions using a hash function
When to use: Always required - it's your primary identifier
Best practice: Choose high-cardinality attributes (many unique values) for even distribution
Example: user_id, email, order_id

📊 Sort Key (Range Key)
Purpose: Enables range queries and sorts items within a partition
When to use: When you need to query ranges or sort data
Enables: BETWEEN, >, <, BEGINS_WITH queries
Example: timestamp, date, version_number

🔍 LSI (Local Secondary Index)
Purpose: Alternative sort key for the SAME partition key
Key feature: Must share partition key with base table
Limitation: Must be created at table creation time (cannot add later!)
Max: 5 LSIs per table
When to use: Need multiple sort orders for same partition
Example: Sort user activities by timestamp OR by last_login

🌐 GSI (Global Secondary Index)
Purpose: Completely different partition/sort keys
Key feature: Can query by any attribute
Flexibility: Can be added/removed anytime
Max: 20 GSIs per table
When to use: Need to query by different attributes
Example: Query users by email instead of user_id 2. main.go - Practical Demo

## 🔑 Primary Keys

### Partition Key (Hash Key)

**What it is:**

- The primary identifier for items in your table
- DynamoDB uses it to distribute data across partitions
- Required for every table

**How it works:**

- DynamoDB applies a hash function to the partition key
- Result determines which physical partition stores the item
- Items with same partition key are stored together

**Use cases:**

```
Users Table: user_id as partition key
Orders Table: order_id as partition key
Products Table: product_id as partition key
```

**Best practices:**

- Choose high-cardinality attributes (many unique values)
- Ensure even distribution of access patterns
- Avoid "hot partitions" (one key accessed much more than others)

**Example:**

```go
// Bad: Many users might have the same country
PartitionKey: "country" // USA, USA, USA... (hot partition!)

// Good: Each user has unique ID
PartitionKey: "user_id" // user_001, user_002, user_003...
```

---

### Sort Key (Range Key)

**What it is:**

- Optional second part of the primary key
- Allows multiple items with same partition key
- Items are sorted by this key within a partition

**How it works:**

- Combined with partition key to create composite primary key
- Enables range queries (between, begins_with, etc.)
- Items with same partition key are sorted by sort key

**Use cases:**

```
User Activity: partition=user_id, sort=timestamp
Blog Posts: partition=author_id, sort=post_date
Order Items: partition=order_id, sort=item_id
Hierarchical Data: partition=folder, sort=file_path
```

**Query capabilities:**

```go
// Without sort key: Can only get exact item
GetItem(partition_key = "user_001")

// With sort key: Can query ranges
Query(partition_key = "user_001", sort_key BETWEEN time1 AND time2)
Query(partition_key = "user_001", sort_key BEGINS_WITH "2024-")
Query(partition_key = "user_001", sort_key > yesterday)
```

**Example:**

```go
// User's activity log
Item 1: {user_id: "user_001", timestamp: 1609459200, action: "login"}
Item 2: {user_id: "user_001", timestamp: 1609459300, action: "view"}
Item 3: {user_id: "user_001", timestamp: 1609459400, action: "logout"}

// Query: Get all actions by user_001 today
Query(user_id = "user_001" AND timestamp BETWEEN start_of_day AND end_of_day)
```

---

## 📊 Indexes

### LSI (Local Secondary Index)

**What it is:**

- Alternate sort key for the SAME partition key
- "Local" because it shares the partition key with base table
- Must be created when table is created (cannot add later!)

**Structure:**

```
Base Table:    partition_key + sort_key
LSI:          partition_key + alternate_sort_key
```

**Characteristics:**

- ✅ Shares partition key with base table
- ✅ Up to 5 LSIs per table
- ✅ Strongly consistent reads available
- ✅ No extra cost (uses table's capacity)
- ❌ Cannot be added after table creation
- ❌ Limited to 10 GB per partition key value

**Use case example:**

```
Base Table: Users
- Partition Key: user_id
- Sort Key: timestamp
- Attributes: name, email, status, last_login

LSI 1: Sort by last_login instead of timestamp
- Partition Key: user_id (same!)
- Sort Key: last_login (different!)

Query: "Get all activities for user_001 sorted by last_login time"
```

**When to use LSI:**

- Need multiple query patterns on same partition
- Need different sort orders for same partition
- Need strong consistency
- Data per partition < 10 GB

---

### GSI (Global Secondary Index)

**What it is:**

- Completely independent index with its own partition and sort keys
- "Global" because it spans all partitions
- Can be added/removed anytime

**Structure:**

```
Base Table:    partition_key_1 + sort_key_1
GSI:          partition_key_2 + sort_key_2 (completely different!)
```

**Characteristics:**

- ✅ Can use any attributes as keys
- ✅ Up to 20 GSIs per table
- ✅ Can be added/removed after table creation
- ✅ Independent capacity settings
- ❌ Eventually consistent reads only (by default)
- ❌ Separate cost for storage and throughput
- ❌ Can only project specific attributes

**Use case example:**

```
Base Table: Users
- Partition Key: user_id
- Sort Key: created_at
- Attributes: email, status, country

GSI 1: Query by email
- Partition Key: email
- Sort Key: (none or created_at)

GSI 2: Query by country and status
- Partition Key: country
- Sort Key: status

Query 1: "Find user by email"
Query 2: "Get all active users in USA"
```

**When to use GSI:**

- Need to query by different attributes
- Access patterns don't fit primary key
- Need flexibility to add indexes later
- Different partitioning strategy needed

---

## 🆚 LSI vs GSI Comparison

| Feature            | LSI                    | GSI              |
| ------------------ | ---------------------- | ---------------- |
| **Partition Key**  | Same as table          | Can be different |
| **Sort Key**       | Must be different      | Can be different |
| **When to Create** | Only at table creation | Anytime          |
| **Consistency**    | Strong or eventual     | Eventual only    |
| **Limit**          | 5 per table            | 20 per table     |
| **Capacity**       | Shares with table      | Independent      |
| **Cost**           | Included in table      | Separate charges |
| **Size Limit**     | 10 GB per partition    | No limit         |

---

## 📝 Real-World Examples

### Example 1: E-commerce Orders

**Base Table:**

```
Partition Key: customer_id
Sort Key: order_date
Attributes: order_id, total, status, delivery_date
```

**LSI - Sort by delivery date:**

```
Partition Key: customer_id (same)
Sort Key: delivery_date (different)
Use: "Show my orders by expected delivery"
```

**GSI 1 - Query by order_id:**

```
Partition Key: order_id
Sort Key: (none)
Use: "Look up specific order"
```

**GSI 2 - Query by status:**

```
Partition Key: status
Sort Key: order_date
Use: "Show all pending orders"
```

### Example 2: Social Media Posts

**Base Table:**

```
Partition Key: user_id
Sort Key: post_timestamp
Attributes: post_id, content, likes, category
```

**LSI - Sort by likes:**

```
Partition Key: user_id (same)
Sort Key: likes (different)
Use: "Show user's most popular posts"
```

**GSI 1 - Query by post_id:**

```
Partition Key: post_id
Sort Key: (none)
Use: "Get specific post details"
```

**GSI 2 - Query by category:**

```
Partition Key: category
Sort Key: post_timestamp
Use: "Show recent posts in 'technology' category"
```

---

## 💡 Design Tips

### Choosing Partition Key

1. **High Cardinality**: Many unique values
2. **Even Distribution**: Avoid hot partitions
3. **Access Pattern**: Match your most common queries

```go
// Bad Examples:
- country (only ~200 values, uneven distribution)
- status (only "active"/"inactive")
- gender (only 2-3 values)

// Good Examples:
- user_id (unique per user)
- email (unique per user)
- UUID (guaranteed unique)
- composite: "country#user_id"
```

### Choosing Sort Key

1. **Enables Range Queries**: timestamps, dates, version numbers
2. **Hierarchical Data**: file paths, categories
3. **Query Patterns**: What ranges do you need?

```go
// Good Sort Key Examples:
- timestamp (query by time ranges)
- version_number (get latest version)
- category#subcategory (hierarchical queries)
- price (query by price range)
```

### When to Use LSI

- ✅ Need strong consistency
- ✅ Data per partition < 10 GB
- ✅ Know requirements at table creation
- ✅ Multiple sort orders on same partition

### When to Use GSI

- ✅ Need flexible query patterns
- ✅ Different partition key needed
- ✅ May add indexes later
- ✅ Large datasets (> 10 GB per partition)

---

## 🚀 Query Performance

### Without Indexes (Table Scan)

```go
// Scans entire table - SLOW! ❌
Scan(FilterExpression: "email = 'john@example.com'")
// Cost: Reads all items, returns matching ones
```

### With Primary Key

```go
// Direct lookup - FAST! ✅
GetItem(partition_key = "user_001")
// Cost: Reads only 1 item

// Range query - FAST! ✅
Query(partition_key = "user_001", timestamp BETWEEN x AND y)
// Cost: Reads only matching items in partition
```

### With GSI

```go
// Query GSI - FAST! ✅
Query GSI(email = "john@example.com")
// Cost: Reads only matching items from index
```

---

## 🎯 Common Patterns

### Pattern 1: Single Table Design

Use composite keys and GSIs to store multiple entity types:

```
PK: "USER#123"           SK: "PROFILE"
PK: "USER#123"           SK: "ORDER#2024-01-01"
PK: "USER#123"           SK: "ORDER#2024-01-02"
PK: "PRODUCT#456"        SK: "DETAILS"
```

### Pattern 2: Time-Series Data

```
PK: device_id            SK: timestamp
LSI: device_id           SK: battery_level
GSI: location            SK: timestamp
```

### Pattern 3: Many-to-Many Relationships

```
PK: "STUDENT#123"        SK: "COURSE#456"
GSI1 PK: "COURSE#456"    SK: "STUDENT#123"
```

---

## 📚 Summary

| Component         | Purpose                        | When to Use                                 |
| ----------------- | ------------------------------ | ------------------------------------------- |
| **Partition Key** | Distribute data                | Always required                             |
| **Sort Key**      | Range queries, sorting         | When you need ranges/sorting                |
| **LSI**           | Alternate sort, same partition | Multiple sort orders, strong consistency    |
| **GSI**           | Query different attributes     | Flexible queries, different access patterns |

**Key Takeaway:** Design your keys and indexes based on your **access patterns**, not just your data structure!

---

Happy querying! 🚀
