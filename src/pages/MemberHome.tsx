import { Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'
import NextMeeting from '../components/NextMeeting'

function MemberHome() {
  const { profile } = useAuth()
  const firstName = profile?.fullName.split(' ')[0] ?? ''

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h1 className='font-display text-3xl font-semibold text-navy'>
              {firstName ? 'Welcome, ' + firstName : 'Welcome'}
            </h1>
            <p className='text-sm text-gray-500 mt-1 mb-6'>{settings.name}</p>
          </div>
          <button
            type='button'
            onClick={() => signOut(auth)}
            className='border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-1'
          >
            Log out
          </button>
        </div>

        <div className='space-y-4'>
          <NextMeeting />

          <div className='bg-white rounded-xl shadow p-4'>
            <h2 className='font-display text-xl font-semibold text-navy mb-1'>Announcements</h2>
            <p className='text-sm text-gray-500'>Announcements will appear here.</p>
          </div>

          <div className='bg-white rounded-xl shadow p-4'>
            <h2 className='font-display text-xl font-semibold text-navy mb-1'>Assignments</h2>
            <p className='text-sm text-gray-500'>Your assignments will appear here.</p>
          </div>

          <Link
            to='/member/profile'
            className='inline-block border border-gray-300 bg-white text-navy text-sm font-semibold rounded-lg px-3 py-2'
          >
            My profile
          </Link>
        </div>
      </div>
    </div>
  )
}

export default MemberHome