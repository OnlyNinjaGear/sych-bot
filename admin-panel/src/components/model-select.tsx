import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { allModels, type ModelGroup } from '@/lib/models'

export interface ModelSelectGroup {
  models: ModelGroup
  freeLabel?: string
  paidLabel?: string
}

interface ModelSelectProps {
  value: string
  onChange: (v: string) => void
  groups: ModelSelectGroup | ModelSelectGroup[]
  className?: string
}

export function ModelSelect({ value, onChange, groups, className }: ModelSelectProps) {
  const groupList = Array.isArray(groups) ? groups : [groups]
  const known = groupList.flatMap(g => allModels(g.models))
  const isCustom = value !== '' && !known.includes(value)

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={isCustom ? '__custom__' : (value || '')}
        onValueChange={v => onChange(v === '__custom__' ? '' : v)}
      >
        <SelectTrigger className={className ?? 'font-mono text-sm'}>
          <SelectValue placeholder="Выбрать модель..." />
        </SelectTrigger>
        <SelectContent>
          {groupList.map((g, gi) => (
            <>
              {g.models.free.length > 0 && (
                <SelectGroup key={`${gi}-free`}>
                  <SelectLabel>{g.freeLabel ?? 'Бесплатные'}</SelectLabel>
                  {g.models.free.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectGroup>
              )}
              {g.models.paid.length > 0 && (
                <SelectGroup key={`${gi}-paid`}>
                  <SelectLabel>{g.paidLabel ?? 'Платные'}</SelectLabel>
                  {g.models.paid.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectGroup>
              )}
            </>
          ))}
          <SelectItem value="__custom__">✏ Другая модель...</SelectItem>
        </SelectContent>
      </Select>
      {isCustom && (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="точное название модели"
          className="font-mono text-sm"
          autoFocus
        />
      )}
    </div>
  )
}
