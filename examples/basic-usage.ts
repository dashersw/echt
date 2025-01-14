import express from 'express'
import { z } from 'zod'
import { validate } from '../src'

const app = express()
app.use(express.json())

const userSchema = {
  body: z.object({
    username: z.string().min(3),
    email: z.string().email(),
    age: z.number().min(18),
  }),
  headers: z.object({
    'api-key': z.string(),
  }),
  query: z.object({
    include: z.string().optional(),
  }),
}

const usernameSchema = {
  params: z.object({
    username: z.string().regex(/^[a-zA-Z0-9_]{3,16}$/),
  }),
}

const blogPostSchema = {
  params: z.object({
    year: z.string().regex(/^\d{4}$/),
    month: z.string().regex(/^(0?[1-9]|1[0-2])$/),
    day: z.string().regex(/^(0?[1-9]|[12]\d|3[01])$/),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }),
}

app.post('/users', validate(userSchema), (req, res) => {
  // Types are automatically inferred
  const { username, email, age } = req.body
  res.json({ username, email, age })
})

app.get('/users/:username', validate(usernameSchema), (req, res) => {
  const { username } = req.params
  res.json({ username })
})

app.get('/blog/:year/:month/:day/:slug', validate(blogPostSchema), (req, res) => {
  const { year, month, day, slug } = req.params
  res.json({ year, month, day, slug })
})

export default app
