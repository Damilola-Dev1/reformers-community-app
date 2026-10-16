import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'

type NextService = {
  id: string
  title: string
  date: string
}

type Mark = 'none' | 'present' | 'absent'

function todayLocal(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return now.getFullYear() + '-' + month + '-' + day
}

function parseLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function formatDate(value: string): string {
  const date = parseLocal(value)
  if (!date) return value
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function whenLabel(value: string): string {
  const date = parseLocal(value)
  const today = parseLocal(todayLocal())
  if (!date || !today) return ''
  const days = Math.round((date.getTime() - today.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return 'In ' + days + ' days'
}

function NextMeeting() {
  const { user } = useAuth()
  const [service, setService] = useState<NextService | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [mark, setMark] = useState<Mark>('none')
  const [detailsError, setDetailsError] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const uid = user ? user.uid : ''

  useEffect(() => {
    async function load() {
      let found: NextService | null = null

      try {
        const q = query(
          collection(db, 'services'),
          where('communityId', '==', settings.communityId),
          where('finalized', '==', false)
        )
        const snap = await getDocs(q)
        const today = todayLocal()
        const upcoming = snap.docs
          .map((d) => ({
            id: d.id,
            title: String(d.data().title ?? ''),
            date: String(d.data().date ?? ''),
          }))
          .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && s.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
        found = upcoming.length > 0 ? upcoming[0] : null
        setService(found)
      } catch (err) {
        console.error(err)
        setError('Could not load the next meeting. Check your connection and refresh.')
        setLoading(false)
        return
      }

      if (found && uid) {
        try {
          const linkSnap = await getDoc(doc(db, 'communitySettings', settings.communityId))
          const value = linkSnap.exists() ? linkSnap.data().meetingLink : ''
          setLink(typeof value === 'string' ? value : '')

          const markQuery = query(
            collection(db, 'attendance'),
            where('memberId', '==', uid),
            where('serviceId', '==', found.id)
          )
          const markSnap = await getDocs(markQuery)
          if (!markSnap.empty) {
            setMark(markSnap.docs[0].data().status === 'present' ? 'present' : 'absent')
          }
        } catch (err) {
          console.error(err)
          setDetailsError('Could not check the meeting link or your attendance. Refresh to try again.')
        }
      }

      setLoading(false)
    }

    load()
  }, [uid])

  const isToday = service !== null && service.date === todayLocal()
  const hasLink = link.startsWith('https://')

  async function handleJoin() {
    if (!service || !uid || !isToday || !hasLink) return

    setJoinError('')
    setJoining(true)
    const win = window.open('', '_blank')

    try {
      if (mark === 'none') {
        await setDoc(doc(db, 'attendance', service.id + '_' + uid), {
          communityId: settings.communityId,
          serviceId: service.id,
          memberId: uid,
          status: 'present',
          markedBy: 'member',
          markedAt: serverTimestamp(),
        })
        setMark('present')
      }
      if (win) {
        win.opener = null
        win.location.href = link
      } else {
        window.location.href = link
      }
    } catch (err) {
      console.error(err)
      if (win) win.close()
      setJoinError('Could not record your attendance, so the link was not opened. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  let hint = ''
  if (service && !isToday) {
    hint = 'Join opens on the day of the meeting.'
  } else if (service && !hasLink) {
    hint = 'The meeting link has not been set yet. Please check back soon.'
  }

  return (
    <div className='bg-white rounded-xl shadow p-4'>
      <h2 className='font-display text-xl font-semibold text-navy mb-3'>Next meeting</h2>

      {loading && <p className='text-gray-500 text-sm'>Loading...</p>}
      {error && <p className='text-sm text-red-600'>{error}</p>}

      {!loading && !error && !service && (
        <p className='text-gray-500 text-sm'>No upcoming meeting yet.</p>
      )}

      {!loading && !error && service && (
        <div>
          <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0'>
              <p className='font-semibold text-navy truncate'>{service.title}</p>
              <p className='text-sm text-gray-500'>{formatDate(service.date)}</p>
            </div>
            <span className='shrink-0 text-xs font-semibold rounded-full px-2 py-1 bg-orange-100 text-orange-700'>
              {whenLabel(service.date)}
            </span>
          </div>

          {mark === 'present' && (
            <p className='text-sm text-green-700 bg-green-50 rounded-lg p-2 mt-3'>You are marked present.</p>
          )}
          {mark === 'absent' && (
            <p className='text-sm text-red-700 bg-red-50 rounded-lg p-2 mt-3'>
              You are marked absent for this meeting. Please ask a leader to correct it.
            </p>
          )}

          {detailsError && <p className='text-sm text-red-600 mt-3'>{detailsError}</p>}
          {joinError && <p className='text-sm text-red-600 mt-3'>{joinError}</p>}
          {hint && <p className='text-xs text-gray-500 mt-3'>{hint}</p>}

          <button
            type='button'
            onClick={handleJoin}
            disabled={joining || !isToday || !hasLink || detailsError !== ''}
            className='mt-3 w-full bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2 disabled:opacity-60'
          >
            {joining ? 'Joining...' : mark === 'present' ? 'Open meeting again' : 'Join meeting'}
          </button>
        </div>
      )}
    </div>
  )
}

export default NextMeeting