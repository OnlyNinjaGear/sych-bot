import * as React from 'react'
import {
  LayoutDashboardIcon,
  SettingsIcon,
  BrainIcon,
  UsersIcon,
  MessagesSquareIcon,
  ScrollTextIcon,
  FlaskConicalIcon,
  MessageCircleReplyIcon,
} from 'lucide-react'
import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

const navItems = [
  { title: 'Dashboard', url: '/', icon: <LayoutDashboardIcon />, end: true },
  { title: 'Настройки', url: '/config', icon: <SettingsIcon /> },
  { title: 'Поведение', url: '/bot-settings', icon: <BrainIcon /> },
  { title: 'Профили', url: '/profiles', icon: <UsersIcon /> },
  { title: 'Чаты', url: '/chat-profiles', icon: <MessagesSquareIcon /> },
  { title: 'Логи', url: '/logs', icon: <ScrollTextIcon /> },
  { title: 'Ответы', url: '/responses', icon: <MessageCircleReplyIcon /> },
  { title: 'Тест', url: '/test', icon: <FlaskConicalIcon /> },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-base">
                  🧌
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Toha Admin</span>
                  <span className="truncate text-xs text-muted-foreground">Бот-панель</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
