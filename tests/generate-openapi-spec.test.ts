import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import express from 'express'
import { type OpenAPIV3 } from 'openapi-types'
import { z } from 'zod'
import {
  JsonSchema7ObjectType,
  JsonSchema7UndefinedType,
  zodToJsonSchema,
} from 'zod-to-json-schema'
import { generateOpenApiSpec, validate } from '../src'

extendZodWithOpenApi(z)

describe('generateOpenApiSpec', () => {
  const app = express()
  app.use(express.json())

  const bodySchema = z.object({
    name: z.string(),
    age: z.number(),
  })

  const paramsSchema = z.object({
    id: z.string(),
  })

  const querySchema = z.object({
    filter: z.string().optional(),
  })

  const headersSchema = z.object({
    'api-key': z.string(),
  })

  const basicSchema = {
    params: paramsSchema,
    query: querySchema,
    headers: headersSchema,
    body: bodySchema,
    response: z.object({
      id: z.string(),
      message: z.string(),
    }),
  }

  const advancedSchema = {
    params: paramsSchema,
    query: querySchema,
    headers: headersSchema,
    body: bodySchema,
    useResponse: {
      200: z.object({
        id: z.string(),
        message: z.string(),
      }),
      204: z.never(),
      400: z.object({
        errors: z.array(
          z.object({
            path: z.string(),
            message: z.string(),
          })
        ),
      }),
      500: z.object({
        error: z.string(),
      }),
    },
  }

  const basicPathName = '/test-basic/:id'
  const advancedPathName = '/separate/test-advanced/:id'

  app.post(basicPathName, validate(basicSchema), (_req, res) => {
    res.json({
      id: '123',
      message: 'Hello World',
    })
  })

  // creating a separate router to also test generating docs for nested routers
  const separateRouter = express.Router()
  separateRouter.post(
    '/test-advanced/:id',
    validate(advancedSchema).use((_req, res) => {
      res.json({
        id: '123',
        message: 'Hello World',
      })
    })
  )

  // attach the separate router to the app
  app.use('/separate', separateRouter)

  // generate the OpenAPI Specification
  const spec = generateOpenApiSpec(app)

  it('should use the default info object for the OpenAPI Specification', async () => {
    expect(spec.openapi).toBe('3.0.0')
    expect(spec.info.version).toBe('1.0.0')
    expect(spec.info.title).toBe('API')
    expect(spec.info.description).toBe('Auto Generated API by echt')
  })

  it('should use the default info object for the OpenAPI Specification', async () => {
    const customSpec = generateOpenApiSpec(app, {
      openapi: '3.0.0',
      info: {
        version: '2.0.0',
        title: 'Custom API',
        description: 'Custom API by echt',
      },
      servers: [{ url: 'v1' }],
    })

    expect(customSpec.openapi).toBe('3.0.0')
    expect(customSpec.info.version).toBe('2.0.0')
    expect(customSpec.info.title).toBe('Custom API')
    expect(customSpec.info.description).toBe('Custom API by echt')
    expect(customSpec.servers).toHaveLength(1)
    expect(customSpec.servers?.[0].url).toBe('v1')
  })

  it('should include the request body in the OpenAPI Specification', async () => {
    const basicSchemaSpecRequestBody = spec.paths[basicPathName].post
      ?.requestBody as OpenAPIV3.RequestBodyObject

    if (!basicSchemaSpecRequestBody) {
      throw new Error('Basic schema spec is undefined')
    }

    const basicSchemaSpecRequestBodySchema = basicSchemaSpecRequestBody.content['application/json']
      .schema as OpenAPIV3.SchemaObject

    const requestBodySchema = zodToJsonSchema(basicSchema.body)

    expect(requestBodySchema).toMatchObject(basicSchemaSpecRequestBodySchema)
  })

  it('should include the response in the OpenAPI Specification', async () => {
    const basicSchemaSpecResponse = spec.paths[basicPathName].post?.responses['200'].content[
      'application/json'
    ].schema as OpenAPIV3.SchemaObject

    const responseSchema = zodToJsonSchema(basicSchema.response)

    expect(responseSchema).toMatchObject(basicSchemaSpecResponse)
  })

  it('should include the params in the OpenAPI Specification', async () => {
    const basicSchemaSpecParams = spec.paths[basicPathName].post
      ?.parameters as OpenAPIV3.ParameterObject[]

    if (!basicSchemaSpecParams) {
      throw new Error('Basic schema spec params is undefined')
    }

    const pathParams = basicSchemaSpecParams.filter((param) => param.in === 'path')
    const paramsSchema = zodToJsonSchema(basicSchema.params) as JsonSchema7ObjectType

    expect(pathParams).toHaveLength(Object.keys(paramsSchema.properties).length)

    pathParams.forEach((param_) => {
      const param = param_ as OpenAPIV3.ParameterObject

      expect(param.schema).toMatchObject(paramsSchema.properties[param.name])
    })
  })

  it('should include the query params in the OpenAPI Specification', async () => {
    const basicSchemaSpecQuery = spec.paths[basicPathName].post
      ?.parameters as OpenAPIV3.ParameterObject[]

    if (!basicSchemaSpecQuery) {
      throw new Error('Basic schema spec params is undefined')
    }

    const queryParams = basicSchemaSpecQuery.filter((param) => param.in === 'query')
    const querySchema = zodToJsonSchema(basicSchema.query) as JsonSchema7ObjectType

    expect(queryParams).toHaveLength(Object.keys(querySchema.properties).length)

    queryParams.forEach((param) => {
      expect(param.schema).toMatchObject(querySchema.properties[param.name])
    })
  })

  it('should include the headers in the OpenAPI Specification', async () => {
    const basicSchemaSpecHeaders = spec.paths[basicPathName].post
      ?.parameters as OpenAPIV3.ParameterObject[]

    if (!basicSchemaSpecHeaders) {
      throw new Error('Basic schema spec params is undefined')
    }

    const headers = basicSchemaSpecHeaders.filter((param) => param.in === 'header')
    const headersSchema = zodToJsonSchema(basicSchema.headers) as JsonSchema7ObjectType

    expect(headers).toHaveLength(Object.keys(headersSchema.properties).length)

    headers.forEach((header) => {
      expect(header.schema).toMatchObject(headersSchema.properties[header.name])
    })
  })

  it('should include the advanced schema response in the OpenAPI Specification', async () => {
    const advancedSchemaResponses = spec.paths[advancedPathName].post
      ?.responses as OpenAPIV3.ResponsesObject

    if (!advancedSchemaResponses) {
      throw new Error('Advanced schema responses is undefined')
    }

    for (const [status, schema_] of Object.entries(advancedSchemaResponses)) {
      const schema = schema_ as OpenAPIV3.ResponseObject
      const statusCode = Number.parseInt(status) as keyof typeof advancedSchema.useResponse
      const responseSchema = zodToJsonSchema(advancedSchema.useResponse[statusCode])

      if ((responseSchema as JsonSchema7UndefinedType).not) {
        expect(schema.content).toBeUndefined()
        continue
      }

      const specResponseSchema = schema.content?.['application/json']
        ?.schema as OpenAPIV3.SchemaObject

      expect(responseSchema).toMatchObject(specResponseSchema)
    }
  })
})
