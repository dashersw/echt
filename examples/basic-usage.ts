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
    'api-key': z.string()
  }),
  query: z.object({
    include: z.string().optional()
  })
}

app.post('/users', validate(userSchema), (req, res) => {
  // Types are automatically inferred
  const { username, email, age } = req.body
  res.json({ username, email, age })
})

export default app
