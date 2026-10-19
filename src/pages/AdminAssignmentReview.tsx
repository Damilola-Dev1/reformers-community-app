import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'
import { deadlineOf, formatDeadline } from '../utils/deadline'

type Assignment = {
  id: string
  title: string
  instructions: string
  dueDate: string
  dueTime: string
  extraHours: number
}

type Sub = {
  id: string
  memberId: string
  memberName: string
  text: string
  link: string
  status: string
  reviewNote: string
  createdAt: Date | null
}

type Person = {
  id: string
  fullName: string
}

function formatWhen(value: Date | null): string {
  if (!value) return ''
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function statusLabel(status: string): string {
  if (status === 'approved') return 'Approved'
  if (status === 'revision') return 'Needs revision'
  return 'Submitted'
}

function statusClass(status: string): string {
  if (status === 'approved') return 'bg-blue-100 text-blue-700'
  if (status === 'revision') return 'bg-orange-100 text-orange-700'
  return 'bg-green-100 text-green-700'
}

function statusOrder(status: string): number {
  if (status === 'submitted') return 0
  if (status === 'revision') return 1
  return 2
}

function AdminAssignmentReview() {
  const { id } = useParams()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [subs, setSubs] = useState<Sub[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actingId, setActingId] = useState('')
  const [noteFor, setNoteFor] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    async function load() {
      if (!id) {
        setNotFound(true)
        setLoading(false)
        return
      }
      try {
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

        const subQuery = query(
          collection(db, 'submissions'),
          where('communityId', '==', settings.communityId),
          where('assignmentId', '==', id)
        )
        const subSnap = await getDocs(subQuery)
        const loadedSubs = subSnap.docs.map((d) => {
          const s = d.data()
          return {
            id: d.id,
            memberId: String(s.memberId ?? ''),
            memberName: String(s.memberName ?? ''),
            text: String(s.text ?? ''),
            link: String(s.link ?? ''),
            status: String(s.status ?? 'submitted'),
            reviewNote: String(s.reviewNote ?? ''),
            createdAt:
              s.createdAt && typeof s.createdAt.toDate === 'function'
                ? (s.createdAt.toDate() as Date)
                : null,
          }
        })
        loadedSubs.sort((x, y) => {
          const byStatus = statusOrder(x.status) - statusOrder(y.status)
          if (byStatus !== 0) return byStatus
          return (y.createdAt?.getTime() ?? 0) - (x.createdAt?.getTime() ?? 0)
        })
        setSubs(loadedSubs)

        const memberQuery = query(collection(db, 'members'), where('communityId', '==', settings.communityId))
        const memberSnap = await getDocs(memberQuery)
        const approved = memberSnap.docs
          .filter((d) => d.data().status === 'approved')
          .map((d) => ({ id: d.id, fullName: String(d.data().fullName ?? '') }))
        approved.sort((x, y) => x.fullName.localeCompare(y.fullName))
        setPeople(approved)
      } catch (err) {
        console.error(err)
        setError('Could not load this assignment. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleApprove(s: Sub) {
    setActionError('')
    setActingId(s.id)
    try {
      await updateDoc(doc(db, 'submissions', s.id), {
        status: 'approved',
        reviewNote: '',
        reviewedAt: serverTimestamp(),
      })
      setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: 'approved', reviewNote: '' } : x)))
      setNoteFor('')
      setNote('')
    } catch (err) {
      console.error(err)
      setActionError('Could not approve. Please try again.')
    } finally {
      setActingId('')
    }
  }

  async function handleRevision(s: Sub) {
    setActionError('')
    const cleanNote = note.trim()
    if (cleanNote.length < 2) {
      setActionError('Write a note telling the member what to improve')
      return
    }
    setActingId(s.id)
    try {
      await updateDoc(doc(db, 'submissions', s.id), {
        status: 'revision',
        reviewNote: cleanNote,
        reviewedAt: serverTimestamp(),
      })
      setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: 'revision', reviewNote: cleanNote } : x)))
      setNoteFor('')
      setNote('')
    } catch (err) {
      console.error(err)
      setActionError('Could not send the revision request. Please try again.')
    } finally {
      setActingId('')
    }
  }

  function isLate(s: Sub): boolean {
    if (!assignment || !s.createdAt) return false
    const deadline = deadlineOf(assignment)
    return deadline !== null && s.createdAt.getTime() > deadline.getTime()
  }

  const submittedIds = new Set(subs.map((s) => s.memberId))
  const notSubmitted = people.filter((p) => !submittedIds.has(p.id))

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/admin/assignments' className='text-sm text-brand'>Back to assignments</Link>

        {loading && <p className='text-gray-500 mt-4'>Loading...</p>}
        {error && <p className='text-sm text-red-600 mt-4'>{error}</p>}
        {!loading && notFound && <p className='text-gray-500 mt-4'>This assignment was not found.</p>}

        {assignment && (
          <>
            <h1 className='font-display text-3xl font-semibold text-navy mt-2'>{assignment.title}</h1>
            <p className='text-sm text-gray-500 mt-1'>
              {assignment.dueDate ? 'Due ' + formatDeadline(assignment) : 'No due date'}
              {assignment.dueDate && assignment.extraHours > 0 ? ' · ' + assignment.extraHours + 'h extra time' : ''}
              {' · '}
              {subs.length} of {people.length} members submitted
            </p>

            <div className='bg-white rounded-xl shadow p-4 mt-4'>
              <h2 className='font-display text-xl font-semibold text-navy mb-2'>Instructions</h2>
              <p className='text-sm text-gray-700 whitespace-pre-line'>{assignment.instructions}</p>
            </div>

            {actionError && <p className='text-sm text-red-600 mt-4'>{actionError}</p>}

            <h2 className='font-display text-xl font-semibold text-navy mt-6 mb-3'>Submissions</h2>
            {subs.length === 0 && <p className='text-gray-500'>No submissions yet.</p>}

            <div className='space-y-3'>
              {subs.map((s) => (
                <div key={s.id} className='bg-white rounded-xl shadow p-4'>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='font-semibold text-navy'>{s.memberName || 'Member'}</p>
                    <span className={'shrink-0 text-xs font-semibold rounded-full px-2 py-1 ' + statusClass(s.status)}>
                      {statusLabel(s.status)}
                    </span>
                  </div>
                  <p className='text-xs text-gray-400 mb-2'>
                    Sent {formatWhen(s.createdAt)}
                    {isLate(s) ? ' · Late (after the deadline)' : ''}
                  </p>
                  <p className='text-sm text-gray-700 whitespace-pre-line'>{s.text}</p>
                  {s.link && (
                    <p className='text-sm mt-3'>
                      <a href={s.link} target='_blank' rel='noopener noreferrer' className='text-brand break-all'>
                        {s.link}
                      </a>
                    </p>
                  )}

                  {s.status === 'revision' && (
                    <div className='mt-3 rounded-lg bg-orange-50 border border-orange-200 p-3'>
                      <p className='text-xs font-semibold text-orange-700 mb-1'>Your note to the member</p>
                      <p className='text-sm text-gray-700 whitespace-pre-line'>{s.reviewNote}</p>
                      <p className='text-xs text-gray-500 mt-2'>Waiting for the member to resubmit.</p>
                    </div>
                  )}

                  {s.status !== 'revision' && (
                    <div className='mt-3'>
                      {noteFor === s.id ? (
                        <div>
                          <label className='block text-sm font-medium text-navy mb-1'>What should the member improve?</label>
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
                          />
                          <div className='mt-2 flex items-center gap-2'>
                            <button
                              type='button'
                              onClick={() => handleRevision(s)}
                              disabled={actingId === s.id}
                              className='bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg px-3 py-1 disabled:opacity-60'
                            >
                              {actingId === s.id ? 'Sending...' : 'Send revision request'}
                            </button>
                            <button
                              type='button'
                              onClick={() => {
                                setNoteFor('')
                                setNote('')
                                setActionError('')
                              }}
                              className='border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-1'
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className='flex items-center gap-2'>
                          {s.status !== 'approved' && (
                            <button
                              type='button'
                              onClick={() => handleApprove(s)}
                              disabled={actingId === s.id}
                              className='bg-green-600 text-white text-sm font-semibold rounded-lg px-3 py-1 disabled:opacity-60'
                            >
                              {actingId === s.id ? 'Approving...' : 'Approve'}
                            </button>
                          )}
                          <button
                            type='button'
                            onClick={() => {
                              setNoteFor(s.id)
                              setNote('')
                              setActionError('')
                            }}
                            className='border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-1'
                          >
                            Request revision
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <h2 className='font-display text-xl font-semibold text-navy mt-6 mb-3'>Not submitted yet</h2>
            {notSubmitted.length === 0 ? (
              <p className='text-gray-500'>Every approved member has submitted.</p>
            ) : (
              <div className='bg-white rounded-xl shadow p-4'>
                <ul className='space-y-1'>
                  {notSubmitted.map((p) => (
                    <li key={p.id} className='text-sm text-gray-700'>{p.fullName}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AdminAssignmentReview