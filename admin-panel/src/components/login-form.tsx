import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

export function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setInvalid(false)
    try {
      await api.post('/login', { password })
      navigate('/')
    } catch {
      toast.error('Неверный пароль')
      setInvalid(true)
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup className="gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary text-4xl">
              🧌
            </div>
            <h1 className="text-4xl font-heading font-bold">Тоха</h1>
            <p className="text-sm font-sans text-muted-foreground">Введите пароль для входа</p>
          </div>
          <Field data-invalid={invalid || undefined}>
            <Input
              ref={inputRef}
              id="password"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setInvalid(false) }}
              placeholder="••••••••••"
              autoFocus
              aria-invalid={invalid || undefined}
              className="text-center tracking-widest"
            />
          </Field>
          <Field>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
