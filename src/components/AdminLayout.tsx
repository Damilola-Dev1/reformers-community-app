import { useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className='min-h-screen bg-paper md:flex'>
      <aside className='hidden md:flex md:flex-col md:w-56 md:shrink-0 md:sticky md:top-0 md:h-screen bg-navy p-4'>
        <div className='mb-6'>
          <div className='bg-white rounded-lg p-2 w-fit'>
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

      <div className='md:hidden sticky top-0 z-20 bg-navy'>
        <div className='flex items-center justify-between px-3 py-2'>
          <img
            src='/logo.png'
            alt={settings.name + ' logo'}
            onError={hideBroken}
            className='h-10 w-10 rounded bg-white p-1 object-contain'
          />
          <button
            type='button'
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label='Menu'
            aria-expanded={menuOpen}
            className='flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white'
          >
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              {menuOpen ? (
                <path d='M6 6l12 12M18 6L6 18' />
              ) : (
                <path d='M4 7h16M4 12h16M4 17h16' />
              )}
            </svg>
            Menu
          </button>
        </div>

        {menuOpen && (
          <nav className='absolute inset-x-0 top-full flex flex-col gap-1 border-t border-white/10 bg-navy p-2 shadow-lg'>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => linkClass(isActive)}
              >
                {l.label}
              </NavLink>
            ))}
            <button
              type='button'
              onClick={() => {
                setMenuOpen(false)
                signOut(auth)
              }}
              className='mt-1 border-t border-white/10 px-3 py-2 pt-3 text-left text-sm font-semibold text-gray-200 hover:bg-white/10'
            >
              Log out
            </button>
          </nav>
        )}
      </div>

      <main className='flex-1 min-w-0'>
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout