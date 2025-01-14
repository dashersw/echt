# echt

Lightweight, type-safe request validation middleware for Express using [Zod](https://github.com/colinhacks/zod).

## Features

- 🎯 **Type-safe**: Full TypeScript support with automatic type inference
- 🔍 **Complete request validation**: Validate request body, headers, and query parameters
- 🪶 **Lightweight**: Zero dependencies beyond Express and Zod
- 💪 **Robust error handling**: Automatic error responses for invalid requests
- 🚀 **Easy to use**: Simple, declarative API

## Installation

```bash
npm install echt
# or
yarn add echt
# or
pnpm add echt
```

Note: `express` and `zod` are peer dependencies and must be installed separately.

## Usage

Here's a basic example of how to use echt:

```typescript
import express from 'express'
import { z } from 'zod'
import { validate } from 'echt'

const app = express()
app.use(express.json())

const userSchema = {
  body: z.object({
    username: z.string().min(3),
    email: z.string().email(),
    age: z.number().min(18)
  }),
  headers: z.object({
    'api-key': z.string()
  }),
  query: z.object({
    include: z.string().optional()
  })
}

const blogPostSchema = {
  params: z.object({
    year: z.string().regex(/^\d{4}$/),
    month: z.string().regex(/^(0?[1-9]|1[0-2])$/),
    day: z.string().regex(/^(0?[1-9]|[12]\d|3[01])$/),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })
}

app.post('/users', validate(userSchema), (req, res) => {
  // Types are automatically inferred
  const { username, email, age } = req.body
  res.json({ username, email, age })
})

app.get('/blog/:year/:month/:day/:slug', validate(blogPostSchema), (req, res) => {
  const { year, month, day, slug } = req.params
  res.json({ year, month, day, slug })
})
```

### Validation

The `validate` middleware supports validation for:

- Request body (`body`)
- Request headers (`headers`)
- Query parameters (`query`)

If validation fails, it automatically returns a 400 response with detailed error information:

```json
{
  "errors": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["email"],
      "message": "Required"
    }
  ]
}
```

### Type Safety

echt automatically infers types from your Zod schemas, providing full type safety in your request handlers:

```typescript
// Types are inferred from the schema
const userSchema = {
  body: z.object({
    username: z.string()
  })
}

app.post('/users', validate(userSchema), (req, res) => {
  // req.body is typed as { username: string }
  const { username } = req.body
})
```

## License

MIT
