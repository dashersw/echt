import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'

import { validate } from '../../../../src'
import {
  createTodoRequestBody,
  createTodoResponse,
  getTodoResponse,
  getTodosResponse,
} from './todo.schema'

const router = Router()

router.post(
  '/',
  validate({
    body: createTodoRequestBody,
    response: createTodoResponse,
  }),
  (req, res) => {
    res.json({
      id: randomUUID(),
      title: req.body.title,
      description: req.body.description,
    })
  }
)

router.get(
  '/',
  validate({
    response: getTodosResponse,
  }),
  (_req, res) => {
    res.json([
      {
        id: randomUUID(),
        title: 'Todo 1',
        description: 'Todo 1 description',
      },
    ])
  }
)

router.get(
  '/:id',
  validate({
    params: z.object({
      id: z.string().uuid(),
    }),
    response: getTodoResponse,
  }),
  (_req, res) => {
    res.json({
      id: randomUUID(),
      title: 'Todo 1',
      description: 'Todo 1 description',
    })
  }
)

router.put(
  '/:id',
  validate({
    useResponse: {
      200: z.object({
        id: z.string().uuid(),
      }),
    },
  }).use((_req, res) => {
    res.status(200).json({
      id: randomUUID(),
    })
  })
)

router.delete(
  '/:id',
  validate({
    useResponse: {
      204: z.never(),
    },
  }).use((_req, res) => {
    res.sendStatus(204)
  })
)

export default router
