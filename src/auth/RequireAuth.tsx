import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

type Props = {
  children: ReactNode
  adminOnly?: boolean
}

function RequireAuth({ children, adminOnly = false }: Props) {
  const { user, profile, loading } = useAuth()

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

  if (!profile || profile.status !== 'approved') {
    return <Navigate to='/pending' replace />
  }

  if (adminOnly && profile.role !== 'admin') {
    return <Navigate to='/member' replace />
  }

  return <>{children}</>
}

export default RequireAuth