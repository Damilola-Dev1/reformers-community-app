import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import type { DocumentData } from 'firebase/firestore'
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
type FilterKey = 'all' | 'pending' | 'approved'

const baseField = 'w-full rounded-lg border px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p !== '')
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function SmallIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='shrink-0'
    >
      {children}
    </svg>
  )
}

function MailIcon() {
  return (
    <SmallIcon>
      <rect x='2' y='4' width='20' height='16' rx='2' />
      <path d='m22 7-10 7L2 7' />
    </SmallIcon>
  )
}

function PhoneIcon() {
  return (
    <SmallIcon>
      <path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' />
    </SmallIcon>
  )
}

function CalendarIcon() {
  return (
    <SmallIcon>
      <rect x='3' y='4' width='18' height='18' rx='2' />
      <line x1='16' y1='2' x2='16' y2='6' />
      <line x1='8' y1='2' x2='8' y2='6' />
      <line x1='3' y1='10' x2='21' y2='10' />
    </SmallIcon>
  )
}

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
  const [filter, setFilter] = useState<FilterKey>('all')

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

  const [roleTarget, setRoleTarget] = useState<Member | null>(null)
  const [roleError, setRoleError] = useState('')
  const [roleBusy, setRoleBusy] = useState(false)

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
    return sorted.filter((m) => {
      if (filter !== 'all' && m.status !== filter) return false
      if (term === '') return true
      return (
        m.fullName.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        m.phone.includes(term)
      )
    })
  }, [sorted, search, filter])

  const pendingCount = useMemo(() => members.filter((m) => m.status === 'pending').length, [members])
  const approvedCount = useMemo(() => members.filter((m) => m.status === 'approved').length, [members])
  const adminCount = useMemo(
    () => members.filter((m) => m.role === 'admin' && m.status === 'approved').length,
    [members]
  )

  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: members.length },
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'approved', label: 'Approved', count: approvedCount },
  ]

  function canDelete(m: Member): boolean {
    return m.id !== user?.uid && m.role !== 'admin'
  }

  function canChangeRole(m: Member): boolean {
    if (m.status !== 'approved') return false
    if (m.role === 'admin') {
      if (m.id === user?.uid) return false
      if (adminCount <= 1) return false
    }
    return true
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

  function openRole(m: Member) {
    setRoleTarget(m)
    setRoleError('')
  }

  function closeRole() {
    setRoleTarget(null)
    setRoleError('')
  }

  async function handleRoleChange() {
    if (!roleTarget) return

    if (!canChangeRole(roleTarget)) {
      setRoleError('This change is not allowed. The last admin, or your own admin role, cannot be removed.')
      return
    }

    const memberId = roleTarget.id
    const newRole: Member['role'] = roleTarget.role === 'admin' ? 'member' : 'admin'
    setRoleError('')
    setRoleBusy(true)

    try {
      await updateDoc(doc(db, 'members', memberId), { role: newRole })
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)))
      closeRole()
    } catch (err) {
      console.error(err)
      setRoleError('Could not change the role. Please try again.')
    } finally {
      setRoleBusy(false)
    }
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <h1 className='font-display text-3xl font-semibold text-navy'>Members</h1>
        <p className='text-sm text-gray-500 mt-1 mb-4'>
          {members.length} registered, {pendingCount} waiting for approval
        </p>

        <input
          type='search'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search by name, email or phone'
          className='w-full rounded-lg border border-gray-300 px-3 py-2 bg-white mb-3 focus:outline-none focus:ring-2 focus:ring-brand'
        />

        <div className='flex flex-wrap gap-2 mb-4'>
          {filterOptions.map((option) => (
            <button
              key={option.key}
              type='button'
              onClick={() => setFilter(option.key)}
              className={
                filter === option.key
                  ? 'rounded-full bg-navy text-white text-sm font-semibold px-4 py-1.5'
                  : 'rounded-full border border-gray-300 bg-white text-navy text-sm font-semibold px-4 py-1.5'
              }
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>

        {loading && <p className='text-gray-500'>Loading...</p>}
        {error && <p className='text-sm text-red-600'>{error}</p>}
        {actionError && <p className='text-sm text-red-600 mb-3'>{actionError}</p>}

        {!loading && !error && members.length === 0 && (
          <p className='text-gray-500'>No members yet.</p>
        )}

        {!loading && !error && members.length > 0 && visible.length === 0 && (
          <p className='text-gray-500'>No members match your search or filter.</p>
        )}

        <div className='space-y-3'>
          {visible.map((m) => (
            <div key={m.id} className='bg-white rounded-xl shadow p-4'>
              <div className='flex items-center gap-3'>
                <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy font-display font-semibold'>
                  {getInitials(m.fullName)}
                </div>
                <div className='min-w-0'>
                  <p className='font-semibold text-navy break-words'>{m.fullName}</p>
                  <div className='mt-1 flex flex-wrap gap-1.5'>
                    <span
                      className={
                        m.status === 'pending'
                          ? 'inline-block text-xs font-semibold rounded-full px-2 py-0.5 bg-orange-100 text-orange-700'
                          : 'inline-block text-xs font-semibold rounded-full px-2 py-0.5 bg-green-100 text-green-700'
                      }
                    >
                      {m.status}
                    </span>
                    <span
                      className={
                        m.role === 'admin'
                          ? 'inline-block text-xs font-semibold rounded-full px-2 py-0.5 bg-navy/10 text-navy'
                          : 'inline-block text-xs font-semibold rounded-full px-2 py-0.5 bg-gray-100 text-gray-500'
                      }
                    >
                      {m.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className='mt-4 space-y-1.5 text-sm text-gray-500'>
                <p className='flex items-start gap-2'>
                  <span className='mt-0.5'>
                    <MailIcon />
                  </span>
                  <span className='break-all'>{m.email}</span>
                </p>
                {m.phone && (
                  <p className='flex items-center gap-2'>
                    <PhoneIcon />
                    <span>{m.phone}</span>
                  </p>
                )}
                {m.dateOfBirth && (
                  <p className='flex items-center gap-2'>
                    <CalendarIcon />
                    <span>DOB: {m.dateOfBirth}</span>
                  </p>
                )}
              </div>

              <div className='mt-4 border-t border-gray-100 pt-4 flex flex-wrap gap-2'>
                {m.status === 'pending' && (
                  <button
                    type='button'
                    onClick={() => handleApprove(m.id)}
                    disabled={busyId === m.id}
                    className='flex-1 min-w-24 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg px-3 py-2 disabled:opacity-60'
                  >
                    {busyId === m.id ? 'Approving...' : 'Approve'}
                  </button>
                )}
                {canChangeRole(m) && (
                  <button
                    type='button'
                    onClick={() => openRole(m)}
                    className='flex-1 min-w-24 border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-2'
                  >
                    {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                )}
                <button
                  type='button'
                  onClick={() => openEdit(m)}
                  className='flex-1 min-w-24 border border-gray-300 text-navy text-sm font-semibold rounded-lg px-3 py-2'
                >
                  Edit
                </button>
                {canDelete(m) && (
                  <button
                    type='button'
                    onClick={() => openDelete(m)}
                    className='flex-1 min-w-24 border border-red-300 text-red-600 text-sm font-semibold rounded-lg px-3 py-2'
                  >
                    Delete
                  </button>
                )}
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

      {roleTarget && (
        <div className='fixed inset-0 z-10 bg-black/40 flex items-center justify-center p-4'>
          <div className='w-full max-w-sm bg-white rounded-xl shadow p-6'>
            <h2 className='font-display text-2xl font-semibold text-navy'>
              {roleTarget.role === 'admin' ? 'Remove admin role?' : 'Make this member an admin?'}
            </h2>
            <p className='text-sm text-gray-600 mt-3 mb-4'>
              {roleTarget.role === 'admin'
                ? roleTarget.fullName + ' (' + roleTarget.email + ') will become a normal member and will lose access to the admin area.'
                : roleTarget.fullName + ' (' + roleTarget.email + ') will be able to see and change everything in the admin area.'}
            </p>

            {roleError && <p className='text-sm text-red-600 mb-3'>{roleError}</p>}

            <div className='flex gap-3'>
              <button
                type='button'
                onClick={closeRole}
                disabled={roleBusy}
                className='flex-1 border border-gray-300 text-navy font-semibold rounded-lg py-2 disabled:opacity-60'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleRoleChange}
                disabled={roleBusy}
                className='flex-1 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2 disabled:opacity-60'
              >
                {roleBusy ? 'Saving...' : roleTarget.role === 'admin' ? 'Yes, remove admin' : 'Yes, make admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminMembers