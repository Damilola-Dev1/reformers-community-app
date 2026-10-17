import { NavLink, Outlet, useLocation } from 'react-router-dom'

function MemberLayout() {
  const { pathname } = useLocation()
  const profileActive = pathname === '/member/profile'

  const base = 'flex-1 flex flex-col items-center gap-1 py-2 text-xs font-semibold '

  return (
    <div className='min-h-screen bg-paper pb-20'>
      <Outlet />

      <nav className='fixed bottom-0 inset-x-0 z-10 bg-white border-t border-gray-200'>
        <div className='max-w-3xl mx-auto flex'>
          <NavLink to='/member' className={base + (profileActive ? 'text-gray-500' : 'text-brand')}>
            <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M3 11l9-8 9 8' />
              <path d='M5 10v10h14V10' />
            </svg>
            Home
          </NavLink>
          <NavLink to='/member/profile' className={base + (profileActive ? 'text-brand' : 'text-gray-500')}>
            <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <circle cx='12' cy='8' r='4' />
              <path d='M4 21c0-4 4-6 8-6s8 2 8 6' />
            </svg>
            Profile
          </NavLink>
        </div>
      </nav>
    </div>
  )
}

export default MemberLayout