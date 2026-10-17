import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'

type Assignment = {
  id: string
  title: string
  instructions: string
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

function MemberAssignments() {
  const [items, setItems] = useState<Assignment[]>([])
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
            instructions: String(data.instructions ?? ''),
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

      <div className='space-y-4'>
        {items.map((a) => {
          const overdue = a.dueDate !== '' && a.dueDate < today
          return (
            <div key={a.id} className='border-t border-gray-100 pt-3 first:border-t-0 first:pt-0'>
              <p className='font-semibold text-navy'>{a.title}</p>
              {a.dueDate && (
                <p className={'text-xs mb-1 ' + (overdue ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  {overdue ? 'Overdue: was due ' : 'Due '}
                  {formatDue(a.dueDate)}
                </p>
              )}
              <p className='text-sm text-gray-700 whitespace-pre-line'>{a.instructions}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MemberAssignments