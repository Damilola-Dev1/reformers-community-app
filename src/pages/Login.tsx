import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'
import { homeFor } from '../auth/authContext'
import AuthBackground from '../components/AuthBackground'

const fieldClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'

function Login() {
  const { user, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errorKey, setErrorKey] = useState(0)
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to={homeFor(profile)} replace />
  }

  function fail(message: string) {
    setError(message)
    setErrorKey((k) => k + 1)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (email.trim() === '' || password === '') {
      fail('Enter your email and password')
      return
    }

    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        fail('Wrong email or password')
      } else if (code === 'auth/too-many-requests') {
        fail('Too many attempts. Wait a few minutes and try again.')
      } else if (code === 'auth/network-request-failed') {
        fail('Network problem. Check your connection and try again.')
      } else {
        fail('Something went wrong. Please try again.')
        console.error(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset() {
    setError('')
    setInfo('')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fail('Type your email above first, then click Forgot password')
      return
    }

    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase())
      setInfo('If this email is registered with us, a password reset link is on its way. Please check your inbox and your spam folder.')
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/network-request-failed') {
        fail('Network problem. Check your connection and try again.')
      } else {
        fail('Could not send the reset email. Please try again.')
        console.error(err)
      }
    }
  }

  return (
    <AuthBackground>
      <div className='w-full max-w-md space-y-4'>
        <div className='relative text-center'>
          <div aria-hidden='true' className='auth-glow' />
          <img
            src='/logo.png'
            alt={settings.name + ' logo'}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
            className='relative mx-auto h-44 w-auto'
          />
        </div>

        <form onSubmit={handleSubmit} noValidate className='bg-white rounded-xl shadow p-6'>
          <h1 className='font-display text-3xl font-semibold text-navy'>Welcome back</h1>
          <p className='text-sm text-gray-500 mt-1 mb-6'>Log in to {settings.name}</p>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-navy mb-1'>Email</label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete='email'
              className={fieldClass}
            />
          </div>

          <div className='mb-2'>
            <label className='block text-sm font-medium text-navy mb-1'>Password</label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete='current-password'
              className={fieldClass}
            />
          </div>

          <div className='mb-4 text-right'>
            <button type='button' onClick={handleReset} className='text-sm text-brand'>
              Forgot password?
            </button>
          </div>

          {error && (
            <p key={errorKey} className='text-sm text-red-600 mb-3 shake'>
              {error}
            </p>
          )}
          {info && <p className='text-sm text-green-700 mb-3'>{info}</p>}

          <button
            type='submit'
            disabled={submitting}
            className='w-full bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2 disabled:opacity-60'
          >
            {submitting ? 'Logging in...' : 'Log in'}
          </button>

          <p className='text-sm text-gray-500 mt-4 text-center'>
            New here? <Link to='/register' className='text-brand'>Join {settings.name}</Link>
          </p>
        </form>
      </div>
    </AuthBackground>
  )
}

export default Login