import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type MemberGrowthChartProps = {
  dates: Date[]
  loading: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function MemberGrowthChart({ dates, loading }: MemberGrowthChartProps) {
  const data = useMemo(() => {
    if (dates.length === 0) return []

    const counts = new Map<number, number>()
    let earliest = Infinity
    let latest = -Infinity

    dates.forEach((d) => {
      const key = d.getFullYear() * 12 + d.getMonth()
      counts.set(key, (counts.get(key) ?? 0) + 1)
      if (key < earliest) earliest = key
      if (key > latest) latest = key
    })

    const now = new Date()
    const currentKey = now.getFullYear() * 12 + now.getMonth()
    const last = Math.max(currentKey, latest)

    const rows: { label: string; total: number }[] = []
    let running = 0
    for (let key = earliest; key <= last; key++) {
      running += counts.get(key) ?? 0
      const year = Math.floor(key / 12)
      const month = key % 12
      rows.push({ label: MONTHS[month] + ' ' + String(year).slice(2), total: running })
    }
    return rows
  }, [dates])

  return (
    <div className='bg-white rounded-xl shadow p-4'>
      <h2 className='font-display text-xl font-semibold text-navy'>Member growth</h2>
      <p className='text-xs text-gray-400 mb-3'>Approved members, running total by month of registration</p>

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
              <Line
                type='monotone'
                dataKey='total'
                name='Members'
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