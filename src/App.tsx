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
import AdminAssignmentReview from './pages/AdminAssignmentReview'
import AdminExports from './pages/AdminExports'
import MemberHome from './pages/MemberHome'
import MemberProfile from './pages/MemberProfile'
import MemberAssignmentDetail from './pages/MemberAssignmentDetail'
import AdminLayout from './components/AdminLayout'
import MemberLayout from './components/MemberLayout'
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
        <Route element={<RequireAuth adminOnly><AdminLayout /></RequireAuth>}>
          <Route path='/admin' element={<AdminDashboard />} />
          <Route path='/admin/members' element={<AdminMembers />} />
          <Route path='/admin/birthdays' element={<AdminBirthdays />} />
          <Route path='/admin/attendance' element={<AdminAttendance />} />
          <Route path='/admin/announcements' element={<AdminAnnouncements />} />
          <Route path='/admin/assignments' element={<AdminAssignments />} />
          <Route path='/admin/assignments/:id' element={<AdminAssignmentReview />} />
          <Route path='/admin/exports' element={<AdminExports />} />
        </Route>

        {/* Member Routes (Protected) */}
        <Route element={<RequireAuth><MemberLayout /></RequireAuth>}>
          <Route path='/member' element={<MemberHome />} />
          <Route path='/member/profile' element={<MemberProfile />} />
          <Route path='/member/assignments/:id' element={<MemberAssignmentDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App