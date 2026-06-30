import { z } from 'zod'

export const LoginSchema = z.object({
  username: z.string().min(1, { error: 'Username is required' }).trim(),
  password: z.string().min(1, { error: 'Password is required' }),
})

export type LoginFormState =
  | {
      errors?: {
        username?: string[]
        password?: string[]
      }
      message?: string
    }
  | undefined
