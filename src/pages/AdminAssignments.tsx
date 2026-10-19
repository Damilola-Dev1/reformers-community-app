import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'
import { APP_URL, openWhatsAppShare } from '../config/whatsapp'

type Assignment = {
  id: string
  title: string
  instructions: string
  dueDate: string
  createdAt: Date | null
}

type SubInfo = {
  assignmentId: string
  status: string
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

function formatWhen(value: Date | null): string {
  if (!value) return ''
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function AdminAssignments() {
  const [items, setItems] = useState<Assignment[]>([])
  const [subs, setSubs] = useState<SubInfo[]>([])
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState('')
  const [deletingId, setDeletingId] = useState('')

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
        setItems(loaded)
      } catch (err) {
        console.error(err)
        setError('Could not load assignments. Check your connection and try again.')
        setLoading(false)
        return
      }

      try {
        const subQuery = query(collection(db, 'submissions'), where('communityId', '==', settings.communityId))
        const subSnap = await getDocs(subQuery)
        setSubs(
          subSnap.docs.map((d) => ({
            assignmentId: String(d.data().assignmentId ?? ''),
            status: String(d.data().status ?? 'submitted'),
          }))
        )

        const memberQuery = query(collection(db, 'members'), where('communityId', '==', settings.communityId))
        const memberSnap = await getDocs(memberQuery)
        setMemberCount(memberSnap.docs.filter((d) => d.data().status === 'approved').length)
      } catch (err) {
        console.error(err)
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
    const cleanInstructions = instructions.trim()
    if (cleanTitle.length < 2) {
      setFormError('Enter a title for the assignment')
      return
    }
    if (cleanInstructions.length < 2) {
      setFormError('Write the instructions for the assignment')
      return
    }
    if (dueDate && dueDate < todayString()) {
      setFormError('The due date cannot be in the past')
      return
    }

    setSaving(true)
    try {
      const ref = await addDoc(collection(db, 'assignments'), {
        communityId: settings.communityId,
        title: cleanTitle,
        instructions: cleanInstructions,
        dueDate: dueDate,
        createdAt: serverTimestamp(),
      })
      setItems((prev) => [
        { id: ref.id, title: cleanTitle, instructions: cleanInstructions, dueDate: dueDate, createdAt: new Date() },
        ...prev,
      ])
      setTitle('')
      setInstructions('')
      setDueDate('')
    } catch (err) {
      console.error(err)
      setFormError('Could not post the assignment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setFormError('')
    setDeletingId(id)

    try {
      await deleteDoc(doc(db, 'assignments', id))
      setItems((prev) => prev.filter((a) => a.id !== id))
      setConfirmId('')
    } catch (err) {
      console.error(err)
      setFormError('Could not delete the assignment. Please try again.')
    } finally {
      setDeletingId('')
    }
  }

  function handleNotify() {
    const text =
      'A new assignment has been posted on ' +
      settings.name +
      '. Please log in to the app to check it: ' +
      APP_URL
    openWhatsAppShare(text)
  }

  function progressText(assignmentId: string): string {
    const mine = subs.filter((s) => s.assignmentId === assignmentId)
    const approved = mine.filter((s) => s.status === 'approved').length
    const revision = mine.filter((s) => s.status === 'revision').length
    const total = memberCount === null ? '' : ' of ' + memberCount
    let text = mine.length + total + ' submitted · ' + approved + ' approved'
    if (revision > 0) text += ' · ' + revision + ' need revision'
    return text
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/admin' className='text-sm text-brand'>Back to dashboard</Link>

        <h1 className='font-display text-3xl font-semibold text-navy mt-2'>Assignments</h1>
        <p className='text-sm text-gray-500 mt-1 mb-6'>Every approved member sees these on their home screen</p>

        <form onSubmit={handlePost} noValidate className='bg-white rounded-xl shadow p-4 mb-6'>
          <h2 className='font-display text-xl font-semibold text-navy mb-3'>New assignment</h2>

          <div className='mb-3'>
            <label className='block text-sm font-medium text-navy mb-1'>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. Write on the life of Abraham'
              className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
            />
          </div>

          <div className='mb-3'>
            <label className='block text-sm font-medium text-navy mb-1'>Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
            />
          </div>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-navy mb-1'>Due date (optional)</label>
            <input
              type='date'
              value={dueDate}
              min={todayString()}
              onChange={(e) => setDueDate(e.target.value)}
              className='rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
            />
          </div>

          {formError && <p className='text-sm text-red-600 mb-3'>{formError}</p>}

          <button
            type='submit'
            disabled={saving}
            className='bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-60'
          >
            {saving ? 'Posting...' : 'Post assignment'}
          </button>
        </form>

        <h2 className='font-display text-xl font-semibold text-navy mb-3'>Posted</h2>

        {loading && <p className='text-gray-500'>Loading...</p>}
        {error && <p className='text-sm text-red-600'>{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className='text-gray-500'>No assignments yet.</p>
        )}

        <div className='space-y-3'>
          {items.map((a) => (
            <div key={a.id} className='bg-white rounded-xl shadow p-4'>
              <p className='font-semibold text-navy'>{a.title}</p>
              <p className='text-xs text-gray-400 mb-2'>
                Posted {formatWhen(a.createdAt)}
                {a.dueDate ? ' · Due ' + formatDue(a.dueDate) : ' · No due date'}
              </p>
              <p className='text-sm text-gray-700 whitespace-pre-line'>{a.instructions}</p>
              <p className='text-sm font-semibold text-navy mt-3'>{loading ? '...' : progressText(a.id)}</p>

              <div className='mt-3 flex flex-wrap items-center gap-2'>
                <Link
                  to={'/admin/assignments/' + a.id}
                  className='bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg px-3 py-1'
                >
                  View submissions
                </Link>
                <button
                  type='button'
                  onClick={handleNotify}
                  className='border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-1'
                >
                  Notify group on WhatsApp
                </button>
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

export default AdminAssignments