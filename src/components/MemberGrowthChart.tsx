import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type GrowthMember = {
  date: Date
  gender: string
}

type MemberGrowthChartProps = {
  members: GrowthMember[]
  loading: boolean
}

function MemberGrowthChart({ members, loading }: MemberGrowthChartProps) {
  const data = useMemo(() => {
    const dated = members.filter((m) => m.gender === 'male' || m.gender === 'female')
    if (dated.length === 0) return []

    const male = new Map<number, number>()
    const female = new Map<number, number>()
    let earliest = Infinity
    let latest = -Infinity

    dated.forEach((m) => {
      const key = m.date.getFullYear() * 4 + Math.floor(m.date.getMonth() / 3)
      const target = m.gender === 'male' ? male : female
      target.set(key, (target.get(key) ?? 0) + 1)
      if (key < earliest) earliest = key
      if (key > latest) latest = key
    })

    const now = new Date()
    const currentKey = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3)
    const last = Math.max(currentKey, latest)

    const rows: { label: string; Male: number; Female: number }[] = []
    let runningMale = 0
    let runningFemale = 0
    for (let key = earliest; key <= last; key++) {
      runningMale += male.get(key) ?? 0
      runningFemale += female.get(key) ?? 0
      const year = Math.floor(key / 4)
      const quarter = (key % 4) + 1
      rows.push({
        label: 'Q' + quarter + ' ' + String(year).slice(2),
        Male: runningMale,
        Female: runningFemale,
      })
    }
    return rows
  }, [members])

  return (
    <div className='bg-white rounded-xl shadow p-4'>
      <h2 className='font-display text-xl font-semibold text-navy'>Member growth</h2>
      <p className='text-xs text-gray-400 mb-3'>
        Approved members, running total by quarter of registration, male and female
      </p>

      {loading ? (
        <p className='text-sm text-gray-500'>Loading...</p>
      ) : data.length === 0 ? (
        <p className='text-sm text-gray-500'>No registration dates yet.</p>
      ) : (
        <div className='h-64'>
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
              <XAxis dataKey='label' tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type='monotone'
                dataKey='Male'
                stroke='#1e3a5f'
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type='monotone'
                dataKey='Female'
                stroke='#e8590c'
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default MemberGrowthChart