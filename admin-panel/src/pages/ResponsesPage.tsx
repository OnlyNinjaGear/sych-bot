import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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

interface FilterCategory {
  label: string
  description: string
  responses: string[]
  mode: 'text' | 'reaction_only' | 'silent'
}

interface SmartFilter {
  enabled: boolean
  categories: Record<string, FilterCategory>
}

interface BotSettings {
  responses: Responses
  smartFilter: SmartFilter
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

const defaultFilter: SmartFilter = {
  enabled: true,
  categories: {
    spam: { label: 'Спам / повторы', description: 'Повторяющиеся запросы', responses: [], mode: 'text' },
    stupid: { label: 'Бессмыслица', description: 'Бессмысленные сообщения', responses: [], mode: 'text' },
    reaction_only: { label: 'Только реакция', description: 'Достаточно эмодзи', responses: [], mode: 'reaction_only' },
  },
}

export default function ResponsesPage() {
  const qc = useQueryClient()
  const [r, setR] = useState<Responses | null>(null)
  const [filter, setFilter] = useState<SmartFilter | null>(null)
  const [newCatKey, setNewCatKey] = useState('')

  const { data, isLoading } = useQuery<BotSettings>({
    queryKey: ['bot-settings'],
    queryFn: () => api.get('/settings'),
  })

  useEffect(() => {
    if (data?.responses) setR(structuredClone(data.responses))
    if (data?.smartFilter) setFilter(structuredClone(data.smartFilter))
    else if (data) setFilter(structuredClone(defaultFilter))
  }, [data])

  const save = useMutation({
    mutationFn: (payload: { responses?: Responses; smartFilter?: SmartFilter }) => api.put('/settings', payload),
    onSuccess: () => {
      toast.success('Сохранено — бот подхватит через секунду')
      qc.invalidateQueries({ queryKey: ['bot-settings'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !r || !filter) return <p className="text-muted-foreground">Загрузка...</p>

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

      <Separator />

      {/* Smart Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Умный фильтр</CardTitle>
              <CardDescription>
                Дешёвая модель (логика) классифицирует сообщение до вызова основного AI.
                Спам и бессмыслица получают шаблонный ответ, дорогая модель не тратится.
              </CardDescription>
            </div>
            <Switch checked={filter.enabled} onCheckedChange={v => setFilter(prev => prev ? { ...prev, enabled: v } : prev)} />
          </div>
        </CardHeader>
        {filter.enabled && (
          <CardContent className="flex flex-col gap-4">
            {Object.entries(filter.categories).map(([key, cat]) => (
              <div key={key} className="rounded-lg border p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Input
                    value={cat.label}
                    onChange={e => setFilter(prev => {
                      if (!prev) return prev
                      const c = { ...prev.categories }
                      c[key] = { ...c[key], label: e.target.value }
                      return { ...prev, categories: c }
                    })}
                    className="font-semibold text-sm flex-1"
                    placeholder="Название"
                  />
                  <Select
                    value={cat.mode}
                    onValueChange={v => setFilter(prev => {
                      if (!prev) return prev
                      const c = { ...prev.categories }
                      c[key] = { ...c[key], mode: v as FilterCategory['mode'] }
                      return { ...prev, categories: c }
                    })}
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Текстовый ответ</SelectItem>
                      <SelectItem value="reaction_only">Только реакция</SelectItem>
                      <SelectItem value="silent">Игнорировать</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive shrink-0"
                    onClick={() => setFilter(prev => {
                      if (!prev) return prev
                      const c = { ...prev.categories }
                      delete c[key]
                      return { ...prev, categories: c }
                    })}
                  >✕</Button>
                </div>
                <Input
                  value={cat.description}
                  onChange={e => setFilter(prev => {
                    if (!prev) return prev
                    const c = { ...prev.categories }
                    c[key] = { ...c[key], description: e.target.value }
                    return { ...prev, categories: c }
                  })}
                  placeholder="Описание для AI-классификатора (когда выбирать эту категорию)"
                  className="text-sm text-muted-foreground"
                />
                {cat.mode === 'text' && (
                  <VariantsField
                    label="Ответы"
                    hint="Каждая строка — отдельный вариант. Бот выбирает случайный."
                    value={cat.responses}
                    onChange={v => setFilter(prev => {
                      if (!prev) return prev
                      const c = { ...prev.categories }
                      c[key] = { ...c[key], responses: v }
                      return { ...prev, categories: c }
                    })}
                  />
                )}
              </div>
            ))}

            <div className="flex gap-2">
              <Input
                value={newCatKey}
                onChange={e => setNewCatKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="ключ_категории (латиница)"
                className="w-48 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!newCatKey || newCatKey === 'normal' || newCatKey in filter.categories}
                onClick={() => {
                  setFilter(prev => {
                    if (!prev) return prev
                    return {
                      ...prev,
                      categories: {
                        ...prev.categories,
                        [newCatKey]: { label: newCatKey, description: '', responses: [], mode: 'text' },
                      },
                    }
                  })
                  setNewCatKey('')
                }}
              >+ Добавить категорию</Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Button onClick={() => save.mutate({ responses: r!, smartFilter: filter! })} disabled={save.isPending}>
        {save.isPending ? 'Сохранение...' : 'Сохранить'}
      </Button>
    </div>
  )
}
