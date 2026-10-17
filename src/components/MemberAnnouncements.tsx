import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'

type Announcement = {
  id: string
  title: string
  message: string
  createdAt: Date | null
}

function formatWhen(value: Date | null): string {
  if (!value) return ''
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function MemberAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'announcements'), where('communityId', '==', settings.communityId))
        const snap = await getDocs(q)
        const loaded = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            title: String(data.title ?? ''),
            message: String(data.message ?? ''),
            createdAt:
              data.createdAt && typeof data.createdAt.toDate === 'function'
                ? (data.createdAt.toDate() as Date)
                : null,
          }
        })
        loaded.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        setItems(loaded.slice(0, 5))
      } catch (err) {
        console.error(err)
        setError('Could not load announcements.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className='bg-white rounded-xl shadow p-4'>
      <h2 className='font-display text-xl font-semibold text-navy mb-2'>Announcements</h2>

      {loading && <p className='text-sm text-gray-500'>Loading...</p>}
      {error && <p className='text-sm text-red-600'>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className='text-sm text-gray-500'>No announcements yet.</p>
      )}

      <div className='space-y-4'>
        {items.map((a) => (
          <div key={a.id} className='border-t border-gray-100 pt-3 first:border-t-0 first:pt-0'>
            <p className='font-semibold text-navy'>{a.title}</p>
            <p className='text-xs text-gray-400 mb-1'>{formatWhen(a.createdAt)}</p>
            <p className='text-sm text-gray-700 whitespace-pre-line'>{a.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MemberAnnouncements