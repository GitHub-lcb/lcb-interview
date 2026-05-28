import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/Layout'
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
    </Routes>
  )
}
