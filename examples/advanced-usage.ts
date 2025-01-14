import express from 'express'
import { z } from 'zod'
import { validate } from '../src'

// Example usage
const app = express()
app.use(express.json())

const userSchema = {
  body: z.object({
    username: z.string().min(3),
    email: z.string().email(),
    age: z.number().min(18)
  }),
  headers: z.object({
    'api-key': z.number()
  }),
  query: z.object({
    include: z.string().optional()
  }),
  params: z.object({
    username: z.string().optional()
  }),
  useResponse: {
    201: z.object({
      id: z.number(),
      message: z.string()
    }),
    204: z.never(),
    400: z.object({
      errors: z.array(
        z.object({
          field: z.string(),
          message: z.string(),
          code: z.string()
        })
      )
    }),
    401: z.object({
      message: z.string(),
      code: z.literal('UNAUTHORIZED')
    }),
    403: z.object({
      message: z.string(),
      code: z.literal('FORBIDDEN')
    }),
    404: z.object({
      message: z.string(),
      code: z.literal('NOT_FOUND')
    }),
    409: z.object({
      message: z.string(),
      code: z.literal('CONFLICT'),
      conflictingField: z.string()
    }),
    422: z.object({
      errors: z.array(
        z.object({
          field: z.string(),
          message: z.string(),
          validation: z.string()
        })
      )
    }),
    429: z.object({
      message: z.string(),
      retryAfter: z.number(),
      code: z.literal('RATE_LIMIT_EXCEEDED')
    }),
    500: z.object({
      message: z.string(),
      code: z.literal('INTERNAL_SERVER_ERROR'),
      requestId: z.string()
    })
  },
  locals: z.object({
    firtina: z.string().optional()
  })
}

app.post(
  '/users/:username',
  validate(userSchema).use((req, res) => {
    const { username } = req.body

    // Example responses for different scenarios:
    if (!username) {
      return res.status(400).json({
        errors: [
          {
            field: 'username',
            message: 'Username is required',
            code: 'FIELD_REQUIRED'
          }
        ]
      })
    }

    if (username === 'admin') {
      return res.status(403).json({
        message: 'Cannot create user with reserved username',
        code: 'FORBIDDEN'
      })
    }

    // Example email check
    if (req.body.email === 'exists@example.com') {
      return res.status(409).json({
        message: 'User with this email already exists',
        code: 'CONFLICT',
        conflictingField: 'email'
      })
    }

    try {
      // Simulating successful user creation
      return res.status(201).json({
        id: 123,
        message: 'User created successfully'
      })
    } catch {
      // Example internal server error response
      return res.status(500).json({
        message: 'Failed to create user',
        code: 'INTERNAL_SERVER_ERROR',
        requestId: 'req_123abc'
      })
    }
  })
)

// Example of a rate-limited endpoint
app.get(
  '/users',
  validate({
    useResponse: {
      200: z.object({
        data: z.array(
          z.object({
            id: z.number(),
            username: z.string()
          })
        ),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number()
        })
      }),
      429: z.object({
        message: z.string(),
        retryAfter: z.number(),
        code: z.literal('RATE_LIMIT_EXCEEDED')
      })
    }
  }).use((_req, res) => {
    const isRateLimited = Math.random() > 0.8

    if (isRateLimited) {
      return res.status(429).json({
        message: 'Too many requests',
        retryAfter: 60,
        code: 'RATE_LIMIT_EXCEEDED'
      })
    }

    return res.status(200).json({
      data: [
        { id: 1, username: 'user1' },
        { id: 2, username: 'user2' }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2
      }
    })
  })
)

export default app
