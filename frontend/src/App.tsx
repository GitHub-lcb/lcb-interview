import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/Layout'
import AdminLayout from './pages/admin/AdminLayout'
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AIGenerate from './pages/admin/AIGenerate'
import DraftReview from './pages/admin/DraftReview'
import Home from './pages/Home'
import QuestionBank from './pages/QuestionBank'
import QuestionList from './pages/QuestionList'
import QuestionDetail from './pages/QuestionDetail'
import SearchResult from './pages/SearchResult'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/banks" element={<QuestionBank />} />
        <Route path="/bank/:id" element={<QuestionList />} />
        <Route path="/question/:id" element={<QuestionDetail />} />
        <Route path="/search" element={<SearchResult />} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="ai-generate" element={<AIGenerate />} />
        <Route path="draft-review" element={<DraftReview />} />
      </Route>
    </Routes>
  )
}
