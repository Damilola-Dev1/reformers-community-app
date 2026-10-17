import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'

type Assignment = {
  id: string
  title: string
  instructions: string
  dueDate: string
}

type Submission = {
  text: string
  link: string
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

function formatWhen(value: Date | null): string {
  if (!value) return ''
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function MemberAssignmentDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      if (!id) {
        setNotFound(true)
        setLoading(false)
        return
      }
      try {
        const uid = auth.currentUser?.uid ?? ''
        const aSnap = await getDoc(doc(db, 'assignments', id))
        if (!aSnap.exists() || aSnap.data().communityId !== settings.communityId) {
          setNotFound(true)
          return
        }
        const a = aSnap.data()
        setAssignment({
          id: aSnap.id,
          title: String(a.title ?? ''),
          instructions: String(a.instructions ?? ''),
          dueDate: String(a.dueDate ?? ''),
        })

        const sSnap = await getDoc(doc(db, 'submissions', id + '_' + uid))
        if (sSnap.exists()) {
          const s = sSnap.data()
          setSubmission({
            text: String(s.text ?? ''),
            link: String(s.link ?? ''),
            createdAt:
              s.createdAt && typeof s.createdAt.toDate === 'function'
                ? (s.createdAt.toDate() as Date)
                : null,
          })
        }
      } catch (err) {
        console.error(err)
        setError('Could not load this assignment. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')

    const uid = auth.currentUser?.uid
    if (!uid || !id) {
      setFormError('Please log in again and retry')
      return
    }

    const cleanText = text.trim()
    const cleanLink = link.trim()
    if (cleanText.length < 2) {
      setFormError('Write your answer before submitting')
      return
    }
    if (cleanLink !== '' && !/^https?:\/\/\S+$/i.test(cleanLink)) {
      setFormError('The link must start with http:// or https://')
      return
    }

    setSaving(true)
    try {
      await setDoc(doc(db, 'submissions', id + '_' + uid), {
        communityId: settings.communityId,
        assignmentId: id,
        memberId: uid,
        memberName: profile?.fullName ?? '',
        text: cleanText,
        link: cleanLink,
        status: 'submitted',
        createdAt: serverTimestamp(),
      })
      setSubmission({ text: cleanText, link: cleanLink, createdAt: new Date() })
    } catch (err) {
      console.error(err)
      setFormError('Could not submit. If you already submitted this assignment, refresh the page.')
    } finally {
      setSaving(false)
    }
  }

  const overdue = assignment !== null && assignment.dueDate !== '' && assignment.dueDate < todayString()

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/member' className='text-sm text-brand'>Back to home</Link>

        {loading && <p className='text-gray-500 mt-4'>Loading...</p>}
        {error && <p className='text-sm text-red-600 mt-4'>{error}</p>}
        {!loading && notFound && <p className='text-gray-500 mt-4'>This assignment was not found.</p>}

        {assignment && (
          <>
            <h1 className='font-display text-3xl font-semibold text-navy mt-2'>{assignment.title}</h1>
            {assignment.dueDate && (
              <p className={'text-sm mt-1 ' + (overdue ? 'text-red-600 font-semibold' : 'text-gray-500')}>
                {overdue ? 'Overdue: was due ' : 'Due '}
                {formatDue(assignment.dueDate)}
              </p>
            )}

            <div className='bg-white rounded-xl shadow p-4 mt-4'>
              <h2 className='font-display text-xl font-semibold text-navy mb-2'>Instructions</h2>
              <p className='text-sm text-gray-700 whitespace-pre-line'>{assignment.instructions}</p>
            </div>

            {submission ? (
              <div className='bg-white rounded-xl shadow p-4 mt-4'>
                <div className='flex items-center justify-between gap-2 mb-2'>
                  <h2 className='font-display text-xl font-semibold text-navy'>Your submission</h2>
                  <span className='text-xs font-semibold rounded-full px-2 py-1 bg-green-100 text-green-700'>Submitted</span>
                </div>
                <p className='text-xs text-gray-400 mb-2'>Sent {formatWhen(submission.createdAt)}</p>
                <p className='text-sm text-gray-700 whitespace-pre-line'>{submission.text}</p>
                {submission.link && (
                  <p className='text-sm mt-3'>
                    <a href={submission.link} target='_blank' rel='noopener noreferrer' className='text-brand break-all'>
                      {submission.link}
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className='bg-white rounded-xl shadow p-4 mt-4'>
                <h2 className='font-display text-xl font-semibold text-navy mb-3'>Your answer</h2>

                <div className='mb-3'>
                  <label className='block text-sm font-medium text-navy mb-1'>Answer</label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={6}
                    className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
                  />
                </div>

                <div className='mb-4'>
                  <label className='block text-sm font-medium text-navy mb-1'>Link (optional)</label>
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder='e.g. a Google Doc link'
                    className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
                  />
                </div>

                {formError && <p className='text-sm text-red-600 mb-3'>{formError}</p>}

                <p className='text-xs text-gray-400 mb-3'>You cannot edit your answer after you submit it.</p>

                <button
                  type='submit'
                  disabled={saving}
                  className='bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-60'
                >
                  {saving ? 'Submitting...' : 'Submit'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MemberAssignmentDetail