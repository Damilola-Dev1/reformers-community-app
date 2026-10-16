import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'
import NextMeeting from '../components/NextMeeting'
import MemberGrowthChart from '../components/MemberGrowthChart'

type Person = {
  id: string
  status: 'pending' | 'approved'
  gender: string
  dateOfBirth: string
  createdAt: Date | null
}

type AttendanceStats = {
  present: number
  total: number
  services: number
}

type StatCardProps = {
  label: string
  value: string
  note?: string
}

function StatCard({ label, value, note }: StatCardProps) {
  return (
    <div className='bg-white rounded-xl shadow p-4'>
      <p className='text-sm text-gray-500'>{label}</p>
      <p className='font-display text-3xl font-semibold text-navy mt-1'>{value}</p>
      {note && <p className='text-xs text-gray-400 mt-1'>{note}</p>}
    </div>
  )
}

function AdminDashboard() {
  const { profile } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null)
  const [attendanceError, setAttendanceError] = useState(false)

  useEffect(() => {
    async function load() {
      let approvedIds = new Set<string>()

      try {
        const q = query(collection(db, 'members'), where('communityId', '==', settings.communityId))
        const snap = await getDocs(q)
        const loaded = snap.docs.map((d) => {
          const data = d.data()
          const created =
            data.createdAt && typeof data.createdAt.toDate === 'function'
              ? (data.createdAt.toDate() as Date)
              : null
          return {
            id: d.id,
            status: data.status === 'approved' ? 'approved' : 'pending',
            gender: String(data.gender ?? ''),
            dateOfBirth: String(data.dateOfBirth ?? ''),
            createdAt: created,
          } as Person
        })
        setPeople(loaded)
        approvedIds = new Set(loaded.filter((p) => p.status === 'approved').map((p) => p.id))
      } catch (err) {
        console.error(err)
        setError('Could not load the numbers. Check your connection and try again.')
        setLoading(false)
        return
      }

      try {
        const servicesQuery = query(
          collection(db, 'services'),
          where('communityId', '==', settings.communityId),
          where('finalized', '==', true)
        )
        const servicesSnap = await getDocs(servicesQuery)
        const finalizedIds = new Set(servicesSnap.docs.map((d) => d.id))

        if (finalizedIds.size === 0) {
          setAttendance({ present: 0, total: 0, services: 0 })
        } else {
          const attendanceQuery = query(
            collection(db, 'attendance'),
            where('communityId', '==', settings.communityId)
          )
          const attendanceSnap = await getDocs(attendanceQuery)

          let present = 0
          let total = 0
          attendanceSnap.docs.forEach((d) => {
            const data = d.data()
            if (finalizedIds.has(String(data.serviceId ?? '')) && approvedIds.has(String(data.memberId ?? ''))) {
              total += 1
              if (data.status === 'present') present += 1
            }
          })
          setAttendance({ present, total, services: finalizedIds.size })
        }
      } catch (err) {
        console.error(err)
        setAttendanceError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const todayMonthDay = month + '-' + day

    const approved = people.filter((p) => p.status === 'approved')

    return {
      totalMembers: approved.length,
      pending: people.filter((p) => p.status === 'pending').length,
      birthdaysToday: approved.filter((p) => p.dateOfBirth.slice(5) === todayMonthDay).length,
      totalRegistered: people.length,
      males: approved.filter((p) => p.gender === 'male').length,
      females: approved.filter((p) => p.gender === 'female').length,
    }
  }, [people])

  const attendanceCard = useMemo(() => {
    if (loading) return { value: '...', note: '' }
    if (attendanceError) return { value: '-', note: 'Could not load attendance' }
    if (!attendance || attendance.total === 0) {
      return { value: '-', note: 'Finalize a service to see this' }
    }

    const percent = Math.round((attendance.present / attendance.total) * 100)
    const word = attendance.services === 1 ? 'service' : 'services'
    return { value: percent + '%', note: 'Across ' + attendance.services + ' finalized ' + word }
  }, [loading, attendanceError, attendance])

  const memberDates = useMemo(() => {
    const dates: Date[] = []
    people.forEach((p) => {
      if (p.status === 'approved' && p.createdAt) dates.push(p.createdAt)
    })
    return dates
  }, [people])

  const firstName = profile?.fullName.split(' ')[0] ?? ''

  function show(n: number): string {
    return loading ? '...' : String(n)
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h1 className='font-display text-3xl font-semibold text-navy'>
              {firstName ? 'Welcome, ' + firstName : 'Welcome'}
            </h1>
            <p className='text-sm text-gray-500 mt-1 mb-6'>{settings.name} admin dashboard</p>
          </div>
          <button
            type='button'
            onClick={() => signOut(auth)}
            className='border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-1'
          >
            Log out
          </button>
        </div>

        {error && <p className='text-sm text-red-600 mb-4'>{error}</p>}

        <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
          <StatCard label='Total members' value={show(stats.totalMembers)} note='Approved' />
          <Link to='/admin/members' className='block'>
            <div className='bg-white rounded-xl shadow p-4 h-full border border-orange-200'>
              <p className='text-sm text-gray-500'>Pending approvals</p>
              <p className='font-display text-3xl font-semibold text-brand mt-1'>{show(stats.pending)}</p>
              <p className='text-xs text-gray-400 mt-1'>Tap to review</p>
            </div>
          </Link>
          <StatCard label='Birthdays today' value={show(stats.birthdaysToday)} />
          <StatCard label='Total registered' value={show(stats.totalRegistered)} note='Approved and pending' />
          <StatCard label='Males' value={show(stats.males)} note='Approved' />
          <StatCard label='Females' value={show(stats.females)} note='Approved' />
          <StatCard label='Attendance rate' value={attendanceCard.value} note={attendanceCard.note} />
        </div>

        <div className='mt-6'>
          <MemberGrowthChart dates={memberDates} loading={loading} />
        </div>

        <div className='mt-6'>
          <NextMeeting />
        </div>

        <h2 className='font-display text-xl font-semibold text-navy mt-8 mb-3'>Manage</h2>
        <div className='flex flex-wrap gap-2'>
          <Link to='/admin/members' className='bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg px-3 py-2'>
            Members
          </Link>
          <Link to='/admin/birthdays' className='border border-gray-300 bg-white text-navy text-sm font-semibold rounded-lg px-3 py-2'>
            Birthdays
          </Link>
          <Link to='/admin/attendance' className='border border-gray-300 bg-white text-navy text-sm font-semibold rounded-lg px-3 py-2'>
            Attendance
          </Link>
          <Link to='/admin/assignments' className='border border-gray-300 bg-white text-navy text-sm font-semibold rounded-lg px-3 py-2'>
            Assignments
          </Link>
          <Link to='/admin/exports' className='border border-gray-300 bg-white text-navy text-sm font-semibold rounded-lg px-3 py-2'>
            Exports
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard