import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  type RouteConfig,
  type ResponseConfig,
} from '@asteasolutions/zod-to-openapi'
import { type AnyZodObject } from 'zod'
import { type Express } from 'express'

import type {
  SimpleResponseValidationSchema,
  TypedResponseValidationSchema,
  ValidationSchema,
} from '.'
import { OpenAPIObjectConfig } from '@asteasolutions/zod-to-openapi/dist/v3.0/openapi-generator'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type SafeAny = any

function generateRouteConfig(
  method: RouteConfig['method'],
  path: string,
  schemas_: ValidationSchema
) {
  const schemas =
    'useResponse' in schemas_
      ? (schemas_ as TypedResponseValidationSchema)
      : (schemas_ as SimpleResponseValidationSchema)

  const route: RouteConfig = {
    method: method,
    path: path,
    responses: {},
  }

  route.request = {}

  if (schemas.body) {
    route.request.body = {
      content: {
        'application/json': {
          schema: schemas.body,
        },
      },
    }
  }

  if (schemas.params) {
    route.request.params = schemas.params as AnyZodObject
  }

  if (schemas.query) {
    route.request.query = schemas.query as AnyZodObject
  }

  if (schemas.headers) {
    route.request.headers = schemas.headers as AnyZodObject
  }

  if (schemas.response) {
    route.responses = {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: schemas.response,
          },
        },
      },
    }
  } else if (schemas.useResponse) {
    const responses = Object.entries(schemas.useResponse)

    responses.forEach(([status, schema]) => {
      let content: ResponseConfig['content'] = {
        'application/json': {
          schema: schema,
        },
      }

      // biome-ignore lint/suspicious/noExplicitAny: typeName actually exists but type got overridden by @asteasolutions/zod-to-openapi
      const typeName = (schema as any)._def.typeName

      if (typeName === 'ZodNever') {
        content = undefined
      }

      route.responses[status] = {
        description: status,
        content,
      }
    })
  }

  return route
}

function processStack(
  stack: Express['_router']['stack'],
  registry: OpenAPIRegistry,
  basePath = ''
) {
  const routerLayers = stack.filter((layer: SafeAny) => layer.name === 'router')
  const layersWithRoutes = stack.filter((layer: SafeAny) => layer.route)

  layersWithRoutes.forEach((layer: SafeAny) => {
    const routePath = basePath + layer.route.path
    const layersWithSchemas = layer.route.stack.filter(
      (layer: SafeAny) => 'schemas' in layer.handle
    )

    layersWithSchemas.forEach((layer: SafeAny) => {
      const path = routePath.replace(/\/$/, '')
      const route = generateRouteConfig(layer.method, path, layer.handle.schemas)

      registry.registerPath(route)
    })
  })

  routerLayers.forEach((layer: SafeAny) => {
    // Recursively process sub-routers
    const routerPath = layer.regexp
      .toString()
      .replace('/^', '')
      .replace('/?(?=\\/|$)/i', '')
      .replace(/\\/g, '')

    const newBasePath = basePath + routerPath
    processStack(layer.handle.stack, registry, newBasePath)
  })
}

export function generateOpenApiSpec(
  app: Express,
  openapiObjectConfig: OpenAPIObjectConfig = {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'API',
      description: 'Auto Generated API by echt',
    },
  }
) {
  const registry = new OpenAPIRegistry()

  processStack(app._router.stack, registry)

  const generator = new OpenApiGeneratorV3(registry.definitions)

  const document = generator.generateDocument(openapiObjectConfig)

  return document
}
