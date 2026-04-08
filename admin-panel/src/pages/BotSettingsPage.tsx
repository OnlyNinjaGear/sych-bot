import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { api } from '@/lib/api'
import { PROVIDERS, NATIVE_MODELS, type ModelGroup, type ProviderId } from '@/lib/models'
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/default-prompt'
import { ModelSelect } from '@/components/model-select'
import { RefreshButton } from '@/components/unlumen-ui/refresh'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Link } from 'react-router-dom'

interface BotSettings {
  systemPrompt: string
  mainModel: string
  mainModelFallbacks: string[]
  logicModel: string
  logicModelFallbacks: string[]
  nativeModels: string[]
  visionModel: string
  reactionRate: number
  maxTokens: number
  temperature: number
  laziness: number
  lazyResponses: string[]
  contextSize: number
  bufferSize: number
  chatBufferSize: number
  aiProvider?: ProviderId
}

function HotBadge() {
  return <Badge variant="secondary" className="text-xs font-normal">⚡ горячая замена</Badge>
}

function NumberInput({ label, hint, value, onChange, min, max }: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
}) {
  const step = min < 1 ? 0.01 : 1
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-24"
        />
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="flex-1"
        />
      </div>
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  )
}

function ModelChain({
  primary,
  fallbacks,
  onPrimaryChange,
  onFallbacksChange,
  models,
}: {
  primary: string
  fallbacks: string[]
  onPrimaryChange: (v: string) => void
  onFallbacksChange: (v: string[]) => void
  models: ModelGroup
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-20 gap-2">
        <span className="text-xs text-muted-foreground shrink-0 col-span-3 my-auto">Primary</span>
        <div className="w-full col-span-17">
          <ModelSelect value={primary} onChange={onPrimaryChange} groups={{ models }} className='w-full' />
        </div>
      </div>
      {fallbacks.map((m, i) => (
        <div key={i} className="grid grid-cols-20 gap-2">
          <span className="text-xs text-muted-foreground col-span-3 my-auto shrink-0">Fallback {i + 1}</span>
          <div className="w-full col-span-15">
            <ModelSelect
              value={m}
              onChange={v => {
                const next = [...fallbacks]
                next[i] = v
                onFallbacksChange(next)
              }}
              groups={{ models }}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground shrink-0 col-span-2 my-auto"
            onClick={() => onFallbacksChange(fallbacks.filter((_, j) => j !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="self-start w-full"
        onClick={() => onFallbacksChange([...fallbacks, ''])}
      >
        + Добавить фолбэк
      </Button>
    </div>
  )
}

export default function BotSettingsPage() {
  const qc = useQueryClient()
  const [s, setS] = useState<BotSettings | null>(null)

  const { data, isLoading } = useQuery<BotSettings>({
    queryKey: ['bot-settings'],
    queryFn: () => api.get('/settings'),
  })

  const { data: configData } = useQuery<{ ai: { AI_PROVIDER: string } }>({
    queryKey: ['config'],
    queryFn: () => api.get('/config'),
  })

  useEffect(() => { if (data) setS(structuredClone(data)) }, [data])

  const save = useMutation({
    mutationFn: (settings: BotSettings) => api.put('/settings', settings),
    onSuccess: () => {
      toast.success('Настройки применены — бот подхватит их через секунду')
      qc.invalidateQueries({ queryKey: ['bot-settings'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !s) return <p className="text-muted-foreground">Загрузка...</p>

  const set = <K extends keyof BotSettings>(key: K, val: BotSettings[K]) =>
    setS(prev => prev ? { ...prev, [key]: val } : prev)

  const isCustomPrompt = s.systemPrompt.trim() !== ''
  const provider = (configData?.ai?.AI_PROVIDER ?? s.aiProvider ?? 'openrouter') as ProviderId
  const apiModels = PROVIDERS[provider]?.models ?? PROVIDERS.openrouter.models

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Поведение бота</h2>
        <HotBadge />
      </div>

      <div className='grid grid-cols-5 gap-6'>
        {/* System Prompt */}
        <div className='col-span-2'>
          <Card className='h-full'>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Системный промпт-характер
                {isCustomPrompt
                  ? <Badge variant="default" className="text-xs font-normal">Кастомный</Badge>
                  : <Badge variant="secondary" className="text-xs font-normal">Дефолтный</Badge>
                }
              </CardTitle>
              <CardDescription>
                Пусто = используется встроенный дефолтный промпт. Отредактируй или загрузи дефолт как основу.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                value={s.systemPrompt}
                onChange={e => set('systemPrompt', e.target.value)}
                placeholder={DEFAULT_SYSTEM_PROMPT}
                className={cn("min-h-0 max-h-[68dvh]", !isCustomPrompt ? "h-full" : "")}
              />
              <div className="flex gap-2">
                <Button variant="secondary" className='flex-1 rounded-lg' size="lg" onClick={() => set('systemPrompt', DEFAULT_SYSTEM_PROMPT)}>
                  Загрузить стандартный
                </Button>
                <RefreshButton label='Сбросить к дефолту' disabled={!isCustomPrompt} variant="outline" className='rounded-lg hover:scale-100!' size="lg" onClick={() => set('systemPrompt', '')} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='col-span-3 flex flex-col gap-3'>
          <div className='grid grid-cols-2 gap-4'>
            <ScrollArea className='h-[calc(100dvh-12.5rem)] rounded-xl border'>
              {/* Models */}
              <Card className=''>
                <CardHeader>
                  <CardTitle className="text-base">Модели</CardTitle>
                  <CardDescription className='flex flex-col'>
                    <span>Провайдер и ключи настраиваются в разделе <Link to="/config" className="text-primary hover:underline">«Настройки»</Link></span>
                    <span>Здесь — выбор конкретных моделей</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">

                  <Field>
                    <FieldLabel>Основной канал (API)</FieldLabel>
                    <FieldDescription>
                      Модели перебираются по очереди. Если все упали — идёт в Google Native.
                      {provider !== 'custom' && <> Провайдер: <strong>{PROVIDERS[provider].name}</strong></>}
                    </FieldDescription>
                    <ModelChain
                      primary={s.mainModel}
                      fallbacks={s.mainModelFallbacks}
                      onPrimaryChange={v => set('mainModel', v)}
                      onFallbacksChange={v => set('mainModelFallbacks', v)}
                      models={apiModels}
                    />
                  </Field>

                  <Separator />

                  <Field>
                    <FieldLabel>Логика (анализ, реакции, профили, поиск)</FieldLabel>
                    <FieldDescription className='flex flex-col'>
                      <span>Вызывается чаще всего — ~3 раза на каждое сообщение</span>
                      <span>Лучше использовать лёгкую быструю модель</span>
                    </FieldDescription>
                    <ModelChain
                      primary={s.logicModel}
                      fallbacks={s.logicModelFallbacks}
                      onPrimaryChange={v => set('logicModel', v)}
                      onFallbacksChange={v => set('logicModelFallbacks', v)}
                      models={apiModels}
                    />
                  </Field>

                  <Separator />

                  <Field>
                    <FieldLabel>Google Native (финальный фолбэк)</FieldLabel>
                    <FieldDescription>
                      Ротация: ключ1+модель1 → ключ2+модель1 → ... → ключ1+модель2 → ключ2+модель2 → ...
                      Ключи управляются в разделе «Настройки».
                    </FieldDescription>
                    <div className="flex flex-col gap-3">
                      {s.nativeModels.map((m, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground w-20 shrink-0 pt-2">
                            {i === 0 ? 'Primary' : `Model ${i + 1}`}
                          </span>
                          <div className="flex-1">
                            <ModelSelect
                              value={m}
                              onChange={v => {
                                const next = [...s.nativeModels]
                                next[i] = v
                                set('nativeModels', next)
                              }}
                              groups={{ models: NATIVE_MODELS }}
                            />
                          </div>
                          {s.nativeModels.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground shrink-0 mt-0.5"
                              onClick={() => set('nativeModels', s.nativeModels.filter((_, j) => j !== i))}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => set('nativeModels', [...s.nativeModels, ''])}
                      >
                        + Добавить модель
                      </Button>
                    </div>
                  </Field>

                  <Separator />

                  <Field>
                    <FieldLabel>Изображения (vision)</FieldLabel>
                    <FieldDescription>Отдельная модель для фото — нужна мультимодальная. Использует Google Native.</FieldDescription>
                    <ModelSelect
                      value={s.visionModel}
                      onChange={v => set('visionModel', v)}
                      groups={{ models: NATIVE_MODELS }}
                    />
                  </Field>

                </CardContent>
              </Card>
            </ScrollArea>
            {/* Behavior */}
            <Card>
              <CardHeader><CardTitle className="text-base">Параметры поведения</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-5">
                <NumberInput
                  label={`Частота реакций — ${Math.round(s.reactionRate * 100)}%`}
                  hint="Вероятность поставить эмодзи-реакцию на случайное сообщение в группе"
                  value={s.reactionRate}
                  onChange={v => set('reactionRate', v)}
                  min={0}
                  max={1}
                />
                <NumberInput
                  label={`Макс. токенов — ${s.maxTokens}`}
                  hint="Лимит длины ответа. 500 = ~200 слов, 2500 = длинные"
                  value={s.maxTokens}
                  onChange={v => set('maxTokens', v)}
                  min={100}
                  max={4000}
                />
                <NumberInput
                  label={`Температура — ${s.temperature}`}
                  hint="Креативность ответов. 0.5 = сдержанный, 0.9 = живой, 1.5 = дичь"
                  value={s.temperature}
                  onChange={v => set('temperature', v)}
                  min={0}
                  max={2}
                />
                <Separator />
                <NumberInput
                  label={`Лень — ${Math.round((s.laziness ?? 0) * 100)}%`}
                  hint="Шанс ответить шаблонной отмазкой вместо полного ответа (только если бот не вызван напрямую)"
                  value={s.laziness ?? 0}
                  onChange={v => set('laziness', v)}
                  min={0}
                  max={1}
                />
                <Field>
                  <FieldLabel>Ленивые ответы</FieldLabel>
                  <Textarea
                    value={(s.lazyResponses ?? []).join('\n')}
                    onChange={e => set('lazyResponses', e.target.value.split('\n'))}
                    rows={4}
                    className="font-mono text-sm resize-none"
                    placeholder="в падлу отвечать&#10;неа&#10;потом"
                  />
                  <FieldDescription>Каждая строка = отдельный вариант</FieldDescription>
                </Field>
                <Separator />
                <NumberInput
                  label={`Контекст чата — ${s.contextSize} сообщений`}
                  hint="Сколько последних сообщений держать в памяти для генерации ответа"
                  value={s.contextSize}
                  onChange={v => set('contextSize', v)}
                  min={5}
                  max={100}
                />
                <NumberInput
                  label={`Анализ профилей юзеров — каждые ${s.bufferSize} сообщений`}
                  hint="Как часто Наблюдатель обновляет досье участников чата"
                  value={s.bufferSize}
                  onChange={v => set('bufferSize', v)}
                  min={5}
                  max={200}
                />
                <NumberInput
                  label={`Анализ профиля чата — каждые ${s.chatBufferSize} сообщений`}
                  hint="Как часто бот обновляет тему и факты о чате"
                  value={s.chatBufferSize}
                  onChange={v => set('chatBufferSize', v)}
                  min={10}
                  max={500}
                />
              </CardContent>
            </Card>
          </div>


          <Button onClick={() => save.mutate(s)} disabled={save.isPending}>
            {save.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div >
  )
}
