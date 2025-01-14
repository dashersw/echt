import request from 'supertest'
import express from 'express'
import { validate } from '../src'
import { z } from 'zod'

describe('validate middleware', () => {
  const app = express()
  app.use(express.json())

  const schema = {
    body: z.object({
      name: z.string().min(3),
      age: z.number().min(18)
    }),
    headers: z.object({
      'api-key': z.string(),
      accept: z.string(),
      'set-cookie': z.string()
    }),
    query: z.object({
      filter: z.string().optional()
    })
  }

  const paramsSchema = {
    params: z.object({
      id: z.string().regex(/^\d+$/)
    })
  }

  const localsSchema = {
    locals: z.object({
      userId: z.string()
    })
  }

  const multiValidationSchema = {
    body: z.object({
      name: z.string().min(3),
      email: z.string().email()
    }),
    query: z.object({
      page: z.string()
    }),
    headers: z.object({
      'api-key': z.string()
    })
  }

  const emptySchema = {
    body: z.object({}).strict()
  }

  // Mock error handler middleware
  const errorHandler = jest.fn((_err, _req, res, _next) => {
    res.status(500).json({ error: 'Internal server error' })
  })

  app.post('/test', validate(schema), (req, res) => {
    res.json(req.body)
  })

  // Add error handler middleware
  app.use(errorHandler)

  beforeEach(() => {
    errorHandler.mockClear()
  })

  it('should pass validation with valid data', async () => {
    const response = await request(app)
      .post('/test')
      .set('api-key', 'test-key')
      .set('accept', 'application/json')
      .set('set-cookie', 'session=123; user=john')
      .send({
        name: 'John',
        age: 25
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      name: 'John',
      age: 25
    })
  })

  it('should fail validation with invalid body', async () => {
    const response = await request(app).post('/test').set('api-key', 'test-key').send({
      name: 'Jo',
      age: 15
    })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty('errors')
  })

  it('should fail validation with missing headers', async () => {
    const response = await request(app).post('/test').send({
      name: 'John',
      age: 25
    })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty('errors')
  })

  it('should pass non-Zod errors to next middleware', async () => {
    const appWithError = express()
    appWithError.use(express.json())

    // Create a schema that will throw a non-Zod error
    const errorSchema = {
      body: z.object({}).transform(() => {
        throw new Error('Unexpected error')
      })
    }

    appWithError.post('/error', validate(errorSchema), (req, res) => {
      res.json(req.body)
    })

    appWithError.use(errorHandler)

    const response = await request(appWithError).post('/error').send({ test: 'data' })

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toBe('Unexpected error')
  })

  it('should handle null header values', async () => {
    const appWithNullHeader = express()
    appWithNullHeader.use(express.json())

    // Middleware to inject a null header value
    appWithNullHeader.use((req, _res, next) => {
      req.headers['x-test'] = undefined
      next()
    })

    const nullHeaderSchema = {
      headers: z.object({
        'x-test': z.string().optional()
      })
    }

    appWithNullHeader.post('/null-header', validate(nullHeaderSchema), (req, res) => {
      res.json({ headers: req.headers })
    })

    const response = await request(appWithNullHeader).post('/null-header')

    expect(response.status).toBe(200)
  })

  it('should validate URL parameters', async () => {
    const paramApp = express()
    paramApp.get('/:id', validate(paramsSchema), (req, res) => {
      res.json({ id: req.params.id })
    })

    const response = await request(paramApp).get('/123')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ id: '123' })

    const invalidResponse = await request(paramApp).get('/abc')
    expect(invalidResponse.status).toBe(400)
    expect(invalidResponse.body).toHaveProperty('errors')
  })

  it('should validate res.locals', async () => {
    const localsApp = express()
    localsApp.use((req, res, next) => {
      res.locals.userId = '123'
      next()
    })

    localsApp.get('/', validate(localsSchema), (req, res) => {
      res.json({ userId: res.locals.userId })
    })

    const response = await request(localsApp).get('/')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ userId: '123' })
  })

  it('should return multiple validation errors', async () => {
    const multiApp = express()
    multiApp.use(express.json())

    multiApp.post('/multi', validate(multiValidationSchema), (req, res) => {
      res.json(req.body)
    })

    const response = await request(multiApp).post('/multi').send({
      name: 'Jo',
      email: 'invalid-email'
    })

    expect(response.status).toBe(400)
    expect(response.body.errors).toHaveLength(4)
    expect(response.body.errors.some((e: any) => e.path.includes('name'))).toBe(true)
    expect(response.body.errors.some((e: any) => e.path.includes('email'))).toBe(true)
    expect(response.body.errors.some((e: any) => e.path.includes('api-key'))).toBe(true)
    expect(response.body.errors.some((e: any) => e.path.includes('page'))).toBe(true)
  })

  it('should validate empty objects', async () => {
    const emptyApp = express()
    emptyApp.use(express.json())

    emptyApp.post('/empty', validate(emptySchema), (req, res) => {
      res.json({})
    })

    const response = await request(emptyApp).post('/empty').send({})

    expect(response.status).toBe(200)

    const invalidResponse = await request(emptyApp).post('/empty').send({ extraField: 'not allowed' })

    expect(invalidResponse.status).toBe(400)
    expect(invalidResponse.body).toHaveProperty('errors')
  })

  it('should validate response with typed responses', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        200: z.object({
          message: z.string(),
          data: z.object({ id: z.number() })
        }),
        400: z.object({
          error: z.string()
        })
      }
    }

    responseApp.post(
      '/response',
      validate(responseSchema).use((req, res) => {
        res.json({ message: 'Success', data: { id: 123 } })
      })
    )

    let response: any

    try {
      response = await request(responseApp).post('/response').send({})
    } catch (error) {}

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      message: 'Success',
      data: { id: 123 }
    })

    // Test different status code
    responseApp.post(
      '/response-400',
      validate(responseSchema).use((req, res) => {
        res.status(400).json({ error: 'Bad request' })
      })
    )

    const errorResponse = await request(responseApp).post('/response-400').send({})

    expect(errorResponse.status).toBe(400)
    expect(errorResponse.body).toEqual({
      error: 'Bad request'
    })
  })

  it('should throw error when response schema is not defined for status code', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        200: z.object({
          message: z.string()
        })
      }
    }

    responseApp.post(
      '/invalid-status',
      validate(responseSchema).use((req, res) => {
        res.status(201).json({ message: 'Created' })
      })
    )

    responseApp.use(errorHandler)

    const response = await request(responseApp).post('/invalid-status').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalled()
  })

  it('should throw error when using useResponse without .use()', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        200: z.object({
          message: z.string()
        })
      }
    }

    responseApp.post('/invalid-usage', validate(responseSchema) as any, (req, res) => {
      res.json({ message: 'Success' })
    })

    responseApp.use(errorHandler)

    const response = await request(responseApp).post('/invalid-usage').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalled()
  })

  it('should validate response with res.send()', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        200: z.object({
          message: z.string()
        })
      }
    }

    responseApp.post(
      '/send',
      validate(responseSchema).use((req, res) => {
        res.send({ message: 'Success' })
      })
    )

    const response = await request(responseApp).post('/send').send({})

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      message: 'Success'
    })
  })

  it('should throw error when response validation fails', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        200: z.object({
          message: z.string(),
          count: z.number()
        })
      }
    }

    responseApp.post(
      '/invalid-response',
      validate(responseSchema).use((req, res) => {
        // @ts-ignore - intentionally sending invalid response for testing
        res.json({ message: 'Success' }) // Missing required count field
      })
    )

    responseApp.use(errorHandler)

    const response = await request(responseApp).post('/invalid-response').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalled()
  })

  it('should pass non-Zod errors from headers validation to next middleware', async () => {
    const appWithError = express()
    appWithError.use(express.json())

    const errorSchema = {
      headers: z.object({}).transform(() => {
        throw new Error('Headers transform error')
      })
    }

    appWithError.post('/error-headers', validate(errorSchema), (req, res) => {
      res.json({})
    })

    appWithError.use(errorHandler)

    const response = await request(appWithError).post('/error-headers').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toBe('Headers transform error')
  })

  it('should pass non-Zod errors from query validation to next middleware', async () => {
    const appWithError = express()
    appWithError.use(express.json())

    const errorSchema = {
      query: z.object({}).transform(() => {
        throw new Error('Query transform error')
      })
    }

    appWithError.post('/error-query', validate(errorSchema), (req, res) => {
      res.json({})
    })

    appWithError.use(errorHandler)

    const response = await request(appWithError).post('/error-query').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toBe('Query transform error')
  })

  it('should pass non-Zod errors from params validation to next middleware', async () => {
    const appWithError = express()
    appWithError.use(express.json())

    const errorSchema = {
      params: z.object({}).transform(() => {
        throw new Error('Params transform error')
      })
    }

    appWithError.post('/error-params', validate(errorSchema), (req, res) => {
      res.json({})
    })

    appWithError.use(errorHandler)

    const response = await request(appWithError).post('/error-params').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toBe('Params transform error')
  })

  it('should pass non-Zod errors from locals validation to next middleware', async () => {
    const appWithError = express()
    appWithError.use(express.json())

    const errorSchema = {
      locals: z.object({}).transform(() => {
        throw new Error('Locals transform error')
      })
    }

    appWithError.use((req, res, next) => {
      res.locals = {}
      next()
    })

    appWithError.post('/error-locals', validate(errorSchema), (req, res) => {
      res.json({})
    })

    appWithError.use(errorHandler)

    const response = await request(appWithError).post('/error-locals').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toBe('Locals transform error')
  })

  it('should pass non-Zod errors from response validation to next middleware', async () => {
    const appWithError = express()
    appWithError.use(express.json())

    const errorSchema = {
      useResponse: {
        200: z
          .object({})
          .passthrough()
          .transform(() => {
            throw new Error('Response transform error')
          })
      }
    }

    appWithError.post(
      '/error-response',
      validate(errorSchema).use((req, res) => {
        // @ts-ignore - intentionally sending invalid response for testing
        res.json({})
      })
    )

    appWithError.use(errorHandler)

    const response = await request(appWithError).post('/error-response').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toBe('Response transform error')
  })

  it('should validate locals with multiple fields', async () => {
    const localsApp = express()
    const complexLocalsSchema = {
      locals: z.object({
        userId: z.string(),
        role: z.enum(['admin', 'user']),
        permissions: z.array(z.string()),
        metadata: z.object({
          lastAccess: z.string()
        })
      })
    }

    localsApp.use((req, res, next) => {
      res.locals = {
        userId: '123',
        role: 'admin',
        permissions: ['read', 'write'],
        metadata: {
          lastAccess: '2024-01-01'
        }
      }
      next()
    })

    localsApp.get('/', validate(complexLocalsSchema), (req, res) => {
      res.json(res.locals)
    })

    const response = await request(localsApp).get('/')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      userId: '123',
      role: 'admin',
      permissions: ['read', 'write'],
      metadata: {
        lastAccess: '2024-01-01'
      }
    })
  })

  it('should fail validation with invalid locals data', async () => {
    const localsApp = express()
    const localsSchema = {
      locals: z.object({
        userId: z.string(),
        count: z.number().positive()
      })
    }

    localsApp.use((req, res, next) => {
      res.locals = {
        userId: '123',
        count: -1 // Invalid: should be positive
      }
      next()
    })

    localsApp.get('/', validate(localsSchema), (req, res) => {
      res.json(res.locals)
    })

    const response = await request(localsApp).get('/')
    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty('errors')
    expect(response.body.errors[0].path).toContain('count')
  })

  it('should handle undefined locals with optional fields', async () => {
    const localsApp = express()
    const optionalLocalsSchema = {
      locals: z.object({
        userId: z.string(),
        sessionData: z
          .object({
            lastLogin: z.string()
          })
          .optional(),
        preferences: z.record(z.string()).optional()
      })
    }

    localsApp.use((req, res, next) => {
      res.locals = {
        userId: '123'
        // sessionData and preferences are intentionally omitted
      }
      next()
    })

    localsApp.get('/', validate(optionalLocalsSchema), (req, res) => {
      res.json(res.locals)
    })

    const response = await request(localsApp).get('/')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      userId: '123'
    })
  })

  it('should handle non-JSON response content type', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        200: z.string()
      }
    }

    responseApp.post(
      '/text',
      validate(responseSchema).use((req, res) => {
        res.type('text/plain')
        // @ts-ignore - intentionally sending string response for testing
        res.send('Hello World')
      })
    )

    const response = await request(responseApp).post('/text').send({})
    expect(response.status).toBe(200)
    expect(response.text).toBe('Hello World')
  })

  it('should handle JSON stringified response with content type', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        200: z.object({
          message: z.string()
        })
      }
    }

    responseApp.post(
      '/json-string',
      validate(responseSchema).use((req, res) => {
        res.type('application/json')
        // @ts-ignore - intentionally sending stringified JSON for testing
        res.send(JSON.stringify({ message: 'Hello' }))
      })
    )

    const response = await request(responseApp).post('/json-string').send({})
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ message: 'Hello' })
  })

  it('should throw error when response schema is missing for status code', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        201: z.object({
          message: z.string()
        })
      }
    }

    responseApp.post(
      '/missing-schema',
      validate(responseSchema).use((req, res) => {
        // Trying to send 200 response when only 201 is defined
        // @ts-ignore - intentionally sending response for undefined status code
        res.status(200).send({ message: 'Success' })
      })
    )

    responseApp.use(errorHandler)

    const response = await request(responseApp).post('/missing-schema').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toBe('No schema defined for status code 200')
  })

  it('should successfully validate response when schema matches status code', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        200: z.object({
          message: z.string()
        })
      }
    }

    responseApp.post(
      '/missing-schema',
      validate(responseSchema).use((req, res) => {
        res.status(200).send({ message: 'Success' })
      })
    )

    responseApp.use(errorHandler)

    const response = await request(responseApp).post('/missing-schema').send({})

    expect(response.status).toBe(200)
  })

  it('should handle invalid JSON in response with content type', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        200: z.object({
          message: z.string()
        })
      }
    }

    responseApp.post(
      '/invalid-json',
      validate(responseSchema).use((req, res) => {
        res.type('application/json')
        // @ts-ignore - intentionally sending invalid JSON for testing
        res.send('{"message": "Hello"') // Invalid JSON - missing closing brace
      })
    )

    responseApp.use(errorHandler)

    const response = await request(responseApp).post('/invalid-json').send({})
    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toContain("Expected ',' or '}' after property value in JSON")
  })

  it('should handle JSON response with status code and content type', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        201: z.object({
          message: z.string()
        })
      }
    }

    responseApp.post(
      '/json-with-status',
      validate(responseSchema).use((req, res) => {
        res.type('application/json')

        // @ts-ignore - intentionally sending stringified JSON for testing
        res.status(201).send(JSON.stringify({ message: 'Created' }))
      })
    )

    const response = await request(responseApp).post('/json-with-status').send({})
    expect(response.status).toBe(201)
    expect(response.body).toEqual({ message: 'Created' })
  })

  it('should throw error when response schema is missing for res.json', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        201: z.object({
          message: z.string()
        })
        // 200 is intentionally not defined
      }
    }

    responseApp.post(
      '/missing-schema-json',
      validate(responseSchema).use((req, res) => {
        // @ts-ignore - intentionally using undefined status code
        res.json({ message: 'Success' }) // This will use default 200 status code
      })
    )

    responseApp.use(errorHandler)

    const response = await request(responseApp).post('/missing-schema-json').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toBe('No schema defined for status code 200')
  })

  it('should throw error when response schema is missing for res.send', async () => {
    const responseApp = express()
    responseApp.use(express.json())

    const responseSchema = {
      useResponse: {
        201: z.object({
          message: z.string()
        })
        // 200 is intentionally not defined
      }
    }

    responseApp.post(
      '/missing-schema-send',
      validate(responseSchema).use((req, res) => {
        // @ts-ignore - intentionally using undefined status code
        res.send({ message: 'Success' }) // This will use default 200 status code
      })
    )

    responseApp.use(errorHandler)

    const response = await request(responseApp).post('/missing-schema-send').send({})

    expect(response.status).toBe(500)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(errorHandler.mock.calls[0][0].message).toBe('No schema defined for status code 200')
  })
})
