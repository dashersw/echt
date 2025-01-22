import fs from 'node:fs'
import path from 'node:path'
import app from './app'
import { generateOpenApiSpec } from '../../../src'

const spec = generateOpenApiSpec(app)

fs.writeFileSync(
  path.resolve(__dirname, '..', 'output', 'openapi-spec.json'),
  JSON.stringify(spec, null, 2)
)
