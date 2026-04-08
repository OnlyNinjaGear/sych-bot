import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ConfigPage from '@/pages/ConfigPage'
import BotSettingsPage from '@/pages/BotSettingsPage'
import ProfilesPage from '@/pages/ProfilesPage'
import ChatProfilesPage from '@/pages/ChatProfilesPage'
import LogsPage from '@/pages/LogsPage'
import TestPage from '@/pages/TestPage'
import ResponsesPage from '@/pages/ResponsesPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="bot-settings" element={<BotSettingsPage />} />
        <Route path="profiles" element={<ProfilesPage />} />
        <Route path="chat-profiles" element={<ChatProfilesPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="test" element={<TestPage />} />
        <Route path="responses" element={<ResponsesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
