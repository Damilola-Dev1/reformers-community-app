import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { settings } from '../config/settings'
import { formatDeadline, phaseOf } from '../utils/deadline'

type Assignment = {
  id: string
  title: string
  dueDate: string
  dueTime: string
  extraHours: number
  createdAt: Date | null
}

function tagLabel(status: string | undefined, closed: boolean): string {
  if (status === 'approved') return 'Approved'
  if (status === 'revision') return 'Needs revision'
  if (status === 'submitted') return 'Submitted'
  if (closed) return 'Closed'
  return 'Not submitted'
}

function tagClass(status: string | undefined, closed: boolean): string {
  if (status === 'approved') return 'bg-blue-100 text-blue-700'
  if (status === 'revision') return 'bg-orange-100 text-orange-700'
  if (status === 'submitted') return 'bg-green-100 text-green-700'
  if (closed) return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function MemberAssignments() {
  const [items, setItems] = useState<Assignment[]>([])
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'assignments'), where('communityId', '==', settings.communityId))
        const snap = await getDocs(q)
        const loaded = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            title: String(data.title ?? ''),
            dueDate: String(data.dueDate ?? ''),
            dueTime: String(data.dueTime ?? ''),
            extraHours: Number(data.extraHours ?? 0) || 0,
            createdAt:
              data.createdAt && typeof data.createdAt.toDate === 'function'
                ? (data.createdAt.toDate() as Date)
                : null,
          }
        })
        loaded.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        setItems(loaded.slice(0, 10))
      } catch (err) {
        console.error(err)
        setError('Could not load assignments.')
        setLoading(false)
        return
      }

      try {
        const uid = auth.currentUser?.uid ?? ''
        const subQuery = query(collection(db, 'submissions'), where('memberId', '==', uid))
        const subSnap = await getDocs(subQuery)
        const map = new Map<string, string>()
        subSnap.docs.forEach((d) => {
          map.set(String(d.data().assignmentId ?? ''), String(d.data().status ?? 'submitted'))
        })
        setStatuses(map)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const now = Date.now()

  return (
    <div className='bg-white rounded-xl shadow p-4'>
      <h2 className='font-display text-xl font-semibold text-navy mb-2'>Assignments</h2>

      {loading && (
        <div className='space-y-2 animate-pulse'>
          <div className='h-4 bg-gray-200 rounded w-2/3' />
          <div className='h-3 bg-gray-100 rounded w-1/3' />
          <div className='h-3 bg-gray-100 rounded w-full' />
        </div>
      )}
      {error && <p className='text-sm text-red-600'>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className='text-sm text-gray-500'>No assignments yet.</p>
      )}

      <div className='space-y-2'>
        {items.map((a) => {
          const status = statuses.get(a.id)
          const phase = phaseOf(a, now)
          const closed = phase === 'closed' && status === undefined
          const overdue = phase !== 'open' && (status === undefined || status === 'revision')
          return (
            <Link
              key={a.id}
              to={'/member/assignments/' + a.id}
              className='flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2'
            >
              <div className='min-w-0'>
                <p className='font-semibold text-navy'>{a.title}</p>
                <p className={'text-xs ' + (overdue ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  {a.dueDate ? (overdue ? 'Overdue: was due ' : 'Due ') + formatDeadline(a) : 'No due date'}
                </p>
                {phase === 'extra' && status === undefined && (
                  <p className='text-xs text-orange-600'>Extra time is running</p>
                )}
              </div>
              <span className={'shrink-0 text-xs font-semibold rounded-full px-2 py-1 ' + tagClass(status, closed)}>
                {tagLabel(status, closed)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default MemberAssignments