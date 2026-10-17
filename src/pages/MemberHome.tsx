import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'
import VerseOfTheDay from '../components/VerseOfTheDay'
import NextMeeting from '../components/NextMeeting'
import MyAttendance from '../components/MyAttendance'
import MemberAnnouncements from '../components/MemberAnnouncements'
import MemberAssignments from '../components/MemberAssignments'

function MemberHome() {
  const { profile } = useAuth()
  const firstName = profile?.fullName.split(' ')[0] ?? ''

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <img
              src='/logo.png'
              alt={settings.name + ' logo'}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
              className='h-12 w-12 shrink-0 object-contain'
            />
            <div>
              <h1 className='font-display text-3xl font-semibold text-navy'>
                {firstName ? 'Welcome, ' + firstName : 'Welcome'}
              </h1>
              <p className='text-sm text-gray-500 mt-1 mb-6'>{settings.name}</p>
            </div>
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
          <VerseOfTheDay />

          <NextMeeting />

          <MyAttendance />

          <MemberAnnouncements />

          <MemberAssignments />
        </div>
      </div>
    </div>
  )
}

export default MemberHome