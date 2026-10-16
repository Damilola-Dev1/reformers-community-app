import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'

type Person = {
  id: string
  fullName: string
  phone: string
  dateOfBirth: string
}

type Upcoming = Person & {
  daysUntil: number
  turning: number
  month: number
  day: number
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function nextBirthday(dateOfBirth: string, todayStart: Date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth)
  if (!match) return null

  const birthYear = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const thisYear = todayStart.getFullYear()
  for (const year of [thisYear, thisYear + 1]) {
    const useDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day
    const date = new Date(year, month - 1, useDay)

    if (date.getTime() >= todayStart.getTime()) {
      const daysUntil = Math.round((date.getTime() - todayStart.getTime()) / 86400000)
      return { daysUntil, turning: year - birthYear, month, day: useDay }
    }
  }

  return null
}

function whatsappLink(phone: string, fullName: string): string {
  let digits = phone.trim()
  if (digits.startsWith('+')) {
    digits = digits.slice(1)
  } else if (digits.startsWith('0')) {
    digits = '234' + digits.slice(1)
  }
  digits = digits.replace(/[^0-9]/g, '')

  const firstName = fullName.split(' ')[0]
  const text = 'Happy birthday, ' + firstName + '! Everyone at ' + settings.name + ' is celebrating you today.'
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text)
}

function AdminBirthdays() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, 'members'),
          where('communityId', '==', settings.communityId),
          where('status', '==', 'approved')
        )
        const snap = await getDocs(q)
        setPeople(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              fullName: String(data.fullName ?? ''),
              phone: String(data.phone ?? ''),
              dateOfBirth: String(data.dateOfBirth ?? ''),
            }
          })
        )
      } catch (err) {
        console.error(err)
        setError('Could not load birthdays. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const result = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const upcoming: Upcoming[] = []

    let skipped = 0
    for (const p of people) {
      const next = nextBirthday(p.dateOfBirth, todayStart)
      if (next === null) {
        skipped += 1
      } else {
        upcoming.push({ ...p, ...next })
      }
    }

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil)

    return {
      skipped,
      today: upcoming.filter((u) => u.daysUntil === 0),
      thisWeek: upcoming.filter((u) => u.daysUntil >= 1 && u.daysUntil <= 7),
      later: upcoming.filter((u) => u.daysUntil > 7),
      total: upcoming.length,
    }
  }, [people])

  function renderGroup(title: string, items: Upcoming[], highlight: boolean) {
    if (items.length === 0) return null

    return (
      <div className='mb-6'>
        <h2 className='font-display text-xl font-semibold text-navy mb-3'>{title}</h2>
        <div className='space-y-3'>
          {items.map((u) => (
            <div
              key={u.id}
              className={
                highlight
                  ? 'bg-white rounded-xl shadow p-4 flex items-center justify-between gap-3 border border-orange-300'
                  : 'bg-white rounded-xl shadow p-4 flex items-center justify-between gap-3'
              }
            >
              <div className='min-w-0'>
                <p className='font-semibold text-navy truncate'>{u.fullName}</p>
                <p className='text-sm text-gray-500'>
                  {u.day} {monthNames[u.month - 1]}, turning {u.turning}
                </p>
                <p className='text-xs text-gray-400'>
                  {u.daysUntil === 0 ? 'Today' : u.daysUntil === 1 ? 'Tomorrow' : 'In ' + u.daysUntil + ' days'}
                </p>
              </div>
              <a
                href={whatsappLink(u.phone, u.fullName)}
                target='_blank'
                rel='noreferrer'
                className='shrink-0 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg px-3 py-1'
              >
                Send greeting
              </a>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/admin' className='text-sm text-brand'>Back to dashboard</Link>

        <h1 className='font-display text-3xl font-semibold text-navy mt-2'>Birthdays</h1>
        <p className='text-sm text-gray-500 mt-1 mb-6'>Approved members, soonest first</p>

        {loading && <p className='text-gray-500'>Loading...</p>}
        {error && <p className='text-sm text-red-600'>{error}</p>}

        {!loading && !error && result.total === 0 && (
          <p className='text-gray-500'>No birthdays to show yet.</p>
        )}

        {!loading && !error && (
          <div>
            {renderGroup('Today', result.today, true)}
            {renderGroup('This week', result.thisWeek, false)}
            {renderGroup('Coming later', result.later, false)}
          </div>
        )}

        {!loading && !error && result.skipped > 0 && (
          <p className='text-xs text-gray-400'>
            {result.skipped} approved member(s) have no valid date of birth and are not listed.
          </p>
        )}
      </div>
    </div>
  )
}

export default AdminBirthdays