# RunnableSequence Object Keys - You Can Use ANY Keys!

## ✅ YES - You Can Use ANY Key Names!

The keys in the object you pass to `RunnableSequence.from()` are **completely arbitrary**. They're just property names that will be available in the output object.

### Your Current Code (Using "context" and "question")

```typescript
RunnableSequence.from([
  {
    context: async () => { ... },      // ✅ Any name works!
    question: () => lastUserMessage,   // ✅ Any name works!
  },
  prompt,  // Uses {context} and {question} from template
  model,
]);
```

### Example: Using Different Key Names

```typescript
RunnableSequence.from([
  {
    weatherData: async () => getWeather(),        // ✅ Custom key
    userQuery: () => lastUserMessage,              // ✅ Custom key
    timestamp: () => new Date().toISOString(),    // ✅ Custom key
    userId: () => "user123",                      // ✅ Custom key
  },
  // Output: { weatherData: "...", userQuery: "...", timestamp: "...", userId: "..." }
  prompt,  // Must use {weatherData} and {userQuery} in template
  model,
]);
```

### Example: Using Descriptive Names

```typescript
RunnableSequence.from([
  {
    retrievedDocuments: async () => searchVectorStore(),  // ✅ Descriptive
    originalQuestion: (input) => input.question,         // ✅ Descriptive
    metadata: () => ({ source: "rag", version: "1.0" }), // ✅ Descriptive
  },
  prompt,
  model,
]);
```

### Example: Using Short Names

```typescript
RunnableSequence.from([
  {
    ctx: async () => getContext(),     // ✅ Short name
    q: () => question,                  // ✅ Short name
    meta: () => metadata,               // ✅ Short name
  },
  prompt,
  model,
]);
```

---

## Important: Match Keys in Prompt Template!

The **only requirement** is that your prompt template must use the **same key names**:

### ✅ Correct - Keys Match

```typescript
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "Context: {context}\nQuestion: {question}"],
  ["human", "{question}"],
]);

RunnableSequence.from([
  {
    context: async () => "...",    // ✅ Matches {context} in prompt
    question: () => "...",          // ✅ Matches {question} in prompt
  },
  prompt,
  model,
]);
```

### ❌ Wrong - Keys Don't Match

```typescript
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "Context: {context}\nQuestion: {question}"],
]);

RunnableSequence.from([
  {
    data: async () => "...",       // ❌ Prompt expects {context}, not {data}
    query: () => "...",            // ❌ Prompt expects {question}, not {query}
  },
  prompt,  // Will fail - {context} and {question} not found!
  model,
]);
```

---

## Real-World Examples

### Example 1: Weather App

```typescript
RunnableSequence.from([
  {
    currentWeather: async () => getCurrentWeather(),
    forecast: async () => getForecast(),
    location: () => userLocation,
    units: () => "metric",
  },
  prompt,  // Uses {currentWeather}, {forecast}, {location}, {units}
  model,
]);
```

### Example 2: E-commerce

```typescript
RunnableSequence.from([
  {
    productInfo: async () => getProductDetails(),
    userHistory: async () => getUserPurchaseHistory(),
    recommendations: async () => getRecommendations(),
    cartItems: () => getCartItems(),
  },
  prompt,
  model,
]);
```

### Example 3: Multi-Source RAG

```typescript
RunnableSequence.from([
  {
    vectorStoreResults: async () => searchVectorStore(),
    databaseResults: async () => queryDatabase(),
    apiResults: async () => callExternalAPI(),
    userPreferences: () => getUserPrefs(),
  },
  prompt,
  model,
]);
```

---

## Best Practices

### 1. Use Descriptive Names

```typescript
// ✅ Good - Clear what each key contains
{
  weatherForecast: async () => getWeather(),
  userLocation: () => location,
}

// ❌ Bad - Unclear purpose
{
  w: async () => getWeather(),
  l: () => location,
}
```

### 2. Use Consistent Naming

```typescript
// ✅ Good - Consistent camelCase
{
  weatherData: async () => getWeather(),
  userQuery: () => query,
  timestamp: () => Date.now(),
}

// ❌ Bad - Inconsistent
{
  weatherData: async () => getWeather(),
  user_query: () => query,      // snake_case
  TimeStamp: () => Date.now(),   // PascalCase
}
```

### 3. Match Your Prompt Template

```typescript
// Define keys based on what your prompt needs
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "Weather: {weather}\nLocation: {location}"],
]);

RunnableSequence.from([
  {
    weather: async () => getWeather(),    // ✅ Matches {weather}
    location: () => userLocation,         // ✅ Matches {location}
  },
  prompt,
  model,
]);
```

---

## Summary

✅ **You can use ANY key names** - they're just property names  
✅ **Keys are arbitrary** - "context" and "question" are just examples  
✅ **Must match prompt template** - keys must match `{variable}` names in prompt  
✅ **Use descriptive names** - makes code more readable  
✅ **Consistent naming** - follow your project's conventions  

**The keys you choose are completely up to you!** 🎉
