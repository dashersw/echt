import express from 'express'
import { z } from 'zod'
import { validate } from '../src'

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
  response: z.object({
    result: z.string().optional()
  }),
  locals: z.object({
    account: z.string().optional()
  })
}

app.post('/users/:username', validate(userSchema), (req, res) => {
  // Types are automatically inferred
  const { username, email, age } = req.body
  res.send({ result: 'ok' })

  res.send({
    result: `Created user ${username} (${email}) aged ${age}`
  })
})

export default app
