import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { AuthContext } from './authContext'
import type { Profile } from './authContext'

async function loadProfile(uid: string): Promise<Profile | null> {
  try {
    const snap = await getDoc(doc(db, 'members', uid))
    if (!snap.exists()) return null

    const d = snap.data()
    return {
      fullName: String(d.fullName ?? ''),
      role: d.role === 'admin' ? 'admin' : 'member',
      status: d.status === 'approved' ? 'approved' : 'pending',
    }
  } catch (err) {
    console.error(err)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      const p = u ? await loadProfile(u.uid) : null
      setProfile(p)
      setUser(u)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const reload = useCallback(async () => {
    const u = auth.currentUser
    setProfile(u ? await loadProfile(u.uid) : null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading, reload }}>
      {children}
    </AuthContext.Provider>
  )
}