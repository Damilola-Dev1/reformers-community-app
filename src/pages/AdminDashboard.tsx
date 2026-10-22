import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'

import { db } from '../firebase'
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
  icon: ReactNode
  className?: string
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      {children}
    </svg>
  )
}

function SyncIcon() {
  return (
    <svg
      width='14'
      height='14'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <polyline points='23 4 23 10 17 10' />
      <polyline points='1 20 1 14 7 14' />
      <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
    </svg>
  )
}

const usersIcon = (
  <Icon>
    <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
    <circle cx='9' cy='7' r='4' />
    <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
    <path d='M16 3.13a4 4 0 0 1 0 7.75' />
  </Icon>
)

const userIcon = (
  <Icon>
    <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
    <circle cx='12' cy='7' r='4' />
  </Icon>
)

const userPlusIcon = (
  <Icon>
    <path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
    <circle cx='8.5' cy='7' r='4' />
    <line x1='20' y1='8' x2='20' y2='14' />
    <line x1='23' y1='11' x2='17' y2='11' />
  </Icon>
)

const clockIcon = (
  <Icon>
    <circle cx='12' cy='12' r='10' />
    <polyline points='12 6 12 12 16 14' />
  </Icon>
)

const giftIcon = (
  <Icon>
    <polyline points='20 12 20 22 4 22 4 12' />
    <rect x='2' y='7' width='20' height='5' />
    <line x1='12' y1='22' x2='12' y2='7' />
    <path d='M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z' />
    <path d='M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z' />
  </Icon>
)

const barChartIcon = (
  <Icon>
    <line x1='18' y1='20' x2='18' y2='10' />
    <line x1='12' y1='20' x2='12' y2='4' />
    <line x1='6' y1='20' x2='6' y2='14' />
  </Icon>
)

function StatCard({ label, value, note, icon, className }: StatCardProps) {
  return (
    <div className={'bg-white rounded-xl shadow p-4 ' + (className ?? '')}>
      <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-navy/10 text-navy mb-3'>
        {icon}
      </div>
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
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)

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
        setSyncedAt(new Date())
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

  const growthMembers = useMemo(() => {
    const list: { date: Date; gender: string }[] = []
    people.forEach((p) => {
      if (p.status === 'approved' && p.createdAt) {
        list.push({ date: p.createdAt, gender: p.gender })
      }
    })
    return list
  }, [people])

  const firstName = profile?.fullName.split(' ')[0] ?? ''
  const greeting = getGreeting()

  function show(n: number): string {
    return loading ? '...' : String(n)
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <div>
          <h1 className='font-display text-3xl font-semibold text-navy'>
            {firstName ? greeting + ', ' + firstName : greeting}
          </h1>
          <p className='text-sm text-gray-500 mt-1 mb-3'>Here is the overview of {settings.name}</p>

          {(loading || (syncedAt && !error)) && (
            <div className='mb-6'>
              <span className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500'>
                <SyncIcon />
                {loading ? 'Syncing...' : 'Synced ' + formatTime(syncedAt as Date)}
              </span>
            </div>
          )}
        </div>

        {error && <p className='text-sm text-red-600 mb-4'>{error}</p>}

        <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
          <StatCard label='Total members' value={show(stats.totalMembers)} note='Approved' icon={usersIcon} />
          <Link to='/admin/members' className='block'>
            <div className='bg-white rounded-xl shadow p-4 h-full border border-orange-200'>
              <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-brand mb-3'>
                {clockIcon}
              </div>
              <p className='text-sm text-gray-500'>Pending approvals</p>
              <p className='font-display text-3xl font-semibold text-brand mt-1'>{show(stats.pending)}</p>
              <p className='text-xs text-gray-400 mt-1'>Tap to review</p>
            </div>
          </Link>
          <StatCard label='Birthdays today' value={show(stats.birthdaysToday)} icon={giftIcon} />
          <StatCard label='Total registered' value={show(stats.totalRegistered)} note='Approved and pending' icon={userPlusIcon} />
          <StatCard label='Males' value={show(stats.males)} note='Approved' icon={userIcon} />
          <StatCard label='Females' value={show(stats.females)} note='Approved' icon={userIcon} />
          <StatCard
            label='Attendance rate'
            value={attendanceCard.value}
            note={attendanceCard.note}
            icon={barChartIcon}
            className='col-span-2'
          />
        </div>

        <div className='mt-6'>
          <MemberGrowthChart members={growthMembers} loading={loading} />
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
          <Link to='/admin/announcements' className='border border-gray-300 bg-white text-navy text-sm font-semibold rounded-lg px-3 py-2'>
            Announcements
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