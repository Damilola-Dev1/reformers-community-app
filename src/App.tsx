import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import Pending from './pages/Pending';
import AdminDashboard from './pages/AdminDashboard';
import AdminMembers from './pages/AdminMembers';
import AdminBirthdays from './pages/AdminBirthdays';
import AdminAttendance from './pages/AdminAttendance';
import AdminAssignments from './pages/AdminAssignments';
import AdminExports from './pages/AdminExports';
import MemberHome from './pages/MemberHome';
import MemberProfile from './pages/MemberProfile';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Navigate to='/login' replace />} />
        <Route path='/login' element={<Login />} />
        <Route path='/register' element={<Register />} />
        <Route path='/pending' element={<Pending />} />
        
        {/* Admin Routes */}
        <Route path='/admin' element={<AdminDashboard />} />
        <Route path='/admin/members' element={<AdminMembers />} />
        <Route path='/admin/birthdays' element={<AdminBirthdays />} />
        <Route path='/admin/attendance' element={<AdminAttendance />} />
        <Route path='/admin/assignments' element={<AdminAssignments />} />
        <Route path='/admin/exports' element={<AdminExports />} />
        
        {/* Member Routes */}
        <Route path='/member' element={<MemberHome />} />
        <Route path='/member/profile' element={<MemberProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;