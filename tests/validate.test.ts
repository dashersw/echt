import request from 'supertest'
import express from 'express'
import { validate, type ValidationSchema } from '../src'
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
    console.log('test')
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
})
