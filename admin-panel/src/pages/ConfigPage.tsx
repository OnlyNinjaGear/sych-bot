import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { PROVIDERS, type ProviderId } from '@/lib/models'
import { RefreshButton } from '@/components/unlumen-ui/refresh'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

interface Config {
  telegram: { TELEGRAM_BOT_TOKEN: string; ADMIN_USER_ID: string }
  ai: { AI_PROVIDER: string; AI_API_KEY: string; AI_BASE_URL: string }
  search: { SEARCH_PROVIDER: string; TAVILY_API_KEY: string }
  gemini: { primary: string; additional: string[]; imageKey: string }
  admin: { ADMIN_PANEL_PASSWORD: string; ADMIN_PANEL_PORT: string; ADMIN_PANEL_SECRET: string }
}

interface BotSettings {
  aiProvider: string
  geminiKeysPaid: boolean[]
}

type RestartTarget = 'bot' | 'server'

function MaskedInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="grid grid-cols-6 gap-2">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm col-span-5"
      />
      <Button className='h-full col-span-1' type="button" variant="outline" size="sm" onClick={() => setShow(s => !s)}>
        {show ? 'Скрыть' : 'Показать'}
      </Button>
    </div>
  )
}

function SectionBadge({ target }: { target: RestartTarget }) {
  return (
    <RefreshButton
      variant="default"
      className="font-sans"
      size="xs"
      label={target === 'bot' ? 'Бот' : 'Сервер'} />
  )
}

/** Строка с ключом Gemini + переключатель платный/бесплатный */
function GeminiKeyRow({
  label,
  value,
  paid,
  onPaidChange,
  onChange,
  action,
}: {
  label: string
  value: string
  paid: boolean
  onPaidChange: (v: boolean) => void
  onChange?: (v: string) => void
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="grid grid-cols-3 flex-1 min-w-0">
        <div className="flex flex-col items-start gap-1 shrink-0 col-span-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          {onChange ? (
            <MaskedInput value={value} onChange={onChange} placeholder="AIzaSy..." />
          ) : (
            <p className={cn(
              "font-mono text-xs truncate",
              paid ? "text-primary font-bold" : "text-muted-foreground"
            )}>
              {value ? `${value.slice(0, 8)}${'*'.repeat(23)}${value.slice(-8)}` : '—'}
            </p>
          )}
        </div>
        <div className='flex flex-row items-center gap-2 col-span-1'>
          <Label htmlFor={label} className="text-xs text-muted-foreground ml-auto">Платный</Label>
          <Switch id={label} checked={paid} onCheckedChange={onPaidChange} />
          {action}
        </div>
      </div>
    </div>
  )
}

export default function ConfigPage() {
  const qc = useQueryClient()
  const [config, setConfig] = useState<Config | null>(null)
  const [keysPaid, setKeysPaid] = useState<boolean[]>([])
  const [urlEdited, setUrlEdited] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [showAddKey, setShowAddKey] = useState(false)
  const [restartTargets, setRestartTargets] = useState<RestartTarget[]>([])
  const savedConfig = useRef<Config | null>(null)

  const { data, isLoading } = useQuery<Config>({
    queryKey: ['config'],
    queryFn: () => api.get('/config'),
  })

  const { data: settingsData } = useQuery<BotSettings>({
    queryKey: ['bot-settings'],
    queryFn: () => api.get('/settings'),
  })

  useEffect(() => {
    if (data) {
      setConfig(structuredClone(data))
      savedConfig.current = data
      setUrlEdited(false)
    }
  }, [data])

  useEffect(() => {
    if (settingsData) setKeysPaid(settingsData.geminiKeysPaid ?? [])
  }, [settingsData])

  const saveSettings = useMutation({
    mutationFn: (s: Partial<BotSettings>) => api.put('/settings', s),
  })

  const save = useMutation({
    mutationFn: (cfg: Config) => api.put('/config', cfg),
    onSuccess: async (_, cfg) => {
      // Сохраняем paid-флаги в botSettings
      await saveSettings.mutateAsync({ geminiKeysPaid: keysPaid })
      toast.success('Настройки сохранены')
      qc.invalidateQueries({ queryKey: ['config'] })
      qc.invalidateQueries({ queryKey: ['bot-settings'] })

      const prev = savedConfig.current
      const targets: RestartTarget[] = []
      const botChanged =
        ['telegram', 'ai', 'search'].some(s => JSON.stringify(cfg[s as keyof Config]) !== JSON.stringify(prev?.[s as keyof Config])) ||
        cfg.gemini.imageKey !== prev?.gemini.imageKey
      if (botChanged) targets.push('bot')
      if (JSON.stringify(cfg.admin) !== JSON.stringify(prev?.admin)) targets.push('server')
      setRestartTargets(targets)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const addKey = useMutation({
    mutationFn: (key: string) => api.post<Config>('/config/gemini-keys', { key }),
    onSuccess: (data) => {
      setConfig(structuredClone(data))
      setKeysPaid(p => [...p, false])
      setNewKey('')
      setShowAddKey(false)
      toast.success('Ключ добавлен')
      qc.invalidateQueries({ queryKey: ['config'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeKey = useMutation({
    mutationFn: (idx: number) => api.delete<Config>(`/config/gemini-keys/${idx}`),
    onSuccess: (data, idx) => {
      setConfig(structuredClone(data))
      setKeysPaid(p => p.filter((_, i) => i !== idx + 1)) // +1 because idx 0 is primary
      toast.success('Ключ удалён')
      qc.invalidateQueries({ queryKey: ['config'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const restartBot = useMutation({
    mutationFn: () => api.post('/bot/restart'),
    onSuccess: () => { toast.success('Бот перезапущен'); setRestartTargets(t => t.filter(x => x !== 'bot')) },
    onError: (e: Error) => toast.error(e.message),
  })

  const restartServer = useMutation({
    mutationFn: () => api.post('/bot/server-restart'),
    onSuccess: () => { toast.success('Сервер перезапускается...'); setRestartTargets(t => t.filter(x => x !== 'server')) },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !config) return <p className="text-muted-foreground">Загрузка...</p>

  const updateAi = (field: string, value: string) =>
    setConfig(c => c ? { ...c, ai: { ...c.ai, [field]: value } } : c)

  const updateTelegram = (field: string, value: string) =>
    setConfig(c => c ? { ...c, telegram: { ...c.telegram, [field]: value } } : c)

  const updateSearch = (field: string, value: string) =>
    setConfig(c => c ? { ...c, search: { ...c.search, [field]: value } } : c)

  const updateAdmin = (field: string, value: string) =>
    setConfig(c => c ? { ...c, admin: { ...c.admin, [field]: value } } : c)

  const currentProvider = (config.ai.AI_PROVIDER || 'openrouter') as ProviderId
  const providerDef = PROVIDERS[currentProvider] ?? PROVIDERS.openrouter

  function handleProviderChange(p: ProviderId) {
    const defaultUrl = PROVIDERS[p].baseUrl
    setConfig(c => c ? { ...c, ai: { ...c.ai, AI_PROVIDER: p, AI_BASE_URL: defaultUrl } } : c)
    setUrlEdited(false)
  }

  function resetBaseUrl() {
    setConfig(c => c ? { ...c, ai: { ...c.ai, AI_BASE_URL: providerDef.baseUrl } } : c)
    setUrlEdited(false)
  }

  // Общее число ключей (primary + additional)
  const totalKeys = 1 + config.gemini.additional.length
  // Убеждаемся что keysPaid имеет нужную длину
  const paidArray = Array.from({ length: totalKeys }, (_, i) => keysPaid[i] ?? false)
  const paidKeyCount = paidArray.filter(Boolean).length

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Настройки</h2>

      {/* Telegram */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">Telegram <SectionBadge target="bot" /></CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid grid-cols-2 gap-6">
            <Field>
              <FieldLabel>Bot Token</FieldLabel>
              <MaskedInput value={config.telegram.TELEGRAM_BOT_TOKEN} onChange={v => updateTelegram('TELEGRAM_BOT_TOKEN', v)} placeholder="8125290201:AAF..." />
            </Field>
            <Field>
              <FieldLabel>Admin User ID</FieldLabel>
              <Input value={config.telegram.ADMIN_USER_ID} onChange={e => updateTelegram('ADMIN_USER_ID', e.target.value)} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <div className='grid grid-cols-2 gap-6'>

        {/* AI API */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">AI API <SectionBadge target="bot" /></CardTitle>
            <CardDescription>Основной канал генерации ответов через OpenAI-совместимый API</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Провайдер</FieldLabel>
                <Select value={currentProvider} onValueChange={v => handleProviderChange(v as ProviderId)}>
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openrouter">OpenRouter <span className='text-xs text-muted-foreground ml-2'>Многомодельный хаб, бесплатные модели</span></SelectItem>
                    <SelectItem value="google">Google (Gemini API) <span className='text-xs text-muted-foreground ml-2'>Прямой доступ через OpenAI-формат</span></SelectItem>
                    <SelectItem value="custom">Другой провайдер <span className='text-xs text-muted-foreground ml-2'>Любой OpenAI-совместимый</span></SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>API Key</FieldLabel>
                <MaskedInput
                  value={config.ai.AI_API_KEY}
                  onChange={v => updateAi('AI_API_KEY', v)}
                  placeholder={currentProvider === 'openrouter' ? 'sk-or-v1-...' : 'AIzaSy...'}
                />
                <FieldDescription>
                  {currentProvider === 'openrouter' && 'Получить на openrouter.ai → Keys'}
                  {currentProvider === 'google' && 'Получить на aistudio.google.com → Get API Key'}
                  {currentProvider === 'custom' && 'API ключ вашего провайдера'}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Base URL</FieldLabel>
                <div className="grid grid-cols-6 gap-2">
                  <Input
                    value={config.ai.AI_BASE_URL}
                    onChange={e => { updateAi('AI_BASE_URL', e.target.value); setUrlEdited(true) }}
                    placeholder={providerDef.baseUrl || 'https://...'}
                    className="font-mono text-sm col-span-5"
                  />
                  {(urlEdited || config.ai.AI_BASE_URL !== providerDef.baseUrl) && providerDef.baseUrl && (
                    <Button className='h-full col-span-1' type="button" variant="outline" size="sm" onClick={resetBaseUrl}>
                      Сбросить
                    </Button>
                  )}
                </div>
                <FieldDescription>
                  Автозаполняется при выборе провайдера. Можно изменить вручную.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">Поиск <SectionBadge target="bot" /></CardTitle>
            <CardDescription>Провайдер для веб-поиска в ответах бота</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Провайдер</FieldLabel>
                <Select value={config.search.SEARCH_PROVIDER} onValueChange={v => updateSearch('SEARCH_PROVIDER', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className='p-3 py-4' position='popper'>
                    <SelectItem value="tavily">Tavily <span className='text-xs text-muted-foreground ml-2'>Лучший RAG-поиск, отдельный API</span></SelectItem>
                    <SelectItem value="perplexity">Perplexity Sonar <span className='text-xs text-muted-foreground ml-2'>Через OpenRouter</span></SelectItem>
                    <SelectItem value="google">Google Native <span className='text-xs text-muted-foreground ml-2'>Встроенный поиск Gemini</span></SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {config.search.SEARCH_PROVIDER === 'tavily' && (
                <Field>
                  <FieldLabel>Tavily API Key</FieldLabel>
                  <MaskedInput value={config.search.TAVILY_API_KEY} onChange={v => updateSearch('TAVILY_API_KEY', v)} placeholder="tvly-..." />
                  <FieldDescription>Получить на app.tavily.com — есть бесплатный тариф</FieldDescription>
                </Field>
              )}
              {config.search.SEARCH_PROVIDER === 'perplexity' && (
                <Field>
                  <FieldDescription>Использует AI_API_KEY через OpenRouter. Отдельный ключ не нужен.</FieldDescription>
                </Field>
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Gemini Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Ключи Google Gemini
              <Badge variant="secondary" className="text-xs font-sans select-none" data-icon="inline-start">
                <span data-icon="inline-start text-2xs">🔥</span>
                Hot-Reload
              </Badge>
            </CardTitle>
            <CardDescription>
              Native Fallback, когда основной канал исчерпан. Платные ключи приоритетны для платных моделей.
              {paidKeyCount > 0 && <span className="ml-1 text-foreground">{paidKeyCount} платных из {totalKeys}.</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <GeminiKeyRow
              label="Основной ключ"
              value={config.gemini.primary}
              paid={paidArray[0]}
              onPaidChange={v => setKeysPaid(() => { const n = [...paidArray]; n[0] = v; return n })}
              onChange={v => setConfig(prev => prev ? { ...prev, gemini: { ...prev.gemini, primary: v } } : prev)}
            />
            {config.gemini.additional.map((key, i) => (
              <GeminiKeyRow
                key={i}
                label={`Ключ №${i + 2}`}
                value={key}
                paid={paidArray[i + 1]}
                onPaidChange={v => setKeysPaid(() => { const n = [...paidArray]; n[i + 1] = v; return n })}
                action={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="text-destructive"
                    onClick={() => removeKey.mutate(i)}
                    disabled={removeKey.isPending}
                  >
                    ✕
                  </Button>
                }
              />
            ))}

            <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Ключ для генерации изображений</p>
                  <Badge variant="secondary" className="text-xs">🍌 Nano Banana / Imagen 4</Badge>
                </div>
                <MaskedInput
                  value={config.gemini.imageKey}
                  onChange={v => setConfig(c => c ? { ...c, gemini: { ...c.gemini, imageKey: v } } : c)}
                  placeholder="AIzaSy... (платный аккаунт)"
                />
                <p className="text-xs text-muted-foreground">Отдельный платный ключ только для генерации/редактирования картинок. Бесплатные ключи для этого не подходят.</p>
              </div>
            </div>

            {showAddKey ? (
              <div className="grid grid-cols-4 gap-2">
                <Input
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  placeholder="API-ключ"
                  className="font-mono col-span-2 h-10"
                  autoFocus
                />
                <Button size="lg" className='col-span-1 h-10' onClick={() => addKey.mutate(newKey)} disabled={!newKey || addKey.isPending}>
                  Добавить
                </Button>
                <Button size="lg" className='col-span-1 h-10' variant="ghost" onClick={() => setShowAddKey(false)}>Отмена</Button>
              </div>
            ) : (
              <Button variant="outline" size="lg" className="self-start w-full h-10" onClick={() => setShowAddKey(true)}>
                + Добавить ключ
              </Button>
            )}

            <FieldDescription>
              Каждый ключ — отдельный лимит. Ротация: ключ1 → ключ2 → ... → следующая модель.
              Ключи получать на <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-primary">aistudio.google.com</a>.
            </FieldDescription>
          </CardContent>
        </Card>

        {/* Admin Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">Панель управления <SectionBadge target="server" /></CardTitle>
            <CardDescription>Изменения требуют перезапуска сервера панели</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Пароль</FieldLabel>
                <MaskedInput value={config.admin.ADMIN_PANEL_PASSWORD} onChange={v => updateAdmin('ADMIN_PANEL_PASSWORD', v)} placeholder="••••••••" />
              </Field>
              <Field>
                <FieldLabel>Порт</FieldLabel>
                <Input value={config.admin.ADMIN_PANEL_PORT} onChange={e => updateAdmin('ADMIN_PANEL_PORT', e.target.value)} placeholder="3001" className="w-32" />
              </Field>
              <Field>
                <FieldLabel>Session Secret</FieldLabel>
                <MaskedInput value={config.admin.ADMIN_PANEL_SECRET} onChange={v => updateAdmin('ADMIN_PANEL_SECRET', v)} placeholder="random-secret-key" />
                <FieldDescription>Произвольная строка для подписи сессий. Сгенерируй случайную.</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Smart restart dialog */}
        <AlertDialog open={restartTargets.length > 0} onOpenChange={open => { if (!open) setRestartTargets([]) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Настройки сохранены</AlertDialogTitle>
              <AlertDialogDescription>
                Для применения изменений нужно перезапустить:
                {restartTargets.includes('bot') && <span className="block mt-1"><strong>Бот</strong> — изменены настройки Telegram / AI / Поиска</span>}
                {restartTargets.includes('server') && <span className="block mt-1"><strong>Сервер панели</strong> — изменены настройки авторизации</span>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-wrap gap-2">
              <AlertDialogCancel>Потом</AlertDialogCancel>
              {restartTargets.includes('bot') && (
                <Button variant="outline" onClick={() => restartBot.mutate()} disabled={restartBot.isPending}>
                  {restartBot.isPending && <Spinner data-icon="inline-start" />}
                  {restartBot.isPending ? 'Перезапуск...' : 'Перезапустить бот'}
                </Button>
              )}
              {restartTargets.includes('server') && (
                <AlertDialogAction onClick={() => restartServer.mutate()} disabled={restartServer.isPending}>
                  {restartServer.isPending && <Spinner data-icon="inline-start" />}
                  {restartServer.isPending ? 'Перезапуск...' : 'Перезапустить сервер'}
                </AlertDialogAction>
              )}
              {restartTargets.length === 2 && (
                <Button onClick={async () => { await restartBot.mutateAsync(); restartServer.mutate() }} disabled={restartBot.isPending || restartServer.isPending}>
                  {restartBot.isPending || restartServer.isPending && <Spinner data-icon="inline-start" />}
                  Перезапустить всё
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <Button onClick={() => save.mutate(config)} disabled={save.isPending}>
        {save.isPending && <Spinner data-icon="inline-start" />}
        {save.isPending ? 'Сохранение...' : 'Сохранить'}
      </Button>
    </div>
  )
}
