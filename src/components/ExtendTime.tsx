import { useEffect, useState } from 'react'
import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { closesAtOf, deadlineOf, formatClosing, formatDeadline, phaseOf } from '../utils/deadline'

type Props = {
  assignment: {
    id: string
    dueDate: string
    dueTime: string
    extraHours: number
  }
  onExtended: (newExtraHours: number) => void
}

function ExtendTime({ assignment, onExtended }: Props) {
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  // Re-check the time every 15 seconds so the button unlocks by itself
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  // No due date means there is nothing to extend
  if (!assignment.dueDate || !deadlineOf(assignment)) return null

  const deadlinePassed = phaseOf(assignment, now) !== 'open'

  async function handleSave() {
    setError('')
    if (phaseOf(assignment, Date.now()) === 'open') {
      setError('You can add extra time only after the due time has passed')
      return
    }
    const add = Number(hours)
    if (!Number.isInteger(add) || add < 1) {
      setError('Enter a whole number of hours, at least 1')
      return
    }
    const newTotal = assignment.extraHours + add
    if (newTotal > 168) {
      setError('Total extra time cannot be more than 168 hours')
      return
    }
    const closes = closesAtOf({ ...assignment, extraHours: newTotal })
    if (!closes) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'assignments', assignment.id), {
        extraHours: newTotal,
        closesAt: Timestamp.fromDate(closes),
      })
      onExtended(newTotal)
      setOpen(false)
      setHours('')
    } catch (err) {
      console.error(err)
      setError('Could not add extra time. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div className='mt-3'>
        <button
          type='button'
          disabled={!deadlinePassed}
          onClick={() => setOpen(true)}
          className='border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed'
        >
          Add extra time
        </button>
        {!deadlinePassed && (
          <p className='text-xs text-gray-400 mt-1'>
            Available after the due time ({formatDeadline(assignment)}).
          </p>
        )}
      </div>
    )
  }

  const addNow = Number(hours)
  const preview =
    Number.isInteger(addNow) && addNow >= 1 && assignment.extraHours + addNow <= 168
      ? formatClosing({ ...assignment, extraHours: assignment.extraHours + addNow })
      : ''

  return (
    <div className='mt-3 rounded-lg border border-gray-200 p-3'>
      <label className='block text-sm font-medium text-navy mb-1'>Hours to add</label>
      <input
        type='number'
        min={1}
        max={168}
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        className='w-28 rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'
      />
      {preview && <p className='text-xs text-gray-500 mt-1'>Submissions will close {preview}.</p>}
      {error && <p className='text-sm text-red-600 mt-1'>{error}</p>}
      <div className='mt-2 flex gap-3'>
        <button
          type='button'
          onClick={handleSave}
          disabled={saving}
          className='text-sm font-semibold text-white bg-brand rounded-lg px-3 py-1.5 disabled:opacity-50'
        >
          {saving ? 'Saving...' : 'Add time'}
        </button>
        <button type='button' onClick={() => setOpen(false)} className='text-sm text-gray-500'>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default ExtendTime