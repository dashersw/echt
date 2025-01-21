import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { ZodError, type z } from 'zod'

type StatusCodes =
  | 100 // Continue
  | 101 // Switching Protocols
  | 102 // Processing
  | 103 // Early Hints
  | 200 // OK
  | 201 // Created
  | 202 // Accepted
  | 203 // Non-Authoritative Information
  | 204 // No Content
  | 205 // Reset Content
  | 206 // Partial Content
  | 207 // Multi-Status
  | 208 // Already Reported
  | 226 // IM Used
  | 300 // Multiple Choices
  | 301 // Moved Permanently
  | 302 // Found
  | 303 // See Other
  | 304 // Not Modified
  | 305 // Use Proxy
  | 307 // Temporary Redirect
  | 308 // Permanent Redirect
  | 400 // Bad Request
  | 401 // Unauthorized
  | 402 // Payment Required
  | 403 // Forbidden
  | 404 // Not Found
  | 405 // Method Not Allowed
  | 406 // Not Acceptable
  | 407 // Proxy Authentication Required
  | 408 // Request Timeout
  | 409 // Conflict
  | 410 // Gone
  | 411 // Length Required
  | 412 // Precondition Failed
  | 413 // Payload Too Large
  | 414 // URI Too Long
  | 415 // Unsupported Media Type
  | 416 // Range Not Satisfiable
  | 417 // Expectation Failed
  | 418 // I'm a teapot
  | 421 // Misdirected Request
  | 422 // Unprocessable Entity
  | 423 // Locked
  | 424 // Failed Dependency
  | 425 // Too Early
  | 426 // Upgrade Required
  | 428 // Precondition Required
  | 429 // Too Many Requests
  | 431 // Request Header Fields Too Large
  | 451 // Unavailable For Legal Reasons
  | 500 // Internal Server Error
  | 501 // Not Implemented
  | 502 // Bad Gateway
  | 503 // Service Unavailable
  | 504 // Gateway Timeout
  | 505 // HTTP Version Not Supported
  | 506 // Variant Also Negotiates
  | 507 // Insufficient Storage
  | 508 // Loop Detected
  | 509 // Bandwidth Limit Exceeded
  | 510 // Not Extended
  | 511 // Network Authentication Required

type TypedResponse<T extends Partial<Record<StatusCodes, z.ZodType>>> = T

type BaseValidationSchema = {
  body?: z.ZodType
  headers?: z.ZodType
  query?: z.ZodType
  params?: z.ZodType
  locals?: z.ZodType
}

export type SimpleResponseValidationSchema = BaseValidationSchema & {
  response: z.ZodType
  useResponse?: never
}

export type TypedResponseValidationSchema = BaseValidationSchema & {
  useResponse: TypedResponse<Partial<Record<StatusCodes, z.ZodType>>>
  response?: never
}

export type ValidationSchema = BaseValidationSchema | SimpleResponseValidationSchema | TypedResponseValidationSchema

type InferSchemaType<T extends ValidationSchema> = {
  body: T['body'] extends z.ZodType ? z.infer<T['body']> : unknown
  headers: T['headers'] extends z.ZodType ? z.infer<T['headers']> : unknown
  query: T['query'] extends z.ZodType ? z.infer<T['query']> : unknown
  params: T['params'] extends z.ZodType ? z.infer<T['params']> : unknown
  response: T extends SimpleResponseValidationSchema ? z.infer<T['response']> : unknown
  locals: T['locals'] extends z.ZodType ? z.infer<T['locals']> : Record<string, unknown>
}

type ValidatedRequest<T extends ValidationSchema> = Request<
  InferSchemaType<T>['params'],
  InferSchemaType<T>['response'],
  InferSchemaType<T>['body'],
  InferSchemaType<T>['query'],
  InferSchemaType<T>['locals']
>

type TypedJsonResponse<T extends ValidationSchema, Status extends StatusCodes> = T extends TypedResponseValidationSchema
  ? Status extends keyof T['useResponse']
    ? T['useResponse'][Status] extends z.ZodType
      ? z.infer<T['useResponse'][Status]>
      : never
    : never
  : never

type ValidatedResponse<T extends ValidationSchema> = Omit<Response, 'req' | 'status' | 'json' | 'send'> & {
  req: Request
  status<S extends StatusCodes>(
    code: S
  ): Omit<ValidatedResponse<T>, 'status'> & {
    json(body: TypedJsonResponse<T, S>): void
    send(body: TypedJsonResponse<T, S>): void
  }
  json(body: TypedJsonResponse<T, 200>): void
  send(body: TypedJsonResponse<T, 200>): void
}

type ValidatedMiddleware<T extends ValidationSchema> = RequestHandler<
  InferSchemaType<T>['params'],
  InferSchemaType<T>['response'],
  InferSchemaType<T>['body'],
  InferSchemaType<T>['query'],
  InferSchemaType<T>['locals']
> & {
  schemas: T
  handler: RequestHandler<
    InferSchemaType<T>['params'],
    InferSchemaType<T>['response'],
    InferSchemaType<T>['body'],
    InferSchemaType<T>['query'],
    InferSchemaType<T>['locals']
  >
  use: T extends TypedResponseValidationSchema
    ? <P extends (req: ValidatedRequest<T>, res: ValidatedResponse<T>, next: NextFunction) => void>(
        handler: P
      ) => RequestHandler & { schemas: T }
    : never
}

export const validate = <T extends ValidationSchema>(
  schemas: T
): T extends TypedResponseValidationSchema
  ? Omit<ValidatedMiddleware<T>, 'handler' | 'schemas'>
  : ValidatedMiddleware<T> => {
  const middleware = (req: ValidatedRequest<T>, res: ValidatedResponse<T>, next: NextFunction) => {
    const validationErrors: z.ZodError[] = []

    try {
      if ('headers' in schemas && schemas.headers) {
        const headerData = Object.fromEntries(
          Object.entries(req.headers).map(([key, value]) => {
            const lowercaseKey = key.toLowerCase()
            let headerValue: string | undefined
            if (typeof value === 'string') {
              headerValue = value
            } else {
              if (value) {
                headerValue = value[0]
              } else {
                headerValue = undefined
              }
            }
            return [lowercaseKey, headerValue]
          })
        )
        try {
          const result = schemas.headers.parse(headerData)
          Object.assign(req.headers, result)
        } catch (error) {
          if (error instanceof ZodError) {
            validationErrors.push(error)
          } else {
            throw error
          }
        }
      }

      if ('body' in schemas && schemas.body) {
        try {
          const result = schemas.body.parse(req.body)
          req.body = result
        } catch (error) {
          if (error instanceof ZodError) {
            validationErrors.push(error)
          } else {
            throw error
          }
        }
      }

      if ('query' in schemas && schemas.query) {
        try {
          const result = schemas.query.parse(req.query)
          req.query = result
        } catch (error) {
          if (error instanceof ZodError) {
            validationErrors.push(error)
          } else {
            throw error
          }
        }
      }

      if ('params' in schemas && schemas.params) {
        try {
          const result = schemas.params.parse(req.params)
          req.params = result
        } catch (error) {
          if (error instanceof ZodError) {
            validationErrors.push(error)
          } else {
            throw error
          }
        }
      }

      if ('locals' in schemas && schemas.locals) {
        try {
          const result = schemas.locals.parse(res.locals)
          res.locals = result
        } catch (error) {
          if (error instanceof ZodError) {
            validationErrors.push(error)
          } else {
            throw error
          }
        }
      }

      if (validationErrors.length > 0) {
        const allErrors = validationErrors.flatMap(error => error.errors)
        const errorResponse = { errors: allErrors }
        const baseRes = res as unknown as Response
        baseRes.status(400).json(errorResponse)
        return
      }

      if ('useResponse' in schemas && schemas.useResponse) {
        const typedResponse = schemas.useResponse
        const originalStatus = res.status.bind(res)
        const originalJson = res.json.bind(res)
        const originalSend = res.send.bind(res)

        type ChainedResponse = Omit<ValidatedResponse<T>, 'status'> & {
          json(body: TypedJsonResponse<T, StatusCodes>): void
          send(body: TypedJsonResponse<T, StatusCodes>): void
        }

        const createChainedResponse = (code: StatusCodes): ChainedResponse => {
          originalStatus(code)
          const chainedRes = res as ChainedResponse
          chainedRes.json = (body: unknown) => {
            const schema = typedResponse[code]
            if (!schema) {
              throw new Error(`No schema defined for status code ${code}`)
            }
            const result = schema.parse(body)
            return originalJson(result)
          }
          chainedRes.send = (body: unknown) => {
            if (res.get('Content-Type')?.includes('application/json')) {
              body = JSON.parse(body as string)
            }

            const schema = typedResponse[code]
            if (!schema) {
              throw new Error(`No schema defined for status code ${code}`)
            }
            const result = schema.parse(body)

            if (res.get('Content-Type')?.includes('application/json')) {
              return originalSend(JSON.stringify(result) as TypedJsonResponse<T, StatusCodes>)
            }

            return originalSend(result)
          }
          return chainedRes
        }

        res.status = ((code: StatusCodes) => createChainedResponse(code)) as ValidatedResponse<T>['status']

        res.json = ((body: unknown) => {
          const schema = typedResponse[200]
          if (!schema) {
            throw new Error('No schema defined for status code 200')
          }
          const result = schema.parse(body)
          return originalJson(result)
        }) as ValidatedResponse<T>['json']

        res.send = ((body: unknown) => {
          if (res.get('Content-Type')?.includes('application/json')) {
            body = JSON.parse(body as string)
          }

          const schema = typedResponse[200]
          if (!schema) {
            throw new Error('No schema defined for status code 200')
          }

          const result = schema.parse(body)

          if (res.get('Content-Type')?.includes('application/json')) {
            return originalSend(JSON.stringify(result) as TypedJsonResponse<T, StatusCodes>)
          }

          return originalSend(result)
        }) as ValidatedResponse<T>['send']
      }

      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errorResponse = { errors: error.errors }
        const baseRes = res as unknown as Response
        baseRes.status(400).json(errorResponse)
        return
      }
      next(error)
    }
  }

  const wrappedMiddleware = ((baseReq: Request, baseRes: Response, next: NextFunction) => {
    if ('useResponse' in schemas && schemas.useResponse) {
      throw new Error('When using useResponse, you must call .use() to provide a handler')
    }
    const req = baseReq as ValidatedRequest<T>
    const res = baseRes as unknown as ValidatedResponse<T>
    return middleware(req, res, next)
  }) as ValidatedMiddleware<T>

  return Object.assign(wrappedMiddleware, {
    schemas,
    handler: wrappedMiddleware,
    use: <
      P extends (req: ValidatedRequest<T>, res: ValidatedResponse<T>, next: NextFunction) => void,
    >(
      handler: P
    ) => {
      const handlerWrapper = ((baseReq: Request, baseRes: Response, next: NextFunction) => {
        const req = baseReq as ValidatedRequest<T>
        const res = baseRes as unknown as ValidatedResponse<T>

        middleware(req, res, (error?: unknown) => {
          if (error) {
            next(error)
            return
          }
          return handler(req, res, next)
        })
      }) as RequestHandler

      return Object.assign(handlerWrapper, {
        schemas,
      })
    },
  }) as unknown as T extends TypedResponseValidationSchema
    ? Omit<ValidatedMiddleware<T>, 'handler' | 'schemas'>
    : ValidatedMiddleware<T>
}
