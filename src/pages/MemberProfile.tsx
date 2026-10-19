import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../auth/useAuth'

type Details = {
  fullName: string
  email: string
  phone: string
  gender: string
  dateOfBirth: string
  location: string
  maritalStatus: string
  occupation: string
  bornAgain: string
  holySpirit: string
  howHeard: string
  expectations: string
  walkWithGod: string
}

type EditForm = {
  fullName: string
  phone: string
  location: string
  maritalStatus: string
  occupation: string
}

type EditErrors = Partial<Record<keyof EditForm, string>>

const baseField = 'w-full rounded-lg border px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'

function validate(form: EditForm): EditErrors {
  const found: EditErrors = {}

  if (form.fullName.trim().length < 2) {
    found.fullName = 'Enter your full name'
  }

  if (!/^[+]?[0-9]{10,15}$/.test(form.phone.trim())) {
    found.phone = 'Enter 10 to 15 digits, with an optional + at the start'
  }

  if (form.location.trim().length < 2) {
    found.location = 'Enter your city and country'
  }

  if (form.maritalStatus === '') {
    found.maritalStatus = 'Select your marital status'
  }

  return found
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className='py-2 border-b border-gray-100 last:border-b-0'>
      <p className='text-xs text-gray-400'>{label}</p>
      <p className='text-sm text-navy'>{value === '' ? '-' : value}</p>
    </div>
  )
}

function MemberProfile() {
  const { user, reload } = useAuth()
  const uid = user ? user.uid : ''

  const [details, setDetails] = useState<Details | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm>({
    fullName: '',
    phone: '',
    location: '',
    maritalStatus: '',
    occupation: '',
  })
  const [errors, setErrors] = useState<EditErrors>({})
  const [saveError, setSaveError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }

    async function load() {
      try {
        const snap = await getDoc(doc(db, 'members', uid))
        if (snap.exists()) {
          const d = snap.data()
          setDetails({
            fullName: String(d.fullName ?? ''),
            email: String(d.email ?? ''),
            phone: String(d.phone ?? ''),
            gender: String(d.gender ?? ''),
            dateOfBirth: String(d.dateOfBirth ?? ''),
            location: String(d.location ?? ''),
            maritalStatus: String(d.maritalStatus ?? ''),
            occupation: String(d.occupation ?? ''),
            bornAgain: String(d.bornAgain ?? ''),
            holySpirit: String(d.holySpirit ?? ''),
            howHeard: String(d.howHeard ?? ''),
            expectations: String(d.expectations ?? ''),
            walkWithGod: String(d.walkWithGod ?? ''),
          })
        } else {
          setError('Your profile could not be found.')
        }
      } catch (err) {
        console.error(err)
        setError('Could not load your profile. Check your connection and refresh.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [uid])

  function openEdit() {
    if (!details) return
    setForm({
      fullName: details.fullName,
      phone: details.phone,
      location: details.location,
      maritalStatus: details.maritalStatus,
      occupation: details.occupation,
    })
    setErrors({})
    setSaveError('')
    setMessage('')
    setEditing(true)
  }

  function closeEdit() {
    setEditing(false)
    setErrors({})
    setSaveError('')
  }

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function fieldClass(name: keyof EditForm) {
    return errors[name] ? baseField + ' border-red-500' : baseField + ' border-gray-300'
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!details || !uid) return

    const found = validate(form)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }

    setErrors({})
    setSaveError('')
    setSaving(true)

    const changes = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      maritalStatus: form.maritalStatus,
      occupation: form.occupation.trim(),
    }

    try {
      await updateDoc(doc(db, 'members', uid), changes)
      setDetails({ ...details, ...changes })
      await reload()
      setEditing(false)
      setMessage('Your profile has been updated.')
    } catch (err) {
      console.error(err)
      setSaveError('Could not save your changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/member' className='text-sm text-brand'>Back to home</Link>

        <h1 className='font-display text-3xl font-semibold text-navy mt-2'>My profile</h1>
        <p className='text-sm text-gray-500 mt-1 mb-6'>Only you and the community leaders can see this.</p>

        {loading && <p className='text-gray-500'>Loading...</p>}
        {error && <p className='text-sm text-red-600'>{error}</p>}
        {message && <p className='text-sm text-green-700 bg-green-50 rounded-lg p-3 mb-4'>{message}</p>}

        {!loading && !error && details && !editing && (
          <div className='bg-white rounded-xl shadow p-4'>
            <Row label='Full name' value={details.fullName} />
            <Row label='Email' value={details.email} />
            <Row label='WhatsApp number' value={details.phone} />
            <Row label='Gender' value={details.gender} />
            <Row label='Date of birth' value={details.dateOfBirth} />
            <Row label='Location' value={details.location} />
            <Row label='Marital status' value={details.maritalStatus} />
            <Row label='Occupation' value={details.occupation} />
            <Row label='Born again' value={details.bornAgain} />
            <Row label='Received the Holy Spirit' value={details.holySpirit} />
            <Row label='How you heard about us' value={details.howHeard} />
            <Row label='Your expectations' value={details.expectations} />
            <Row label='Your walk with God' value={details.walkWithGod} />

            <button
              type='button'
              onClick={openEdit}
              className='mt-4 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2'
            >
              Edit my details
            </button>
            <p className='text-xs text-gray-400 mt-3'>
              To change your email, gender or date of birth, please ask a leader.
            </p>
          </div>
        )}

        {!loading && !error && details && editing && (
          <form onSubmit={handleSave} noValidate className='bg-white rounded-xl shadow p-4'>
            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Full name</label>
              <input name='fullName' value={form.fullName} onChange={handleChange} className={fieldClass('fullName')} />
              {errors.fullName && <p className='text-sm text-red-600 mt-1'>{errors.fullName}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>WhatsApp number</label>
              <input name='phone' type='tel' value={form.phone} onChange={handleChange} className={fieldClass('phone')} />
              {errors.phone && <p className='text-sm text-red-600 mt-1'>{errors.phone}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Location (city and country)</label>
              <input name='location' value={form.location} onChange={handleChange} className={fieldClass('location')} />
              {errors.location && <p className='text-sm text-red-600 mt-1'>{errors.location}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Marital status</label>
              <select name='maritalStatus' value={form.maritalStatus} onChange={handleChange} className={fieldClass('maritalStatus')}>
                <option value=''>Select one</option>
                <option value='single'>Single</option>
                <option value='married'>Married</option>
              </select>
              {errors.maritalStatus && <p className='text-sm text-red-600 mt-1'>{errors.maritalStatus}</p>}
            </div>

            <div className='mb-6'>
              <label className='block text-sm font-medium text-navy mb-1'>Occupation (optional)</label>
              <input name='occupation' value={form.occupation} onChange={handleChange} className={fieldClass('occupation')} />
            </div>

            {saveError && <p className='text-sm text-red-600 mb-3'>{saveError}</p>}

            <div className='flex gap-3'>
              <button
                type='button'
                onClick={closeEdit}
                disabled={saving}
                className='w-1/3 border border-gray-300 text-navy font-semibold rounded-lg py-2 disabled:opacity-60'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={saving}
                className='flex-1 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2 disabled:opacity-60'
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default MemberProfile