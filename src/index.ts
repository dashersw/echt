import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

export type ValidationSchema = {
  body?: z.ZodType
  headers?: z.ZodType
  query?: z.ZodType
}

type InferSchemaType<T extends ValidationSchema> = {
  body: T['body'] extends z.ZodType ? z.infer<T['body']> : unknown
  headers: T['headers'] extends z.ZodType ? z.infer<T['headers']> : unknown
  query: T['query'] extends z.ZodType ? z.infer<T['query']> : unknown
}

export const validate = <T extends ValidationSchema>(schemas: T) => {
  return (req: Request<unknown, unknown, InferSchemaType<T>['body']>, res: Response, next: NextFunction) => {
    try {
      // Validate headers if schema provided
      if (schemas.headers) {
        console.log(req.headers)
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
        const result = schemas.headers.parse(headerData)
        Object.assign(req.headers, result)
      }

      // Validate body if schema provided
      if (schemas.body) {
        const result = schemas.body.parse(req.body)
        req.body = result
      }

      // Validate query if schema provided
      if (schemas.query) {
        const result = schemas.query.parse(req.query)
        req.query = result
      }

      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log(error.errors)
        res.status(400).json({ errors: error.errors })
        return
      }
      next(error)
    }
  }
}
