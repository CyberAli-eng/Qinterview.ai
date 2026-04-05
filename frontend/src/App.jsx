import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import InterviewPrep from './pages/InterviewPrep'

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/interview/:id" element={<InterviewPrep />} />
    </Routes>
  )
}

export default App