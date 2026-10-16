import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { DocumentData } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'
import { useAuth } from '../auth/useAuth'
import type { Member } from '../types'

type EditForm = {
  fullName: string
  phone: string
  gender: string
  dateOfBirth: string
  location: string
  maritalStatus: string
  occupation: string
}

type EditErrors = Partial<Record<keyof EditForm, string>>

const baseField = 'w-full rounded-lg border px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'

function toMember(id: string, d: DocumentData): Member {
  return {
    id,
    communityId: String(d.communityId ?? ''),
    fullName: String(d.fullName ?? ''),
    email: String(d.email ?? ''),
    phone: String(d.phone ?? ''),
    gender: d.gender as Member['gender'],
    dateOfBirth: String(d.dateOfBirth ?? ''),
    location: String(d.location ?? ''),
    maritalStatus: d.maritalStatus as Member['maritalStatus'],
    occupation: String(d.occupation ?? ''),
    bornAgain: d.bornAgain as Member['bornAgain'],
    holySpirit: d.holySpirit as Member['holySpirit'],
    howHeard: String(d.howHeard ?? ''),
    expectations: String(d.expectations ?? ''),
    walkWithGod: String(d.walkWithGod ?? ''),
    termsAcceptedAt: String(d.termsAcceptedAt ?? ''),
    role: d.role === 'admin' ? 'admin' : 'member',
    status: d.status === 'approved' ? 'approved' : 'pending',
    createdAt: d.createdAt && typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate().toISOString() : '',
  }
}

function validateEdit(form: EditForm): EditErrors {
  const found: EditErrors = {}

  if (form.fullName.trim().length < 2) {
    found.fullName = 'Enter the full name'
  }
  if (!/^\+?[0-9]{10,15}$/.test(form.phone.trim())) {
    found.phone = 'Enter 10 to 15 digits, with an optional + at the start'
  }
  if (form.gender !== 'male' && form.gender !== 'female') {
    found.gender = 'Select a gender'
  }
  if (form.dateOfBirth === '') {
    found.dateOfBirth = 'Select a date of birth'
  } else {
    const year = Number(form.dateOfBirth.slice(0, 4))
    const today = new Date().toISOString().slice(0, 10)
    if (year < 1920 || form.dateOfBirth > today) {
      found.dateOfBirth = 'Enter a real date of birth'
    }
  }
  if (form.location.trim().length < 2) {
    found.location = 'Enter the city and country'
  }
  if (form.maritalStatus === '') {
    found.maritalStatus = 'Select a marital status'
  }

  return found
}

function AdminMembers() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<Member | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    fullName: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    location: '',
    maritalStatus: '',
    occupation: '',
  })
  const [editErrors, setEditErrors] = useState<EditErrors>({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleting, setDeleting] = useState<Member | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'members'), where('communityId', '==', settings.communityId))
        const snap = await getDocs(q)
        setMembers(snap.docs.map((d) => toMember(d.id, d.data())))
      } catch (err) {
        console.error(err)
        setError('Could not load members. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [members])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (term === '') return sorted
    return sorted.filter(
      (m) =>
        m.fullName.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        m.phone.includes(term)
    )
  }, [sorted, search])

  const pendingCount = useMemo(() => members.filter((m) => m.status === 'pending').length, [members])

  function canDelete(m: Member): boolean {
    return m.id !== user?.uid && m.role !== 'admin'
  }

  async function handleApprove(id: string) {
    setActionError('')
    setBusyId(id)

    try {
      await updateDoc(doc(db, 'members', id), { status: 'approved' })
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'approved' as const } : m)))
    } catch (err) {
      console.error(err)
      setActionError('Could not approve this member. Please try again.')
    } finally {
      setBusyId('')
    }
  }

  function openEdit(m: Member) {
    setEditing(m)
    setEditForm({
      fullName: m.fullName,
      phone: m.phone,
      gender: m.gender ?? '',
      dateOfBirth: m.dateOfBirth,
      location: m.location,
      maritalStatus: m.maritalStatus ?? '',
      occupation: m.occupation,
    })
    setEditErrors({})
    setSaveError('')
  }

  function closeEdit() {
    setEditing(null)
    setEditErrors({})
    setSaveError('')
  }

  function handleEditChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value })
  }

  function editFieldClass(name: keyof EditForm) {
    return editErrors[name] ? baseField + ' border-red-500' : baseField + ' border-gray-300'
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return

    const found = validateEdit(editForm)
    if (Object.keys(found).length > 0) {
      setEditErrors(found)
      return
    }

    setEditErrors({})
    setSaveError('')
    setSaving(true)

    const changes = {
      fullName: editForm.fullName.trim(),
      phone: editForm.phone.trim(),
      gender: editForm.gender as Member['gender'],
      dateOfBirth: editForm.dateOfBirth,
      location: editForm.location.trim(),
      maritalStatus: editForm.maritalStatus as Member['maritalStatus'],
      occupation: editForm.occupation.trim(),
    }
    const memberId = editing.id

    try {
      await updateDoc(doc(db, 'members', memberId), changes)
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...changes } : m)))
      closeEdit()
    } catch (err) {
      console.error(err)
      setSaveError('Could not save the changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function openDelete(m: Member) {
    setDeleting(m)
    setDeleteError('')
  }

  function closeDelete() {
    setDeleting(null)
    setDeleteError('')
  }

  async function handleDelete() {
    if (!deleting) return

    if (!canDelete(deleting)) {
      setDeleteError('This account is protected and cannot be deleted here.')
      return
    }

    const memberId = deleting.id
    setDeleteError('')
    setDeleteBusy(true)

    try {
      await deleteDoc(doc(db, 'members', memberId))
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      closeDelete()
    } catch (err) {
      console.error(err)
      setDeleteError('Could not delete this member. Please try again.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/admin' className='text-sm text-brand'>Back to dashboard</Link>

        <h1 className='font-display text-3xl font-semibold text-navy mt-2'>Members</h1>
        <p className='text-sm text-gray-500 mt-1 mb-4'>
          {members.length} registered, {pendingCount} waiting for approval
        </p>

        <input
          type='search'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search by name, email or phone'
          className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white mb-4 focus:outline-none focus:ring-2 focus:ring-brand'
        />

        {loading && <p className='text-gray-500'>Loading...</p>}
        {error && <p className='text-sm text-red-600'>{error}</p>}
        {actionError && <p className='text-sm text-red-600 mb-3'>{actionError}</p>}

        {!loading && !error && members.length === 0 && (
          <p className='text-gray-500'>No members yet.</p>
        )}

        {!loading && !error && members.length > 0 && visible.length === 0 && (
          <p className='text-gray-500'>No members match your search.</p>
        )}

        <div className='space-y-3'>
          {visible.map((m) => (
            <div key={m.id} className='bg-white rounded-xl shadow p-4 flex items-center justify-between gap-3'>
              <div className='min-w-0'>
                <p className='font-semibold text-navy truncate'>{m.fullName}</p>
                <p className='text-sm text-gray-500 truncate'>{m.email}</p>
                <p className='text-sm text-gray-500'>{m.phone}</p>
              </div>
              <div className='text-right shrink-0'>
                <span
                  className={
                    m.status === 'pending'
                      ? 'inline-block text-xs font-semibold rounded-full px-2 py-1 bg-orange-100 text-orange-700'
                      : 'inline-block text-xs font-semibold rounded-full px-2 py-1 bg-green-100 text-green-700'
                  }
                >
                  {m.status}
                </span>
                <p className='text-xs text-gray-400 mt-1'>{m.role}</p>
                <div className='mt-2 flex flex-wrap justify-end gap-2'>
                  {m.status === 'pending' && (
                    <button
                      type='button'
                      onClick={() => handleApprove(m.id)}
                      disabled={busyId === m.id}
                      className='bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg px-3 py-1 disabled:opacity-60'
                    >
                      {busyId === m.id ? 'Approving...' : 'Approve'}
                    </button>
                  )}
                  <button
                    type='button'
                    onClick={() => openEdit(m)}
                    className='border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-1'
                  >
                    Edit
                  </button>
                  {canDelete(m) && (
                    <button
                      type='button'
                      onClick={() => openDelete(m)}
                      className='border border-red-300 text-red-600 text-sm font-semibold rounded-lg px-3 py-1'
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className='fixed inset-0 z-10 bg-black/40 flex items-center justify-center p-4'>
          <form
            onSubmit={handleSave}
            noValidate
            className='w-full max-w-md max-h-full overflow-y-auto bg-white rounded-xl shadow p-6'
          >
            <h2 className='font-display text-2xl font-semibold text-navy'>Edit member</h2>
            <p className='text-sm text-gray-500 mt-1 mb-4'>{editing.email} (email cannot be changed here)</p>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Full name</label>
              <input name='fullName' value={editForm.fullName} onChange={handleEditChange} className={editFieldClass('fullName')} />
              {editErrors.fullName && <p className='text-sm text-red-600 mt-1'>{editErrors.fullName}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>WhatsApp number</label>
              <input name='phone' type='tel' value={editForm.phone} onChange={handleEditChange} className={editFieldClass('phone')} />
              {editErrors.phone && <p className='text-sm text-red-600 mt-1'>{editErrors.phone}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Gender</label>
              <select name='gender' value={editForm.gender} onChange={handleEditChange} className={editFieldClass('gender')}>
                <option value=''>Select gender</option>
                <option value='male'>Male</option>
                <option value='female'>Female</option>
              </select>
              {editErrors.gender && <p className='text-sm text-red-600 mt-1'>{editErrors.gender}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Date of birth</label>
              <input name='dateOfBirth' type='date' value={editForm.dateOfBirth} onChange={handleEditChange} className={editFieldClass('dateOfBirth')} />
              {editErrors.dateOfBirth && <p className='text-sm text-red-600 mt-1'>{editErrors.dateOfBirth}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Location (city and country)</label>
              <input name='location' value={editForm.location} onChange={handleEditChange} className={editFieldClass('location')} />
              {editErrors.location && <p className='text-sm text-red-600 mt-1'>{editErrors.location}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Marital status</label>
              <select name='maritalStatus' value={editForm.maritalStatus} onChange={handleEditChange} className={editFieldClass('maritalStatus')}>
                <option value=''>Select one</option>
                <option value='single'>Single</option>
                <option value='married'>Married</option>
                <option value='divorced'>Divorced</option>
                <option value='widowed'>Widowed</option>
              </select>
              {editErrors.maritalStatus && <p className='text-sm text-red-600 mt-1'>{editErrors.maritalStatus}</p>}
            </div>

            <div className='mb-6'>
              <label className='block text-sm font-medium text-navy mb-1'>Occupation (optional)</label>
              <input name='occupation' value={editForm.occupation} onChange={handleEditChange} className={editFieldClass('occupation')} />
            </div>

            {saveError && <p className='text-sm text-red-600 mb-3'>{saveError}</p>}

            <div className='flex gap-3'>
              <button
                type='button'
                onClick={closeEdit}
                className='w-1/3 border border-gray-300 text-navy font-semibold rounded-lg py-2'
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
        </div>
      )}

      {deleting && (
        <div className='fixed inset-0 z-10 bg-black/40 flex items-center justify-center p-4'>
          <div className='w-full max-w-sm bg-white rounded-xl shadow p-6'>
            <h2 className='font-display text-2xl font-semibold text-navy'>Delete this member?</h2>
            <p className='text-sm text-gray-600 mt-3'>
              {deleting.fullName} ({deleting.email}) will be removed from {settings.name}. This cannot be undone.
            </p>
            <p className='text-xs text-gray-500 mt-2 mb-4'>
              Their login account is not removed by this button. To remove it too, delete it in the Firebase console under Authentication.
            </p>

            {deleteError && <p className='text-sm text-red-600 mb-3'>{deleteError}</p>}

            <div className='flex gap-3'>
              <button
                type='button'
                onClick={closeDelete}
                disabled={deleteBusy}
                className='flex-1 border border-gray-300 text-navy font-semibold rounded-lg py-2 disabled:opacity-60'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleDelete}
                disabled={deleteBusy}
                className='flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2 disabled:opacity-60'
              >
                {deleteBusy ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminMembers