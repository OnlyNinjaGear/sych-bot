import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'

interface BotStatus {
  found: boolean
  status: string
  uptime?: number
  restarts?: number
  memory?: number
  cpu?: number
}

interface Stats {
  today: { date: string; smart: number; logic: number; search: number; google: { count: number; status: boolean }[] }
  history: { date: string; smart: number; logic: number; search: number; google: number }[]
  allTime: { smart: number; logic: number; search: number; google: number }
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
    refetchInterval: 10000,
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
        <CardHeader className="pb-3"><CardTitle className="text-base">Ключи Gemini (сегодня)</CardTitle></CardHeader>
        <CardContent>
          {statsLoading ? <Skeleton className="h-20 w-full" /> : (
            <div className="flex flex-col gap-2">
              {stats?.today?.google?.length ? stats.today.google.map((k, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ключ #{i + 1}</span>
                  <span className="flex items-center gap-2">
                    <span>{k.count} запросов</span>
                    <Badge variant={k.status ? 'default' : 'secondary'}>{k.status ? '● OK' : '○ Исчерпан'}</Badge>
                  </span>
                </div>
              )) : <p className="text-sm text-muted-foreground">Нет данных</p>}
            </div>
          )}
        </CardContent>
      </Card>

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
