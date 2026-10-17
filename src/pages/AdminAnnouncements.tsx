import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
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

function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState('')
  const [deletingId, setDeletingId] = useState('')

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
        setItems(loaded)
      } catch (err) {
        console.error(err)
        setError('Could not load announcements. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handlePost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')

    const cleanTitle = title.trim()
    const cleanMessage = message.trim()
    if (cleanTitle.length < 2) {
      setFormError('Enter a title for the announcement')
      return
    }
    if (cleanMessage.length < 2) {
      setFormError('Write the announcement message')
      return
    }

    setSaving(true)
    try {
      const ref = await addDoc(collection(db, 'announcements'), {
        communityId: settings.communityId,
        title: cleanTitle,
        message: cleanMessage,
        createdAt: serverTimestamp(),
      })
      setItems((prev) => [
        { id: ref.id, title: cleanTitle, message: cleanMessage, createdAt: new Date() },
        ...prev,
      ])
      setTitle('')
      setMessage('')
    } catch (err) {
      console.error(err)
      setFormError('Could not post the announcement. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setFormError('')
    setDeletingId(id)
    try {
      await deleteDoc(doc(db, 'announcements', id))
      setItems((prev) => prev.filter((a) => a.id !== id))
      setConfirmId('')
    } catch (err) {
      console.error(err)
      setFormError('Could not delete the announcement. Please try again.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/admin' className='text-sm text-brand'>Back to dashboard</Link>

        <h1 className='font-display text-3xl font-semibold text-navy mt-2'>Announcements</h1>
        <p className='text-sm text-gray-500 mt-1 mb-6'>Every approved member sees these on their home screen</p>

        <form onSubmit={handlePost} noValidate className='bg-white rounded-xl shadow p-4 mb-6'>
          <h2 className='font-display text-xl font-semibold text-navy mb-3'>New announcement</h2>

          <div className='mb-3'>
            <label className='block text-sm font-medium text-navy mb-1'>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. Special service this Sunday'
              className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
            />
          </div>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-navy mb-1'>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
            />
          </div>

          {formError && <p className='text-sm text-red-600 mb-3'>{formError}</p>}

          <button
            type='submit'
            disabled={saving}
            className='bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-60'
          >
            {saving ? 'Posting...' : 'Post announcement'}
          </button>
        </form>

        <h2 className='font-display text-xl font-semibold text-navy mb-3'>Posted</h2>

        {loading && <p className='text-gray-500'>Loading...</p>}
        {error && <p className='text-sm text-red-600'>{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className='text-gray-500'>No announcements yet.</p>
        )}

        <div className='space-y-3'>
          {items.map((a) => (
            <div key={a.id} className='bg-white rounded-xl shadow p-4'>
              <p className='font-semibold text-navy'>{a.title}</p>
              <p className='text-xs text-gray-400 mb-2'>{formatWhen(a.createdAt)}</p>
              <p className='text-sm text-gray-700 whitespace-pre-line'>{a.message}</p>

              <div className='mt-3 flex items-center gap-2'>
                {confirmId === a.id ? (
                  <>
                    <button
                      type='button'
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className='bg-red-600 text-white text-sm font-semibold rounded-lg px-3 py-1 disabled:opacity-60'
                    >
                      {deletingId === a.id ? 'Deleting...' : 'Yes, delete'}
                    </button>
                    <button
                      type='button'
                      onClick={() => setConfirmId('')}
                      className='border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-1'
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type='button'
                    onClick={() => setConfirmId(a.id)}
                    className='border border-gray-300 text-red-600 text-sm font-semibold rounded-lg px-3 py-1'
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminAnnouncements