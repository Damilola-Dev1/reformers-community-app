import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'
import { formatClosing, formatDeadline, phaseOf } from '../utils/deadline'

type Assignment = {
  id: string
  title: string
  instructions: string
  dueDate: string
  dueTime: string
  extraHours: number
}

type Submission = {
  text: string
  link: string
  status: string
  reviewNote: string
  createdAt: Date | null
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
          dueTime: String(a.dueTime ?? ''),
          extraHours: Number(a.extraHours ?? 0) || 0,
        })

        const sSnap = await getDoc(doc(db, 'submissions', id + '_' + uid))
        if (sSnap.exists()) {
          const s = sSnap.data()
          const loaded: Submission = {
            text: String(s.text ?? ''),
            link: String(s.link ?? ''),
            status: String(s.status ?? 'submitted'),
            reviewNote: String(s.reviewNote ?? ''),
            createdAt:
              s.createdAt && typeof s.createdAt.toDate === 'function'
                ? (s.createdAt.toDate() as Date)
                : null,
          }
          setSubmission(loaded)
          if (loaded.status === 'revision') {
            setText(loaded.text)
            setLink(loaded.link)
          }
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

    const resubmitting = submission !== null && submission.status === 'revision'

    if (!resubmitting && assignment && phaseOf(assignment, Date.now()) === 'closed') {
      setFormError('Submissions for this assignment are closed')
      return
    }

    setSaving(true)
    try {
      if (resubmitting) {
        await updateDoc(doc(db, 'submissions', id + '_' + uid), {
          text: cleanText,
          link: cleanLink,
          status: 'submitted',
          updatedAt: serverTimestamp(),
        })
        setSubmission({
          text: cleanText,
          link: cleanLink,
          status: 'submitted',
          reviewNote: '',
          createdAt: submission ? submission.createdAt : new Date(),
        })
      } else {
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
        setSubmission({ text: cleanText, link: cleanLink, status: 'submitted', reviewNote: '', createdAt: new Date() })
      }
    } catch (err) {
      console.error(err)
      setFormError('Could not submit. Refresh the page and try again.')
    } finally {
      setSaving(false)
    }
  }

  const phase = assignment ? phaseOf(assignment, Date.now()) : 'open'
  const closed = phase === 'closed'
  const needsRevision = submission !== null && submission.status === 'revision'
  const approved = submission !== null && submission.status === 'approved'

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
              <div className='mt-1'>
                <p className={'text-sm ' + (phase === 'open' || approved ? 'text-gray-500' : 'text-red-600 font-semibold')}>
                  {phase === 'open' || approved ? 'Due ' : 'Overdue: was due '}
                  {formatDeadline(assignment)}
                </p>
                {assignment.extraHours > 0 && (
                  <p className='text-xs text-gray-500 mt-1'>
                    {'Extra time of ' + assignment.extraHours + 'h applies to everyone. Submissions close ' + formatClosing(assignment) + '.'}
                  </p>
                )}
              </div>
            )}

            <div className='bg-white rounded-xl shadow p-4 mt-4'>
              <h2 className='font-display text-xl font-semibold text-navy mb-2'>Instructions</h2>
              <p className='text-sm text-gray-700 whitespace-pre-line'>{assignment.instructions}</p>
            </div>

            {phase === 'extra' && !submission && (
              <div className='bg-orange-50 border border-orange-200 rounded-xl p-4 mt-4'>
                <p className='text-sm font-semibold text-orange-700 mb-1'>Extra time is running</p>
                <p className='text-sm text-gray-700'>
                  The deadline has passed, but you can still submit until {formatClosing(assignment)}.
                </p>
              </div>
            )}

            {closed && !submission && (
              <div className='bg-red-50 border border-red-200 rounded-xl p-4 mt-4'>
                <p className='text-sm font-semibold text-red-700 mb-1'>Submissions are closed</p>
                <p className='text-sm text-gray-700'>
                  The deadline and extra time for this assignment have passed. Please speak to the Admin if you need help.
                </p>
              </div>
            )}

            {submission && !needsRevision && (
              <div className='bg-white rounded-xl shadow p-4 mt-4'>
                <div className='flex items-center justify-between gap-2 mb-2'>
                  <h2 className='font-display text-xl font-semibold text-navy'>Your submission</h2>
                  <span
                    className={
                      'text-xs font-semibold rounded-full px-2 py-1 ' +
                      (approved ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')
                    }
                  >
                    {approved ? 'Approved' : 'Submitted'}
                  </span>
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
            )}

            {needsRevision && submission && (
              <div className='bg-orange-50 border border-orange-200 rounded-xl p-4 mt-4'>
                <p className='text-sm font-semibold text-orange-700 mb-1'>Revision requested</p>
                <p className='text-sm text-gray-700 whitespace-pre-line'>{submission.reviewNote}</p>
              </div>
            )}

            {((!submission && !closed) || needsRevision) && (
              <form onSubmit={handleSubmit} noValidate className='bg-white rounded-xl shadow p-4 mt-4'>
                <h2 className='font-display text-xl font-semibold text-navy mb-3'>
                  {needsRevision ? 'Update your answer' : 'Your answer'}
                </h2>

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

                <p className='text-xs text-gray-400 mb-3'>
                  {needsRevision
                    ? 'Submitting sends your updated answer back for review.'
                    : 'You cannot edit your answer after you submit it.'}
                </p>

                <button
                  type='submit'
                  disabled={saving}
                  className='bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-60'
                >
                  {saving ? 'Submitting...' : needsRevision ? 'Resubmit' : 'Submit'}
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