import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'

type ChartService = {
  id: string
  title: string
  date: string
  finalized: boolean
}

type Mark = {
  serviceId: string
  memberId: string
  status: string
}

type AttendanceChartProps = {
  services: ChartService[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return Number(match[3]) + ' ' + MONTHS[Number(match[2]) - 1]
}

function AttendanceChart({ services }: AttendanceChartProps) {
  const [marks, setMarks] = useState<Mark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          where('communityId', '==', settings.communityId)
        )
        const [memberSnap, attendanceSnap] = await Promise.all([
          getDocs(membersQuery),
          getDocs(attendanceQuery),
        ])

        const approvedIds = new Set(memberSnap.docs.map((d) => d.id))
        const found: Mark[] = []
        attendanceSnap.docs.forEach((d) => {
          const data = d.data()
          const memberId = String(data.memberId ?? '')
          if (approvedIds.has(memberId)) {
            found.push({
              serviceId: String(data.serviceId ?? ''),
              memberId: memberId,
              status: String(data.status ?? ''),
            })
          }
        })
        setMarks(found)
      } catch (err) {
        console.error(err)
        setError('Could not load the attendance chart.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const rows = useMemo(() => {
    const finalized = services
      .filter((s) => s.finalized)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)

    const result: { label: string; percent: number; present: number; total: number; title: string }[] = []
    finalized.forEach((s) => {
      let present = 0
      let total = 0
      marks.forEach((m) => {
        if (m.serviceId === s.id) {
          total += 1
          if (m.status === 'present') present += 1
        }
      })
      if (total > 0) {
        result.push({
          label: shortDate(s.date),
          percent: Math.round((present / total) * 100),
          present: present,
          total: total,
          title: s.title,
        })
      }
    })
    return result
  }, [services, marks])

  return (
    <div className='bg-white rounded-xl shadow p-4 mb-6'>
      <h2 className='font-display text-xl font-semibold text-navy'>Attendance trend</h2>
      <p className='text-xs text-gray-400 mb-3'>
        Percent of approved members present, for the last finalized services
      </p>

      {loading ? (
        <p className='text-sm text-gray-500'>Loading...</p>
      ) : error ? (
        <p className='text-sm text-red-600'>{error}</p>
      ) : rows.length === 0 ? (
        <p className='text-sm text-gray-500'>Finalize a service to see the chart.</p>
      ) : (
        <div className='h-64'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={rows} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
              <XAxis dataKey='label' tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} unit='%' tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [String(value) + '%', 'Attendance']} />
              <Bar dataKey='percent' name='Attendance' fill='#e8590c' radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default AttendanceChart