import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'
import { homeFor } from '../auth/authContext'
import AuthBackground from '../components/AuthBackground'

function Pending() {
  const { user, profile, loading, reload } = useAuth()

  useEffect(() => {
    if (user && !profile) {
      reload()
    }
  }, [user, profile, reload])

  if (loading) {
    return (
      <div className='min-h-screen bg-paper flex items-center justify-center text-gray-500'>
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to='/login' replace />
  }

  if (profile && profile.status === 'approved') {
    return <Navigate to={homeFor(profile)} replace />
  }

  const firstName = profile?.fullName.split(' ')[0] ?? ''

  return (
    <AuthBackground>
      <div className='w-full max-w-md'>
        <div className='relative text-center mb-4'>
          <div aria-hidden='true' className='auth-glow' />
          <img
            src='/logo.png'
            alt={settings.name + ' logo'}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
            className='relative mx-auto h-36 w-auto mix-blend-multiply'
          />
        </div>

        <div className='bg-white rounded-xl shadow p-6 text-center'>
          <h1 className='font-display text-3xl font-semibold text-navy'>
            {firstName ? 'Thank you, ' + firstName : 'Thank you'}
          </h1>

          <p className='text-sm text-gray-600 mt-3 mb-2'>
            Your registration for {settings.name} has been received.
          </p>

          <p className='text-sm text-gray-600 mb-6'>
            A leader will review it and approve your membership. You can log in again later to check.
          </p>

          <div className='flex gap-3'>
            <button
              type='button'
              onClick={() => reload()}
              className='flex-1 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2'
            >
              Check status
            </button>
            <button
              type='button'
              onClick={() => signOut(auth)}
              className='flex-1 border border-gray-300 text-navy font-semibold rounded-lg py-2'
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </AuthBackground>
  )
}

export default Pending