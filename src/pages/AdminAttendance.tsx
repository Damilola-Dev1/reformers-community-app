import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'

type Service = {
  id: string
  title: string
  date: string
  finalized: boolean
  createdAt: string
}

type Status = 'present' | 'absent'

type Person = {
  id: string
  fullName: string
}

function todayLocal(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return now.getFullYear() + '-' + month + '-' + day
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function ServiceDetail({ service, onBack }: { service: Service; onBack: () => void }) {
  const [people, setPeople] = useState<Person[]>([])
  const [marks, setMarks] = useState<Record<string, Status>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const membersQuery = query(
          collection(db, 'members'),
          where('communityId', '==', settings.communityId),
          where('status', '==', 'approved')
        )
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('communityId', '==', settings.communityId),
          where('serviceId', '==', service.id)
        )
        const [memberSnap, attendanceSnap] = await Promise.all([
          getDocs(membersQuery),
          getDocs(attendanceQuery),
        ])

        setPeople(
          memberSnap.docs.map((d) => ({
            id: d.id,
            fullName: String(d.data().fullName ?? ''),
          }))
        )

        const found: Record<string, Status> = {}
        attendanceSnap.docs.forEach((d) => {
          const data = d.data()
          found[String(data.memberId ?? '')] = data.status === 'present' ? 'present' : 'absent'
        })
        setMarks(found)
      } catch (err) {
        console.error(err)
        setError('Could not load this service. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [service.id])

  const sortedPeople = useMemo(() => {
    return [...people].sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [people])

  async function mark(memberId: string, status: Status) {
    if (service.finalized) return
    setActionError('')
    setBusyId(memberId)

    try {
      await setDoc(doc(db, 'attendance', service.id + '_' + memberId), {
        communityId: settings.communityId,
        serviceId: service.id,
        memberId: memberId,
        status: status,
        markedBy: 'admin',
        markedAt: serverTimestamp(),
      })
      setMarks((prev) => ({ ...prev, [memberId]: status }))
    } catch (err) {
      console.error(err)
      setActionError('Could not save this mark. Please try again.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <button type='button' onClick={onBack} className='text-sm text-brand'>
          Back to services
        </button>

        <h1 className='font-display text-3xl font-semibold text-navy mt-2'>{service.title}</h1>
        <p className='text-sm text-gray-500 mt-1 mb-6'>{formatDate(service.date)}</p>

        {service.finalized && (
          <p className='text-sm text-green-700 bg-green-50 rounded-lg p-3 mb-4'>
            This service is finalized and locked.
          </p>
        )}

        {loading && <p className='text-gray-500'>Loading...</p>}
        {error && <p className='text-sm text-red-600'>{error}</p>}
        {actionError && <p className='text-sm text-red-600 mb-3'>{actionError}</p>}

        {!loading && !error && sortedPeople.length === 0 && (
          <p className='text-gray-500'>No approved members yet.</p>
        )}

        <div className='space-y-3'>
          {sortedPeople.map((p) => {
            const current = marks[p.id]
            const busy = busyId === p.id
            const locked = service.finalized || busy
            return (
              <div key={p.id} className='bg-white rounded-xl shadow p-4 flex items-center justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='font-semibold text-navy truncate'>{p.fullName}</p>
                  <p className='text-xs text-gray-400'>
                    {current === 'present' ? 'Present' : current === 'absent' ? 'Absent' : 'Not marked'}
                  </p>
                </div>
                <div className='shrink-0 flex gap-2'>
                  <button
                    type='button'
                    onClick={() => mark(p.id, 'present')}
                    disabled={locked}
                    className={
                      current === 'present'
                        ? 'text-sm font-semibold rounded-lg px-3 py-1 bg-green-600 text-white disabled:opacity-60'
                        : 'text-sm font-semibold rounded-lg px-3 py-1 border border-gray-300 text-navy disabled:opacity-60'
                    }
                  >
                    Present
                  </button>
                  <button
                    type='button'
                    onClick={() => mark(p.id, 'absent')}
                    disabled={locked}
                    className={
                      current === 'absent'
                        ? 'text-sm font-semibold rounded-lg px-3 py-1 bg-red-600 text-white disabled:opacity-60'
                        : 'text-sm font-semibold rounded-lg px-3 py-1 border border-gray-300 text-navy disabled:opacity-60'
                    }
                  >
                    Absent
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AdminAttendance() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [openService, setOpenService] = useState<Service | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'services'), where('communityId', '==', settings.communityId))
        const snap = await getDocs(q)
        setServices(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              title: String(data.title ?? ''),
              date: String(data.date ?? ''),
              finalized: data.finalized === true,
              createdAt:
                data.createdAt && typeof data.createdAt.toDate === 'function'
                  ? data.createdAt.toDate().toISOString()
                  : '',
            }
          })
        )
      } catch (err) {
        console.error(err)
        setError('Could not load services. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const sorted = useMemo(() => {
    return [...services].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [services])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')

    const cleanTitle = title.trim()
    if (cleanTitle.length < 2) {
      setFormError('Enter a title, for example Sunday Service')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError('Choose the date of the service')
      return
    }

    setSaving(true)
    try {
      const ref = await addDoc(collection(db, 'services'), {
        communityId: settings.communityId,
        title: cleanTitle,
        date: date,
        finalized: false,
        createdAt: serverTimestamp(),
      })
      setServices((prev) => [
        { id: ref.id, title: cleanTitle, date: date, finalized: false, createdAt: new Date().toISOString() },
        ...prev,
      ])
      setTitle('')
    } catch (err) {
      console.error(err)
      setFormError('Could not create the service. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (openService) {
    return <ServiceDetail service={openService} onBack={() => setOpenService(null)} />
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/admin' className='text-sm text-brand'>Back to dashboard</Link>

        <h1 className='font-display text-3xl font-semibold text-navy mt-2'>Attendance</h1>
        <p className='text-sm text-gray-500 mt-1 mb-6'>Create a service, then mark who was present</p>

        <form onSubmit={handleCreate} noValidate className='bg-white rounded-xl shadow p-4 mb-6'>
          <h2 className='font-display text-xl font-semibold text-navy mb-3'>New service</h2>

          <div className='mb-3'>
            <label className='block text-sm font-medium text-navy mb-1'>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. Sunday Service'
              className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
            />
          </div>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-navy mb-1'>Date</label>
            <input
              type='date'
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
            />
          </div>

          {formError && <p className='text-sm text-red-600 mb-3'>{formError}</p>}

          <button
            type='submit'
            disabled={saving}
            className='bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 disabled:opacity-60'
          >
            {saving ? 'Creating...' : 'Create service'}
          </button>
        </form>

        <h2 className='font-display text-xl font-semibold text-navy mb-3'>Services</h2>

        {loading && <p className='text-gray-500'>Loading...</p>}
        {error && <p className='text-sm text-red-600'>{error}</p>}

        {!loading && !error && sorted.length === 0 && (
          <p className='text-gray-500'>No services yet. Create the first one above.</p>
        )}

        <div className='space-y-3'>
          {sorted.map((s) => (
            <button
              key={s.id}
              type='button'
              onClick={() => setOpenService(s)}
              className='w-full text-left bg-white rounded-xl shadow p-4 flex items-center justify-between gap-3'
            >
              <div className='min-w-0'>
                <p className='font-semibold text-navy truncate'>{s.title}</p>
                <p className='text-sm text-gray-500'>{formatDate(s.date)}</p>
              </div>
              <span
                className={
                  s.finalized
                    ? 'shrink-0 text-xs font-semibold rounded-full px-2 py-1 bg-green-100 text-green-700'
                    : 'shrink-0 text-xs font-semibold rounded-full px-2 py-1 bg-orange-100 text-orange-700'
                }
              >
                {s.finalized ? 'Finalized' : 'Open'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminAttendance