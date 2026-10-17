import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { settings } from '../config/settings'

type Assignment = {
  id: string
  title: string
  dueDate: string
  createdAt: Date | null
}

function todayString(): string {
  const n = new Date()
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0')
}

function formatDue(value: string): string {
  if (!value) return ''
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function tagLabel(status: string | undefined): string {
  if (status === 'approved') return 'Approved'
  if (status === 'revision') return 'Needs revision'
  if (status === 'submitted') return 'Submitted'
  return 'Not submitted'
}

function tagClass(status: string | undefined): string {
  if (status === 'approved') return 'bg-blue-100 text-blue-700'
  if (status === 'revision') return 'bg-orange-100 text-orange-700'
  if (status === 'submitted') return 'bg-green-100 text-green-700'
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

  const today = todayString()

  return (
    <div className='bg-white rounded-xl shadow p-4'>
      <h2 className='font-display text-xl font-semibold text-navy mb-2'>Assignments</h2>

      {loading && <p className='text-sm text-gray-500'>Loading...</p>}
      {error && <p className='text-sm text-red-600'>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className='text-sm text-gray-500'>No assignments yet.</p>
      )}

      <div className='space-y-2'>
        {items.map((a) => {
          const status = statuses.get(a.id)
          const overdue = a.dueDate !== '' && a.dueDate < today && (status === undefined || status === 'revision')
          return (
            <Link
              key={a.id}
              to={'/member/assignments/' + a.id}
              className='flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2'
            >
              <div className='min-w-0'>
                <p className='font-semibold text-navy'>{a.title}</p>
                <p className={'text-xs ' + (overdue ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  {a.dueDate ? (overdue ? 'Overdue: was due ' : 'Due ') + formatDue(a.dueDate) : 'No due date'}
                </p>
              </div>
              <span className={'shrink-0 text-xs font-semibold rounded-full px-2 py-1 ' + tagClass(status)}>
                {tagLabel(status)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default MemberAssignments