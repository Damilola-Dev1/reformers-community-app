import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { settings } from '../config/settings'

type LinkItem = {
  to: string
  label: string
  end: boolean
  icon: string[]
}

const links: LinkItem[] = [
  { to: '/admin', label: 'Dashboard', end: true, icon: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'] },
  {
    to: '/admin/members',
    label: 'Members',
    end: false,
    icon: ['M5.5 8a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0', 'M2 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5', 'M17 4.6a3.5 3.5 0 0 1 0 6.8', 'M19 14.8c1.8.8 3 2.4 3 5.2'],
  },
  {
    to: '/admin/birthdays',
    label: 'Birthdays',
    end: false,
    icon: ['M4 11h16v9H4z', 'M3 7h18v4H3z', 'M12 7v13', 'M12 7c-2-3-5-3-5-1s3 1 5 1', 'M12 7c2-3 5-3 5-1s-3 1-5 1'],
  },
  {
    to: '/admin/attendance',
    label: 'Attendance',
    end: false,
    icon: ['M9 11l3 3 8-8', 'M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9'],
  },
  {
    to: '/admin/announcements',
    label: 'Announcements',
    end: false,
    icon: ['M3 11v2a1 1 0 0 0 1 1h3l7 4V6L7 10H4a1 1 0 0 0-1 1z', 'M18 9a4 4 0 0 1 0 6'],
  },
  {
    to: '/admin/assignments',
    label: 'Assignments',
    end: false,
    icon: ['M7 3h8l4 4v14H7z', 'M14 3v5h5', 'M10 13h6', 'M10 17h6'],
  },
  { to: '/admin/exports', label: 'Exports', end: false, icon: ['M12 4v11', 'M8 11l4 4 4-4', 'M5 20h14'] },
]

const logoutIcon = ['M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4', 'M16 8l4 4-4 4', 'M20 12H9']

function Icon({ paths }: { paths: string[] }) {
  return (
    <svg
      width='20'
      height='20'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      className='shrink-0'
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

function linkClass(isActive: boolean): string {
  return (
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ' +
    (isActive ? 'bg-brand text-white' : 'text-gray-200 hover:bg-white/10')
  )
}

function drawerLinkClass(isActive: boolean): string {
  return (
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ' +
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
              <Icon paths={l.icon} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <button
          type='button'
          onClick={() => signOut(auth)}
          className='mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10'
        >
          <Icon paths={logoutIcon} />
          Log out
        </button>
      </aside>

      <div className='md:hidden sticky top-0 z-20 bg-navy'>
        <div className='flex items-center gap-3 px-3 py-2'>
          <button
            type='button'
            onClick={() => setMenuOpen(true)}
            aria-label='Open menu'
            className='flex shrink-0 items-center rounded-lg border border-white/30 p-2 text-white'
          >
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M4 7h16M4 12h16M4 17h16' />
            </svg>
          </button>
          <p className='min-w-0 truncate font-display text-base font-semibold text-white'>{settings.name}</p>
        </div>
      </div>

      {menuOpen && (
        <div className='md:hidden fixed inset-0 z-30' role='dialog' aria-modal='true' aria-label='Admin menu'>
          <div className='backdrop-in absolute inset-0 bg-black/40' onClick={() => setMenuOpen(false)} />

          <aside className='drawer-in absolute left-0 top-0 bottom-0 flex w-72 max-w-[85%] flex-col rounded-r-2xl bg-[#14294d] shadow-2xl'>
            <div className='flex items-center gap-3 border-b border-white/10 p-4'>
              <div className='shrink-0 rounded-lg bg-white p-1'>
                <img
                  src='/logo.png'
                  alt={settings.name + ' logo'}
                  onError={hideBroken}
                  className='h-12 w-12 object-contain'
                />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='font-display text-base font-semibold leading-tight text-white'>{settings.name}</p>
                <p className='mt-1 text-xs text-gray-300'>Admin</p>
              </div>
              <button
                type='button'
                onClick={() => setMenuOpen(false)}
                aria-label='Close menu'
                className='shrink-0 rounded-lg p-2 text-gray-200 hover:bg-white/10'
              >
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M6 6l12 12M18 6L6 18' />
                </svg>
              </button>
            </div>

            <nav className='flex flex-1 flex-col gap-1 overflow-y-auto p-3'>
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => drawerLinkClass(isActive)}
                >
                  <Icon paths={l.icon} />
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <div className='border-t border-white/10 p-3'>
              <button
                type='button'
                onClick={() => {
                  setMenuOpen(false)
                  signOut(auth)
                }}
                className='flex w-full items-center gap-3 rounded-lg border border-white/20 px-3 py-2.5 text-sm font-semibold text-gray-200 hover:bg-white/10'
              >
                <Icon paths={logoutIcon} />
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className='flex-1 min-w-0'>
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout