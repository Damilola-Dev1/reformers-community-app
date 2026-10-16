import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'

type Row = {
  id: string
  title: string
  date: string
  status: 'present' | 'absent'
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function MyAttendance() {
  const { user } = useAuth()
  const uid = user ? user.uid : ''
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }

    async function load() {
      try {
        const servicesQuery = query(
          collection(db, 'services'),
          where('communityId', '==', settings.communityId),
          where('finalized', '==', true)
        )
        const attendanceQuery = query(collection(db, 'attendance'), where('memberId', '==', uid))
        const [servicesSnap, attendanceSnap] = await Promise.all([
          getDocs(servicesQuery),
          getDocs(attendanceQuery),
        ])

        const statusByService: Record<string, 'present' | 'absent'> = {}
        attendanceSnap.docs.forEach((d) => {
          const data = d.data()
          statusByService[String(data.serviceId ?? '')] = data.status === 'present' ? 'present' : 'absent'
        })

        const found: Row[] = []
        servicesSnap.docs.forEach((d) => {
          const status = statusByService[d.id]
          if (status) {
            found.push({
              id: d.id,
              title: String(d.data().title ?? ''),
              date: String(d.data().date ?? ''),
              status: status,
            })
          }
        })
        setRows(found)
      } catch (err) {
        console.error(err)
        setError('Could not load your attendance. Check your connection and refresh.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [uid])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => b.date.localeCompare(a.date))
  }, [rows])

  const stats = useMemo(() => {
    const total = rows.length
    const present = rows.filter((r) => r.status === 'present').length
    const percent = total === 0 ? 0 : Math.round((present / total) * 100)
    return { total, present, percent }
  }, [rows])

  return (
    <div className='bg-white rounded-xl shadow p-4'>
      <h2 className='font-display text-xl font-semibold text-navy mb-3'>My attendance</h2>

      {loading && <p className='text-gray-500 text-sm'>Loading...</p>}
      {error && <p className='text-sm text-red-600'>{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className='text-gray-500 text-sm'>No finalized meetings yet.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div>
          <div className='mb-3'>
            <p className='font-display text-3xl font-semibold text-navy'>{stats.percent}%</p>
            <p className='text-xs text-gray-400'>
              Present at {stats.present} of {stats.total} finalized meeting(s)
            </p>
          </div>

          <div className='space-y-2'>
            {sorted.slice(0, 10).map((r) => (
              <div key={r.id} className='flex items-center justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='text-sm font-semibold text-navy truncate'>{r.title}</p>
                  <p className='text-xs text-gray-400'>{formatDate(r.date)}</p>
                </div>
                <span
                  className={
                    r.status === 'present'
                      ? 'shrink-0 text-xs font-semibold rounded-full px-2 py-1 bg-green-100 text-green-700'
                      : 'shrink-0 text-xs font-semibold rounded-full px-2 py-1 bg-red-100 text-red-700'
                  }
                >
                  {r.status === 'present' ? 'Present' : 'Absent'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default MyAttendance