import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

extendZodWithOpenApi(z)

const uuidExample = '5ee71256-98e7-4892-bae0-305b4992412c'

export const createTodoRequestBody = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
  })
  .openapi('CreateTodoRequest')

export const createTodoResponse = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
  })
  .openapi('CreateTodoResponse')
  .openapi({
    description: 'The todo item was created successfully',
    example: {
      id: uuidExample,
      title: 'My Todo',
      description: 'This is my todo',
    },
  })

export const getTodoResponse = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
  })
  .openapi('GetTodoResponse')

export const getTodosResponse = z
  .array(
    z.object({
      id: z.string().uuid(),
      title: z.string().trim().min(1),
      description: z.string().trim().optional(),
    })
  )
  .openapi('GetTodosResponse')
