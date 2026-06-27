import { lazy, Suspense } from 'react'
import { Spin } from 'antd'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/Layout'

const Home = lazy(() => import('./pages/Home'))
const QuestionBank = lazy(() => import('./pages/QuestionBank'))
const QuestionList = lazy(() => import('./pages/QuestionList'))
const QuestionDetail = lazy(() => import('./pages/QuestionDetail'))
const SearchResult = lazy(() => import('./pages/SearchResult'))
const StudyPlan = lazy(() => import('./pages/StudyPlan'))
const Practice = lazy(() => import('./pages/Practice'))
const PrepRoutes = lazy(() => import('./pages/PrepRoutes'))
const Experiences = lazy(() => import('./pages/Experiences'))
const Tools = lazy(() => import('./pages/Tools'))
const Login = lazy(() => import('./pages/Auth/Login'))
const Register = lazy(() => import('./pages/Auth/Register'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminLogin = lazy(() => import('./pages/admin/Login'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AIGenerate = lazy(() => import('./pages/admin/AIGenerate'))
const DraftReview = lazy(() => import('./pages/admin/DraftReview'))

function RouteFallback() {
  return (
    <div className="route-fallback">
      <Spin />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/banks" element={<QuestionBank />} />
          <Route path="/bank/:id" element={<QuestionList />} />
          <Route path="/question/:id" element={<QuestionDetail />} />
          <Route path="/search" element={<SearchResult />} />
          <Route path="/routes" element={<PrepRoutes />} />
          <Route path="/experiences" element={<Experiences />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/study" element={<StudyPlan />} />
          <Route path="/practice" element={<Practice />} />
        </Route>
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="ai-generate" element={<AIGenerate />} />
          <Route path="draft-review" element={<DraftReview />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
