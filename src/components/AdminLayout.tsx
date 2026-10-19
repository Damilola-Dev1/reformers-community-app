import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { settings } from '../config/settings'

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/members', label: 'Members', end: false },
  { to: '/admin/birthdays', label: 'Birthdays', end: false },
  { to: '/admin/attendance', label: 'Attendance', end: false },
  { to: '/admin/announcements', label: 'Announcements', end: false },
  { to: '/admin/assignments', label: 'Assignments', end: false },
  { to: '/admin/exports', label: 'Exports', end: false },
]

function linkClass(isActive: boolean): string {
  return (
    'block rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ' +
    (isActive ? 'bg-brand text-white' : 'text-gray-200 hover:bg-white/10')
  )
}

function hideBroken(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none'
}

function AdminLayout() {
  return (
    <div className='min-h-screen bg-paper md:flex'>
      <aside className='hidden md:flex md:flex-col md:w-56 md:shrink-0 md:sticky md:top-0 md:h-screen bg-navy p-4'>
        <div className='mb-6'>
          <div className='bg-white rounded-lg p-2 w-fit mb-3'>
            <img src='/logo.png' alt={settings.name + ' logo'} onError={hideBroken} className='h-28 w-auto' />
          </div>
          
        </div>
        <nav className='flex flex-col gap-1'>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => linkClass(isActive)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button
          type='button'
          onClick={() => signOut(auth)}
          className='mt-auto text-left rounded-lg px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10'
        >
          Log out
        </button>
      </aside>

      <nav className='md:hidden sticky top-0 z-10 flex gap-2 overflow-x-auto bg-navy p-2'>
        <img
          src='/logo.png'
          alt={settings.name + ' logo'}
          onError={hideBroken}
          className='h-9 w-9 shrink-0 self-center rounded bg-white p-1 object-contain'
        />
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => linkClass(isActive)}>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout