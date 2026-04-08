import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { api } from '@/lib/api'

interface Responses {
  errorCensored: string[]
  errorOverloaded: string[]
  errorQuota: string[]
  errorLarge: string[]
  errorDefault: string
  videoTooLarge: string
  fileTooLarge: string
  wrongFormat: string
  muteOn: string
  muteOff: string
  cleared: string
  adminLeft: string
}

interface BotSettings {
  responses: Responses
}

function HotBadge() {
  return <Badge variant="secondary" className="text-xs font-normal">⚡ горячая замена</Badge>
}

/** Textarea где каждая строка — отдельный вариант ответа */
function VariantsField({ label, hint, value, onChange }: {
  label: string
  hint?: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  const text = value.join('\n')
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        value={text}
        onChange={e => onChange(e.target.value.split('\n'))}
        rows={Math.max(3, value.length + 1)}
        className="font-mono text-sm resize-none"
      />
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  )
}

function StringField({ label, hint, value, onChange }: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input value={value} onChange={e => onChange(e.target.value)} className="font-mono text-sm" />
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  )
}

export default function ResponsesPage() {
  const qc = useQueryClient()
  const [r, setR] = useState<Responses | null>(null)

  const { data, isLoading } = useQuery<BotSettings>({
    queryKey: ['bot-settings'],
    queryFn: () => api.get('/settings'),
  })

  useEffect(() => {
    if (data?.responses) setR(structuredClone(data.responses))
  }, [data])

  const save = useMutation({
    mutationFn: (responses: Responses) => api.put('/settings', { responses }),
    onSuccess: () => {
      toast.success('Ответы сохранены — бот подхватит через секунду')
      qc.invalidateQueries({ queryKey: ['bot-settings'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !r) return <p className="text-muted-foreground">Загрузка...</p>

  const set = <K extends keyof Responses>(key: K, val: Responses[K]) =>
    setR(prev => prev ? { ...prev, [key]: val } : prev)

  const variantHint = 'Каждая строка — отдельный вариант. Бот выбирает случайный.'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Системные ответы</h2>
        <HotBadge />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Ошибки AI */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ошибки AI</CardTitle>
            <CardDescription>Что бот отвечает когда нейронка упала или превышен лимит</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <VariantsField
              label="Цензура (safety / blocked)"
              hint={variantHint}
              value={r.errorCensored}
              onChange={v => set('errorCensored', v)}
            />
            <VariantsField
              label="Перегрузка (503 / overloaded)"
              hint={variantHint}
              value={r.errorOverloaded}
              onChange={v => set('errorOverloaded', v)}
            />
            <VariantsField
              label="Лимиты (429 / quota exhausted)"
              hint={variantHint}
              value={r.errorQuota}
              onChange={v => set('errorQuota', v)}
            />
            <VariantsField
              label="Слишком большой запрос (400 / too large)"
              hint={variantHint}
              value={r.errorLarge}
              onChange={v => set('errorLarge', v)}
            />
            <StringField
              label="Дефолтная ошибка (всё остальное)"
              value={r.errorDefault}
              onChange={v => set('errorDefault', v)}
            />
          </CardContent>
        </Card>

        {/* Файлы */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Файлы</CardTitle>
            <CardDescription>Когда файл слишком большой или неподдерживаемый формат</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <StringField
              label="Видео слишком большое (>20 МБ)"
              value={r.videoTooLarge}
              onChange={v => set('videoTooLarge', v)}
            />
            <StringField
              label="Файл слишком большой (>20 МБ)"
              value={r.fileTooLarge}
              onChange={v => set('fileTooLarge', v)}
            />
            <StringField
              label="Неподдерживаемый формат"
              value={r.wrongFormat}
              onChange={v => set('wrongFormat', v)}
            />
          </CardContent>
        </Card>

        {/* Команды */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Команды</CardTitle>
            <CardDescription>Системные ответы на команды /mute, /reset и другие события</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <StringField
              label="/mute — режим молчания включён"
              value={r.muteOn}
              onChange={v => set('muteOn', v)}
            />
            <StringField
              label="/mute — режим молчания выключен"
              value={r.muteOff}
              onChange={v => set('muteOff', v)}
            />
            <StringField
              label="/reset — история очищена"
              value={r.cleared}
              onChange={v => set('cleared', v)}
            />
            <StringField
              label="Батя ушёл из группы"
              hint="Бот отправляет это и покидает группу, когда админ выходит"
              value={r.adminLeft}
              onChange={v => set('adminLeft', v)}
            />
          </CardContent>
        </Card>
      </div>

      <Button onClick={() => save.mutate(r!)} disabled={save.isPending}>
        {save.isPending ? 'Сохранение...' : 'Сохранить'}
      </Button>
    </div>
  )
}
