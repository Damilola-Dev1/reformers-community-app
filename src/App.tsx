import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Pending from './pages/Pending'
import AdminDashboard from './pages/AdminDashboard'
import AdminMembers from './pages/AdminMembers'
import AdminBirthdays from './pages/AdminBirthdays'
import AdminAttendance from './pages/AdminAttendance'
import AdminAnnouncements from './pages/AdminAnnouncements'
import AdminAssignments from './pages/AdminAssignments'
import AdminExports from './pages/AdminExports'
import MemberHome from './pages/MemberHome'
import MemberProfile from './pages/MemberProfile'
import RequireAuth from './auth/RequireAuth'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Navigate to='/login' replace />} />
        <Route path='/login' element={<Login />} />
        <Route path='/register' element={<Register />} />
        <Route path='/pending' element={<Pending />} />

        {/* Admin Routes (Protected) */}
        <Route path='/admin' element={<RequireAuth adminOnly><AdminDashboard /></RequireAuth>} />
        <Route path='/admin/members' element={<RequireAuth adminOnly><AdminMembers /></RequireAuth>} />
        <Route path='/admin/birthdays' element={<RequireAuth adminOnly><AdminBirthdays /></RequireAuth>} />
        <Route path='/admin/attendance' element={<RequireAuth adminOnly><AdminAttendance /></RequireAuth>} />
        <Route path='/admin/announcements' element={<RequireAuth adminOnly><AdminAnnouncements /></RequireAuth>} />
        <Route path='/admin/assignments' element={<RequireAuth adminOnly><AdminAssignments /></RequireAuth>} />
        <Route path='/admin/exports' element={<RequireAuth adminOnly><AdminExports /></RequireAuth>} />

        {/* Member Routes (Protected) */}
        <Route path='/member' element={<RequireAuth><MemberHome /></RequireAuth>} />
        <Route path='/member/profile' element={<RequireAuth><MemberProfile /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App