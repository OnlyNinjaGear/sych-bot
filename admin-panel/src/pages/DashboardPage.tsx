import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'

interface BotStatus {
  found: boolean
  status: string
  uptime?: number
  restarts?: number
  memory?: number
  cpu?: number
}

interface NanaBananaStats {
  generated: number
  edited: number
  errors: number
  lastModel: string | null
}

interface Stats {
  today: {
    date: string
    smart: number
    logic: number
    search: number
    google: { count: number; status: boolean; cooldownUntil?: number }[]
    modelCounts?: Record<string, number>
    activeKey?: number
    activeModel?: string
    nanoBanana?: NanaBananaStats
  }
  detectedLimits?: Record<string, Record<string, { value: number; detectedAt: number }>>
  manualLimits?: Record<string, { RPD?: number; RPM?: number; TPM?: number }>
  history: { date: string; smart: number; logic: number; search: number; google: number }[]
  allTime: { smart: number; logic: number; search: number; google: number }
}

interface BotSettings {
  mainModel?: string
  mainModelFallbacks?: string[]
  logicModel?: string
  logicModelFallbacks?: string[]
  nativeModels?: string[]
  geminiKeysPaid?: boolean[]
}

interface Config {
  gemini: { primary: string; additional: string[]; imageKey: string }
}

function formatUptime(ms?: number) {
  if (!ms) return '—'
  const s = Math.floor((Date.now() - ms) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}ч ${m}м`
}

function formatMb(bytes?: number) {
  if (!bytes) return '—'
  return `${(bytes / 1024 / 1024).toFixed(0)} МБ`
}

interface DevStatus {
  running: boolean
  pid: number | null
  startedAt: number | null
}

// === Карточка моделей с usage и лимитами ===
function ModelsCard({ stats, settings, saveLimit, statsLoading }: {
  stats?: Stats
  settings?: BotSettings
  saveLimit: ReturnType<typeof useMutation>
  statsLoading: boolean
}) {
  // Собираем все модели которые могут использоваться
  const mainChain = [settings?.mainModel, ...(settings?.mainModelFallbacks || [])].filter(Boolean) as string[]
  const logicChain = [settings?.logicModel, ...(settings?.logicModelFallbacks || [])].filter(Boolean) as string[]
  const nativeChain = settings?.nativeModels || []
  const allModels = Array.from(new Set([...mainChain, ...logicChain, ...nativeChain]))

  const activeModel = stats?.today?.activeModel
  const modelCounts = stats?.today?.modelCounts || {}
  const detectedLimits = stats?.detectedLimits || {}
  const manualLimits = stats?.manualLimits || {}

  // Количество нативных Gemini ключей — для умножения лимитов нативных моделей
  const nativeKeyCount = Math.max(1, stats?.today?.google?.length || 1)

  // Эффективный лимит: detected > manual > null
  const getEffectiveLimit = (model: string, type: 'RPD' | 'RPM' | 'TPM') => {
    const detected = detectedLimits[model]?.[type]?.value
    if (detected) return { value: detected, source: 'detected' as const }
    const manual = manualLimits[model]?.[type]
    if (manual) return { value: manual, source: 'manual' as const }
    return null
  }

  // Определяем роль модели для лейбла
  const getRole = (model: string) => {
    if (model === settings?.mainModel) return { label: 'MAIN', color: 'text-primary' }
    if (settings?.mainModelFallbacks?.includes(model)) return { label: 'FALLBACK', color: 'text-yellow-500' }
    if (model === settings?.logicModel) return { label: 'LOGIC', color: 'text-blue-400' }
    if (settings?.logicModelFallbacks?.includes(model)) return { label: 'LOGIC FB', color: 'text-blue-400/70' }
    if (settings?.nativeModels?.includes(model)) return { label: 'NATIVE', color: 'text-muted-foreground' }
    return { label: '', color: '' }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Модели и лимиты</span>
          <span className="text-[10px] font-normal text-muted-foreground">
            detected = из 429 · manual = вручную
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {statsLoading || !settings ? <Skeleton className="h-32 w-full" /> : (
          <div className="flex flex-col gap-3">
            {allModels.length === 0 && <p className="text-sm text-muted-foreground">Модели не настроены</p>}
            {allModels.map(model => {
              const isActive = activeModel === model
              const count = modelCounts[model] || 0
              const rpd = getEffectiveLimit(model, 'RPD')
              const role = getRole(model)

              // Для нативных моделей лимит умножаем на количество ключей
              const isNative = nativeChain.includes(model)
              const keyMultiplier = isNative ? nativeKeyCount : 1
              const totalRpd = rpd ? rpd.value * keyMultiplier : null

              const pct = totalRpd ? Math.min(100, (count / totalRpd) * 100) : 0
              const pctColor = !totalRpd ? 'text-muted-foreground' : pct >= 100 ? 'text-destructive' : pct > 80 ? 'text-destructive' : pct > 50 ? 'text-yellow-500' : 'text-foreground'

              return (
                <div key={model} className={`flex flex-col gap-1 ${isActive ? 'bg-primary/5 -mx-2 px-2 py-2 rounded' : ''}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      {isActive && <span className="text-primary shrink-0">▶</span>}
                      <span className="font-mono text-xs truncate">{model}</span>
                      {role.label && (
                        <Badge variant="outline" className={`text-[9px] h-4 px-1 shrink-0 ${role.color}`}>{role.label}</Badge>
                      )}
                    </span>
                    <span className={`tabular-nums text-xs shrink-0 ${pctColor}`}>
                      {count}{totalRpd ? ` / ${totalRpd}` : ''} RPD
                      {isNative && keyMultiplier > 1 && rpd && (
                        <span className="text-muted-foreground ml-1">(×{keyMultiplier})</span>
                      )}
                    </span>
                  </div>
                  {totalRpd && <Progress value={pct} className="h-1" />}
                  <div className="flex items-center gap-2 text-[10px]">
                    <ManualLimitInput
                      model={model}
                      type="RPD"
                      currentValue={manualLimits[model]?.RPD}
                      detectedValue={detectedLimits[model]?.RPD?.value}
                      onSave={(v) => saveLimit.mutate({ model, quotaType: 'RPD', value: v })}
                    />
                    <ManualLimitInput
                      model={model}
                      type="RPM"
                      currentValue={manualLimits[model]?.RPM}
                      detectedValue={detectedLimits[model]?.RPM?.value}
                      onSave={(v) => saveLimit.mutate({ model, quotaType: 'RPM', value: v })}
                    />
                    {rpd && (
                      <span className="text-muted-foreground ml-auto">
                        {rpd.source === 'detected' ? '✓ из 429' : '✎ вручную'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            <p className="text-[10px] text-muted-foreground italic pt-2 border-t border-border">
              Лимиты берутся из{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline">aistudio.google.com/app/apikey</a>.
              Введи вручную и нажми Enter — перезаписывается автоматически когда прилетает 429.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const MODEL_LABELS: Record<string, string> = {
  'gemini-3.1-flash-image-preview': 'Nano Banana 2',
  'gemini-2.5-flash-image': 'Nano Banana',
  'imagen-4.0-fast-generate-001': 'Imagen 4 Fast',
  'imagen-4.0-generate-001': 'Imagen 4',
}

function NanaBananaCard({ stats, imageKey, statsLoading }: {
  stats?: Stats
  imageKey?: string
  statsLoading: boolean
}) {
  const nb = stats?.today?.nanoBanana
  const hasImageKey = !!imageKey
  const total = (nb?.generated ?? 0) + (nb?.edited ?? 0)
  const modelLabel = nb?.lastModel ? (MODEL_LABELS[nb.lastModel] ?? nb.lastModel) : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span>🍌 Nano Banana / Imagen</span>
          {hasImageKey
            ? <Badge variant="default" className="text-[10px]">Платный ключ ✓</Badge>
            : <Badge variant="secondary" className="text-[10px] text-destructive">Ключ не настроен</Badge>
          }
        </CardTitle>
      </CardHeader>
      <CardContent>
        {statsLoading ? <Skeleton className="h-16 w-full" /> : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Сгенерировано</p>
                <p className="text-2xl font-bold">{nb?.generated ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Отредактировано</p>
                <p className="text-2xl font-bold">{nb?.edited ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Ошибки</p>
                <p className={`text-2xl font-bold ${(nb?.errors ?? 0) > 0 ? 'text-destructive' : ''}`}>
                  {nb?.errors ?? 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Всего сегодня</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
            </div>
            {modelLabel && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                <span className="text-muted-foreground">Последняя модель:</span>
                <span className="font-mono">{modelLabel}</span>
              </div>
            )}
            {!hasImageKey && (
              <p className="text-[10px] text-muted-foreground italic bg-muted/30 -mx-2 px-2 py-1.5 rounded">
                Добавь платный ключ в разделе Настройки → Ключи Google Gemini → Ключ для генерации изображений
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ManualLimitInput({ model, type, currentValue, detectedValue, onSave }: {
  model: string
  type: 'RPD' | 'RPM'
  currentValue?: number
  detectedValue?: number
  onSave: (v: number | null) => void
}) {
  const [val, setVal] = useState<string>(String(currentValue ?? ''))

  useEffect(() => {
    setVal(String(currentValue ?? ''))
  }, [currentValue])

  const placeholder = detectedValue ? String(detectedValue) : type
  const isOverridden = !!detectedValue && currentValue !== undefined

  return (
    <span className="flex items-center gap-1">
      <span className="text-muted-foreground">{type}:</span>
      <input
        type="number"
        value={val}
        placeholder={placeholder}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          const num = val === '' ? null : parseInt(val)
          if (num !== (currentValue ?? null)) onSave(num as any)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className={`w-14 bg-muted/50 border border-border rounded px-1 text-[10px] tabular-nums ${isOverridden ? 'opacity-50' : ''}`}
        disabled={!!detectedValue}
        title={detectedValue ? 'Значение из 429 перебивает ручное' : 'Введи число и Enter'}
      />
    </span>
  )
}

export default function DashboardPage() {
  const qc = useQueryClient()

  const { data: status, isLoading: statusLoading } = useQuery<BotStatus>({
    queryKey: ['bot-status'],
    queryFn: () => api.get('/bot/status'),
    refetchInterval: 5000,
  })

  const { data: devStatus } = useQuery<DevStatus>({
    queryKey: ['dev-status'],
    queryFn: () => api.get('/bot/dev-status'),
    refetchInterval: 3000,
  })

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats'),
    refetchInterval: 3000,
  })

  const { data: botSettings } = useQuery<BotSettings>({
    queryKey: ['bot-settings'],
    queryFn: () => api.get('/settings'),
    refetchInterval: 10000,
  })

  const { data: configData } = useQuery<Config>({
    queryKey: ['config'],
    queryFn: () => api.get('/config'),
  })

  const saveLimit = useMutation({
    mutationFn: ({ model, quotaType, value }: { model: string; quotaType: string; value: number | null }) =>
      api.put('/stats/manual-limits', { model, quotaType, value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stats'] }),
  })

  const start = useMutation({
    mutationFn: () => api.post('/bot/start'),
    onSuccess: () => { toast.success('Бот запущен'); qc.invalidateQueries({ queryKey: ['bot-status'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const stop = useMutation({
    mutationFn: () => api.post('/bot/stop'),
    onSuccess: () => { toast.success('Бот остановлен'); qc.invalidateQueries({ queryKey: ['bot-status'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const restart = useMutation({
    mutationFn: () => api.post('/bot/restart'),
    onSuccess: () => { toast.success('Бот перезапущен'); qc.invalidateQueries({ queryKey: ['bot-status'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const restartServer = useMutation({
    mutationFn: () => api.post('/bot/server-restart'),
    onSuccess: () => toast.success('Сервер панели перезапускается...'),
    onError: (e: Error) => toast.error(e.message),
  })

  const devStart = useMutation({
    mutationFn: () => api.post('/bot/dev-start'),
    onSuccess: () => { toast.success('Бот запущен (dev)'); qc.invalidateQueries({ queryKey: ['dev-status'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const devStop = useMutation({
    mutationFn: () => api.post('/bot/dev-stop'),
    onSuccess: () => { toast.success('Бот остановлен (dev)'); qc.invalidateQueries({ queryKey: ['dev-status'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const { data: devLogs } = useQuery<{ lines: string[] }>({
    queryKey: ['dev-logs'],
    queryFn: () => api.get('/bot/dev-logs'),
    refetchInterval: devStatus?.running ? 1500 : false,
    enabled: true,
  })

  const logsRef = useRef<HTMLPreElement>(null)
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight
  }, [devLogs?.lines.length])

  const isOnline = status?.status === 'online'
  const isTogglePending = start.isPending || stop.isPending

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Главная</h2>

      {/* Bot status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Управление ботом</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Статус (PM2)</p>
              {statusLoading ? <Skeleton className="h-5 w-16 mt-1" /> : (
                <Badge variant={isOnline ? 'default' : 'secondary'} className="mt-1">
                  {isOnline ? '● Работает' : '○ Остановлен'}
                </Badge>
              )}
            </div>
            <div><p className="text-muted-foreground">Аптайм</p><p className="font-medium">{formatUptime(status?.uptime)}</p></div>
            <div><p className="text-muted-foreground">Память</p><p className="font-medium">{formatMb(status?.memory)}</p></div>
          </div>
          <Separator />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={isOnline}
                disabled={isTogglePending || statusLoading}
                onCheckedChange={checked => checked ? start.mutate() : stop.mutate()}
              />
              <span className="text-sm">
                {isTogglePending ? 'Подождите...' : isOnline ? 'Включён' : 'Выключен'}
              </span>
            </label>
            <Button size="sm" variant="outline" onClick={() => restart.mutate()} disabled={restart.isPending || !isOnline}>
              {restart.isPending && <Spinner data-icon="inline-start" />}
              {restart.isPending ? 'Перезапуск...' : 'Перезапустить'}
            </Button>
          </div>
          <Separator />
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground w-full">
              Локальный запуск (dev) —{' '}
              {devStatus?.running
                ? <span className="text-foreground">работает {formatUptime(devStatus.startedAt ?? undefined)}</span>
                : 'не запущен'}
            </p>
            {devStatus?.running ? (
              <Button size="sm" variant="destructive" onClick={() => devStop.mutate()} disabled={devStop.isPending}>
                {devStop.isPending && <Spinner data-icon="inline-start" />}
                {devStop.isPending ? 'Остановка...' : 'Остановить бота'}
              </Button>
            ) : (
              <Button size="sm" onClick={() => devStart.mutate()} disabled={devStart.isPending}>
                {devStart.isPending && <Spinner data-icon="inline-start" />}
                {devStart.isPending ? 'Запуск...' : 'Запустить бота'}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-muted-foreground ml-auto" onClick={() => restartServer.mutate()} disabled={restartServer.isPending}>
              {restartServer.isPending ? 'Перезапуск сервера...' : 'Перезапустить сервер панели'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dev logs */}
      {(devStatus?.running || (devLogs?.lines.length ?? 0) > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Логи бота (dev)
              {devStatus?.running && <Badge variant="default">● live</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre
              ref={logsRef}
              className="h-72 overflow-y-auto rounded-lg bg-black text-green-400 text-xs font-mono p-3 whitespace-pre-wrap break-all"
            >
              {devLogs?.lines.join('\n') || 'нет вывода'}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Stats today */}
      <div className="grid grid-cols-3 gap-4">
        {['Smart', 'Logic', 'Search'].map((label) => {
          const key = label.toLowerCase() as 'smart' | 'logic' | 'search'
          return (
            <Card key={label}>
              <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">{label} (сегодня)</CardTitle></CardHeader>
              <CardContent>
                {statsLoading ? <Skeleton className="h-7 w-12" /> : (
                  <p className="text-2xl font-bold">{stats?.today?.[key] ?? 0}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Gemini keys */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Ключи Gemini (сегодня)</span>
            {stats?.today?.google && stats.today.google.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                всего: {stats.today.google.reduce((sum: number, k) => sum + k.count, 0)} запросов
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? <Skeleton className="h-20 w-full" /> : (() => {
            const keys = stats?.today?.google || []
            const activeModel = stats?.today?.activeModel
            const activeKey = stats?.today?.activeKey
            const paidFlags = botSettings?.geminiKeysPaid || []
            const detectedLimits = stats?.detectedLimits || {}

            const now = Date.now()
            const aliveCount = keys.filter(g => g.status && (!g.cooldownUntil || g.cooldownUntil < now)).length
            const totalCount = keys.reduce((sum, k) => sum + k.count, 0)

            // Детектированные лимиты для активной модели
            const modelLimits = activeModel ? detectedLimits[activeModel] : null
            const rpd = modelLimits?.RPD?.value
            const rpm = modelLimits?.RPM?.value

            return (
              <div className="flex flex-col gap-3">
                {activeModel && (
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                    <span className="text-muted-foreground">Активная модель:</span>
                    <span className="font-mono">{activeModel}</span>
                  </div>
                )}

                {/* Реальные лимиты от Google (если уже поймали 429) */}
                {(rpd || rpm) && (
                  <div className="flex flex-col gap-1 bg-primary/5 -mx-2 px-2 py-2 rounded">
                    <p className="text-[10px] text-muted-foreground uppercase">Реальные лимиты (от Google)</p>
                    <div className="flex items-center gap-4 text-sm">
                      {rpd && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">RPD:</span>
                          <span className={`tabular-nums font-medium ${totalCount >= rpd ? 'text-destructive' : totalCount >= rpd * 0.8 ? 'text-yellow-500' : ''}`}>
                            {totalCount} / {rpd}
                          </span>
                        </span>
                      )}
                      {rpm && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">RPM:</span>
                          <span className="tabular-nums font-medium">{rpm}</span>
                        </span>
                      )}
                    </div>
                    {rpd && (
                      <Progress value={Math.min(100, (totalCount / rpd) * 100)} className="h-1.5 mt-1" />
                    )}
                  </div>
                )}

                {!modelLimits && (
                  <p className="text-[10px] text-muted-foreground italic bg-muted/30 -mx-2 px-2 py-1.5 rounded">
                    Лимиты для модели "{activeModel}" ещё не детектированы. Узнаю их при первом 429 от Google.
                  </p>
                )}

                {/* Ключи: только счётчики, никаких выдуманных лимитов */}
                {keys.length ? keys.map((k, i) => {
                  const isActive = activeKey === i
                  const isPaid = !!paidFlags[i]
                  const onCooldown = k.cooldownUntil && k.cooldownUntil > now
                  const cooldownSec = onCooldown ? Math.ceil((k.cooldownUntil! - now) / 1000) : 0
                  const dead = !k.status
                  return (
                    <div key={i} className={`flex items-center justify-between text-sm ${isActive ? 'bg-primary/5 -mx-2 px-2 py-1 rounded' : ''}`}>
                      <span className="flex items-center gap-2">
                        {isActive && <span className="text-primary">▶</span>}
                        <span className="text-muted-foreground">Ключ #{i + 1}</span>
                        {isPaid && <Badge variant="outline" className="text-[9px] h-4 px-1">PAID</Badge>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">{k.count} запросов</span>
                        {dead ? (
                          <Badge variant="secondary" className="text-[9px]">○ RPD</Badge>
                        ) : onCooldown ? (
                          <Badge variant="outline" className="text-[9px] text-yellow-500 border-yellow-500/30">⏳ {cooldownSec}s</Badge>
                        ) : (
                          <Badge variant="default" className="text-[9px]">● OK</Badge>
                        )}
                      </span>
                    </div>
                  )
                }) : <p className="text-sm text-muted-foreground">Нет данных</p>}

                {keys.length > 0 && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border text-muted-foreground">
                    <span>Живых: {aliveCount} / {keys.length}</span>
                    <span>Всего: {totalCount}</span>
                    <span>Сброс: 00:00</span>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground italic">
                  Точные квоты:{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline">aistudio.google.com/app/apikey</a>
                </p>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Nano Banana */}
      <NanaBananaCard stats={stats} imageKey={configData?.gemini?.imageKey} statsLoading={statsLoading} />

      {/* Модели: quota usage */}
      <ModelsCard stats={stats} settings={botSettings} saveLimit={saveLimit} statsLoading={statsLoading} />

      {/* All time */}
      {stats && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Всего за всё время</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-sm">
              {(['smart', 'logic', 'search', 'google'] as const).map(k => (
                <div key={k}>
                  <p className="text-muted-foreground capitalize">{k}</p>
                  <p className="font-semibold">{stats.allTime[k]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
