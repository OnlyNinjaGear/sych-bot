import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
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

interface MoodExample { user: string; bot: string }
interface Mood {
  enabled: boolean; weight: number; label: string; prompt: string
  examples: MoodExample[]; antiExamples: string[]
}
interface ContextModifier {
  enabled: boolean; prompt: string; condition: string
  threshold?: number; timeFrom?: number; timeTo?: number
}
interface MoodSystem {
  enabled: boolean; debug: boolean; intelligence: number; base: string
  moods: Record<string, Mood>
  contextModifiers: Record<string, ContextModifier>
}

interface BotSettings {
  systemPrompt: string
  moodSystem?: MoodSystem
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
  ollamaBaseUrl: string
  ollamaModel: string
  ollamaFallbackModels: string[]
  ollamaMaxTokens: number
  ollamaTemperature: number
  ollamaContextMessages: number
  allowedChatIds: number[]
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

function ChatWhitelist({ ids, onChange }: { ids: number[], onChange: (v: number[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const n = parseInt(input.trim(), 10)
    if (!isNaN(n) && !ids.includes(n)) onChange([...ids, n])
    setInput('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Белый список чатов</CardTitle>
        <CardDescription>
          Группы, в которых работает бот. Приватные чаты не проверяются. Любой формат ID подойдёт — нормализуем автоматически.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {ids.map(id => (
            <div key={id} className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-sm font-mono">
              {id}
              <button
                className="text-muted-foreground hover:text-destructive ml-1"
                onClick={() => onChange(ids.filter(x => x !== id))}
              >✕</button>
            </div>
          ))}
          {ids.length === 0 && <span className="text-sm text-muted-foreground">Список пуст — бот уходит из всех групп</span>}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="-1001234567890"
            className="font-mono text-sm w-56"
          />
          <Button variant="outline" size="sm" onClick={add}>Добавить</Button>
        </div>
      </CardContent>
    </Card>
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

  const { data: ollamaData } = useQuery<{ models: string[] }>({
    queryKey: ['ollama-models'],
    queryFn: () => api.get('/ollama/models'),
    retry: false,
    staleTime: 30_000,
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
        {/* System Prompt / Mood System */}
        <div className='col-span-2'>
          <Card className='h-full flex flex-col'>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Характер</CardTitle>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-muted-foreground">{s.moodSystem?.enabled ? 'Мультипромпт' : 'Один промпт'}</span>
                  <Switch checked={s.moodSystem?.enabled ?? false} onCheckedChange={v => {
                    const ms = s.moodSystem || { enabled: false, debug: true, intelligence: 50, base: '', moods: {}, contextModifiers: {} }
                    set('moodSystem', { ...ms, enabled: v })
                  }} />
                </label>
              </div>
              <CardDescription>
                {s.moodSystem?.enabled
                  ? 'Промпт собирается по кусочкам: база + настроение + контекст + примеры'
                  : 'Один системный промпт для всех ситуаций'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 flex-1 overflow-y-auto">
              {s.moodSystem?.enabled ? (<>
                {/* BASE prompt */}
                <Field>
                  <FieldLabel>База (форматирование, запреты)</FieldLabel>
                  <Textarea value={s.moodSystem.base} onChange={e => set('moodSystem', { ...s.moodSystem!, base: e.target.value })} rows={8} className="font-mono text-xs" />
                </Field>
                <Separator />
                {/* Intelligence */}
                <NumberInput label={`Интеллект — ${s.moodSystem.intelligence ?? 50} (±15 рандом)`} hint="0=тупой, 50=норма, 100=гений" value={s.moodSystem.intelligence ?? 50} onChange={v => set('moodSystem', { ...s.moodSystem!, intelligence: v })} min={0} max={100} />
                <Separator />
                {/* Moods */}
                <FieldLabel>Настроения</FieldLabel>
                {Object.entries(s.moodSystem.moods || {}).map(([id, mood]) => (
                  <div key={id} className="border rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={mood.enabled} onCheckedChange={v => {
                        const moods = { ...s.moodSystem!.moods, [id]: { ...mood, enabled: v } }
                        set('moodSystem', { ...s.moodSystem!, moods })
                      }} />
                      <Input value={mood.label} className="flex-1 text-sm font-semibold" onChange={e => {
                        const moods = { ...s.moodSystem!.moods, [id]: { ...mood, label: e.target.value } }
                        set('moodSystem', { ...s.moodSystem!, moods })
                      }} />
                      <span className="text-xs text-muted-foreground w-8 text-right">{mood.weight}%</span>
                      <Slider min={0} max={100} step={1} value={[mood.weight]} className="w-24" onValueChange={([v]) => {
                        const moods = { ...s.moodSystem!.moods, [id]: { ...mood, weight: v } }
                        set('moodSystem', { ...s.moodSystem!, moods })
                      }} />
                      <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => {
                        const moods = { ...s.moodSystem!.moods }; delete moods[id]
                        set('moodSystem', { ...s.moodSystem!, moods })
                      }}>✕</Button>
                    </div>
                    <Textarea value={mood.prompt} rows={3} className="text-xs font-mono" placeholder="промпт настроения" onChange={e => {
                      const moods = { ...s.moodSystem!.moods, [id]: { ...mood, prompt: e.target.value } }
                      set('moodSystem', { ...s.moodSystem!, moods })
                    }} />
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Примеры ({mood.examples?.length || 0}) и антипримеры ({mood.antiExamples?.length || 0})</summary>
                      <div className="mt-2 flex flex-col gap-1">
                        {(mood.examples || []).map((ex, i) => (
                          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                            <Input value={ex.user} placeholder="юзер" className="text-xs" onChange={e => {
                              const examples = [...(mood.examples || [])]; examples[i] = { ...ex, user: e.target.value }
                              const moods = { ...s.moodSystem!.moods, [id]: { ...mood, examples } }
                              set('moodSystem', { ...s.moodSystem!, moods })
                            }} />
                            <Input value={ex.bot} placeholder="бот" className="text-xs" onChange={e => {
                              const examples = [...(mood.examples || [])]; examples[i] = { ...ex, bot: e.target.value }
                              const moods = { ...s.moodSystem!.moods, [id]: { ...mood, examples } }
                              set('moodSystem', { ...s.moodSystem!, moods })
                            }} />
                            <Button variant="ghost" size="sm" onClick={() => {
                              const examples = (mood.examples || []).filter((_, j) => j !== i)
                              const moods = { ...s.moodSystem!.moods, [id]: { ...mood, examples } }
                              set('moodSystem', { ...s.moodSystem!, moods })
                            }}>✕</Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="self-start" onClick={() => {
                          const examples = [...(mood.examples || []), { user: '', bot: '' }]
                          const moods = { ...s.moodSystem!.moods, [id]: { ...mood, examples } }
                          set('moodSystem', { ...s.moodSystem!, moods })
                        }}>+ Пример</Button>
                        <Textarea value={(mood.antiExamples || []).join('\n')} rows={2} className="text-xs mt-2" placeholder="Антипримеры (каждая строка = плохой ответ)" onChange={e => {
                          const antiExamples = e.target.value.split('\n')
                          const moods = { ...s.moodSystem!.moods, [id]: { ...mood, antiExamples } }
                          set('moodSystem', { ...s.moodSystem!, moods })
                        }} />
                      </div>
                    </details>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="self-start" onClick={() => {
                  const key = `mood_${Date.now()}`
                  const moods = { ...s.moodSystem!.moods, [key]: { enabled: true, weight: 10, label: 'Новое', prompt: '', examples: [], antiExamples: [] } }
                  set('moodSystem', { ...s.moodSystem!, moods })
                }}>+ Добавить настроение</Button>
                <Separator />
                {/* Context Modifiers */}
                <FieldLabel>Контекстные модификаторы</FieldLabel>
                {Object.entries(s.moodSystem.contextModifiers || {}).map(([id, mod]) => (
                  <div key={id} className="flex items-start gap-2 text-xs">
                    <Switch checked={mod.enabled} onCheckedChange={v => {
                      const cm = { ...s.moodSystem!.contextModifiers, [id]: { ...mod, enabled: v } }
                      set('moodSystem', { ...s.moodSystem!, contextModifiers: cm })
                    }} />
                    <div className="flex-1">
                      <p className="font-medium">{id}</p>
                      <Input value={mod.prompt} className="text-xs mt-1" onChange={e => {
                        const cm = { ...s.moodSystem!.contextModifiers, [id]: { ...mod, prompt: e.target.value } }
                        set('moodSystem', { ...s.moodSystem!, contextModifiers: cm })
                      }} />
                    </div>
                  </div>
                ))}
                <label className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <Switch checked={s.moodSystem.debug ?? false} onCheckedChange={v => set('moodSystem', { ...s.moodSystem!, debug: v })} />
                  Debug логирование (в консоль)
                </label>
              </>) : (<>
                <Textarea
                  value={s.systemPrompt}
                  onChange={e => set('systemPrompt', e.target.value)}
                  placeholder={DEFAULT_SYSTEM_PROMPT}
                  className={cn("min-h-0 max-h-[68dvh] flex-1", !isCustomPrompt ? "h-full" : "")}
                />
                <div className="flex gap-2">
                  <Button variant="secondary" className='flex-1 rounded-lg' size="lg" onClick={() => set('systemPrompt', DEFAULT_SYSTEM_PROMPT)}>
                    Загрузить стандартный
                  </Button>
                  <RefreshButton label='Сбросить к дефолту' disabled={!isCustomPrompt} variant="outline" className='rounded-lg hover:scale-100!' size="lg" onClick={() => set('systemPrompt', '')} />
                </div>
              </>)}
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

                  <Separator />

                  <Field>
                    <FieldLabel>🦙 Модели без цензуры (Ollama)</FieldLabel>
                    <FieldDescription>
                      Триггер: <code className="text-xs bg-muted px-1 rounded">тоха лама [запрос]</code> — запрос уходит в Ollama напрямую. Если недоступна — «лама сдохла».
                    </FieldDescription>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">URL</span>
                        <Input
                          value={s.ollamaBaseUrl ?? 'http://192.168.0.29:11434/v1'}
                          onChange={e => set('ollamaBaseUrl', e.target.value)}
                          placeholder="http://192.168.0.29:11434/v1"
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">Primary</span>
                        {ollamaData?.models?.length ? (
                          <Select value={s.ollamaModel ?? ''} onValueChange={v => set('ollamaModel', v)}>
                            <SelectTrigger className="font-mono text-sm flex-1">
                              <SelectValue placeholder="выбери модель" />
                            </SelectTrigger>
                            <SelectContent>
                              {ollamaData.models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={s.ollamaModel ?? ''}
                            onChange={e => set('ollamaModel', e.target.value)}
                            placeholder="huihui_ai/qwen3.5-abliterated:35b"
                            className="font-mono text-sm"
                          />
                        )}
                      </div>
                      {(s.ollamaFallbackModels ?? []).map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-20 shrink-0">Fallback {i + 1}</span>
                          {ollamaData?.models?.length ? (
                            <Select value={m} onValueChange={v => {
                              const next = [...(s.ollamaFallbackModels ?? [])]
                              next[i] = v
                              set('ollamaFallbackModels', next)
                            }}>
                              <SelectTrigger className="font-mono text-sm flex-1">
                                <SelectValue placeholder="выбери модель" />
                              </SelectTrigger>
                              <SelectContent>
                                {ollamaData.models.map(mod => <SelectItem key={mod} value={mod}>{mod}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={m}
                              onChange={e => {
                                const next = [...(s.ollamaFallbackModels ?? [])]
                                next[i] = e.target.value
                                set('ollamaFallbackModels', next)
                              }}
                              placeholder="другая-модель:tag"
                              className="font-mono text-sm flex-1"
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground shrink-0"
                            onClick={() => set('ollamaFallbackModels', (s.ollamaFallbackModels ?? []).filter((_, j) => j !== i))}
                          >✕</Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => set('ollamaFallbackModels', [...(s.ollamaFallbackModels ?? []), ''])}
                      >+ Добавить фолбэк</Button>
                    </div>
                  </Field>

                  <NumberInput
                    label={`Макс. токенов ответа — ${s.ollamaMaxTokens ?? 8192}`}
                    hint="Лимит длины ответа от Ollama/LM Studio. 8192 = ~3000 слов"
                    value={s.ollamaMaxTokens ?? 8192}
                    onChange={v => set('ollamaMaxTokens', v)}
                    min={256}
                    max={32768}
                  />
                  <NumberInput
                    label={`Температура — ${s.ollamaTemperature ?? 0.95}`}
                    hint="Креативность. 0.5 = сдержанный, 0.95 = живой, 1.5 = дичь"
                    value={s.ollamaTemperature ?? 0.95}
                    onChange={v => set('ollamaTemperature', v)}
                    min={0}
                    max={2}
                  />
                  <NumberInput
                    label={`Контекст чата — ${s.ollamaContextMessages ?? 3} сообщений`}
                    hint="Сколько последних сообщений отправлять в Лама-режиме. Меньше = быстрее"
                    value={s.ollamaContextMessages ?? 3}
                    onChange={v => set('ollamaContextMessages', v)}
                    min={0}
                    max={20}
                  />

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


          <ChatWhitelist
            ids={s.allowedChatIds ?? []}
            onChange={v => set('allowedChatIds', v)}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => save.mutate(s)} disabled={save.isPending}>
              {save.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
            <Button variant="outline" onClick={() => {
              const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `botSettings-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
            }}>Экспорт</Button>
            <label>
              <Button variant="outline" asChild>
                <span>Импорт</span>
              </Button>
              <input type="file" accept=".json" className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                  try {
                    const parsed = JSON.parse(ev.target?.result as string)
                    setS(prev => prev ? { ...prev, ...parsed } : parsed)
                    toast.success('Настройки загружены — не забудь сохранить')
                  } catch {
                    toast.error('Неверный формат файла')
                  }
                }
                reader.readAsText(file)
                e.target.value = ''
              }} />
            </label>
          </div>
        </div>
      </div>
    </div >
  )
}
