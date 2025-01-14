# echt

[![npm version](https://badge.fury.io/js/echt.svg)](https://badge.fury.io/js/echt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Lightweight, type-safe request and response validation middleware for Express using [Zod](https://github.com/colinhacks/zod).

## Why echt?

- 🎯 **True Type Safety**: Full TypeScript support with automatic type inference
- 🔍 **Complete Validation**: Validate request body, headers, query parameters, URL parameters, and responses
- 🪶 **Lightweight**: Zero dependencies beyond Express and Zod
- 🚀 **Zero Config**: Works out of the box with TypeScript and Express
- 💪 **Robust Error Handling**: Automatic error responses for invalid requests

Unlike other validation libraries, echt provides complete end-to-end type safety and built-in response validation while leveraging the full power of Zod's schema validation.

## Installation

```bash
npm install echt
# or
yarn add echt
# or
pnpm add echt
```

Note: `express` and `zod` are peer dependencies and must be installed separately.

## Quick Start

```typescript
import express from 'express'
import { validate } from 'echt'
import { z } from 'zod'

const app = express()
app.use(express.json())

// Define your schema once, get full type safety
const userSchema = {
  body: z.object({
    name: z.string(),
    age: z.number()
  }),
  response: z.object({
    id: z.string(),
    name: z.string(),
    age: z.number()
  })
}

// Validation and type inference work automatically
app.post('/users', validate(userSchema), (req, res) => {
  const { name, age } = req.body // ✅ Fully typed
  res.json({ id: '123', name, age }) // ✅ Response validated
})
```

## Validation Types

echt supports comprehensive validation for all parts of the request-response cycle:

### Request Validation

```typescript
const schema = {
  // Request body validation
  body: z.object({
    username: z.string(),
    age: z.number()
  }),

  // URL parameters (e.g., /users/:id)
  params: z.object({
    id: z.string().uuid()
  }),

  // Query string parameters (e.g., ?page=1&limit=10)
  query: z.object({
    page: z.string().transform(Number),
    limit: z.string().transform(Number)
  }),

  // HTTP headers
  headers: z.object({
    'api-key': z.string(),
    'content-type': z.string().optional()
  }),

  // Express locals (useful for middleware communication)
  locals: z.object({
    userId: z.string(),
    permissions: z.array(z.string())
  })
}

app.get('/users/:id', validate(schema), (req, res) => {
  // All properties are fully typed
  const { id } = req.params
  const { page, limit } = req.query
  const { userId } = res.locals
  // ...
})
```

### Response Validation

There are two ways to validate responses in echt: using `response` and `useResponse` schemas.

#### Simple Response Validation

The `response` schema provides basic response validation without status code differentiation:

```typescript
const schema = {
  response: z.object({
    success: z.boolean(),
    data: z.any()
  })
}

app.get('/data', validate(schema), (req, res) => {
  res.json({
    success: true,
    data: {
      /* ... */
    }
  })
})
```

#### Status-Aware Response Validation

The `useResponse` schema provides granular control over response validation based on status codes. When using `useResponse`, you must use the `.use()` wrapper instead of passing the middleware directly:

```typescript
const schema = {
  useResponse: {
    200: z.object({ data: z.array(z.string()) }),
    404: z.object({ error: z.string() }),
    500: z.object({
      message: z.string(),
      code: z.literal('INTERNAL_SERVER_ERROR'),
      requestId: z.string()
    })
  }
}

// ❌ This will throw an error
app.get('/data', validate(schema), (req, res) => {})

// ✅ This is the correct way
app.get(
  '/data',
  validate(schema).use((req, res) => {
    if (!data) {
      return res.status(404).json({ error: 'Not found' })
    }

    try {
      // your logic here
      res.json({ data: ['item1', 'item2'] })
    } catch (error) {
      res.status(500).json({
        message: 'Internal server error occurred',
        code: 'INTERNAL_SERVER_ERROR',
        requestId: generateRequestId()
      })
    }
  })
)
```

The `.use()` wrapper is required with `useResponse` because it sets up the proper type inference and validation for different status codes. Without it, the middleware won't be able to properly validate responses against their corresponding status code schemas.

When using response validation, make sure to define schemas for all possible response status codes. The middleware will throw an error if you try to send a response with an undefined status code.

## Troubleshooting

1. **TypeScript Errors with Response Validation**
   If you're seeing TypeScript errors with response validation, ensure you're using the `.use()` wrapper with `useResponse` schemas.

2. **Validation Not Working**
   Make sure you've added `express.json()` middleware before using echt.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

```
MIT License

Copyright (c) 2025 Armagan Amcalar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
