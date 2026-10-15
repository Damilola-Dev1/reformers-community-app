import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { settings } from '../config/settings'

type RegisterForm = {
  fullName: string
  email: string
  password: string
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

type FormErrors = Partial<Record<keyof RegisterForm | 'terms', string>>

const titles = ['Account', 'About you', 'Faith journey', 'Agreement']

const baseField =
  'w-full rounded-lg border px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand'

function Register() {
  const [step, setStep] = useState(1)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const navigate = useNavigate()
  const [form, setForm] = useState<RegisterForm>({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    location: '',
    maritalStatus: '',
    occupation: '',
    bornAgain: '',
    holySpirit: '',
    howHeard: '',
    expectations: '',
    walkWithGod: '',
  })

  const totalSteps = titles.length

  function fieldClass(name: keyof RegisterForm) {
    return errors[name] ? baseField + ' border-red-500' : baseField + ' border-gray-300'
  }

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function validateStep(stepNumber: number): FormErrors {
    const found: FormErrors = {}

    if (stepNumber === 1) {
      if (form.fullName.trim().length < 2) {
        found.fullName = 'Enter your full name'
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        found.email = 'Enter a valid email address'
      }
      if (!/^\+?[0-9]{10,15}$/.test(form.phone.trim())) {
        found.phone = 'Enter 10 to 15 digits, with an optional + at the start'
      }
      if (form.password.length < 8) {
        found.password = 'Password must be at least 8 characters'
      }
    }

    if (stepNumber === 2) {
      if (form.gender === '') {
        found.gender = 'Select your gender'
      }
      if (form.dateOfBirth === '') {
        found.dateOfBirth = 'Select your date of birth'
      } else {
        const year = Number(form.dateOfBirth.slice(0, 4))
        const today = new Date().toISOString().slice(0, 10)
        if (year < 1920 || form.dateOfBirth > today) {
          found.dateOfBirth = 'Enter a real date of birth'
        }
      }
      if (form.location.trim().length < 2) {
        found.location = 'Enter your city and country'
      }
      if (form.maritalStatus === '') {
        found.maritalStatus = 'Select your marital status'
      }
    }

    if (stepNumber === 3) {
      if (form.bornAgain === '') {
        found.bornAgain = 'Select an answer'
      }
      if (form.holySpirit === '') {
        found.holySpirit = 'Select an answer'
      }
      if (form.howHeard === '') {
        found.howHeard = 'Select how you heard about us'
      }
    }

    if (stepNumber === 4) {
      if (!termsAccepted) {
        found.terms = 'You must agree to the terms to register'
      }
    }

    return found
  }

  function goNext() {
    const found = validateStep(step)

    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }

    setErrors({})
    setStep(step + 1)
  }

  function goBack() {
    setErrors({})
    setSubmitError('')
    setStep(step - 1)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (step < totalSteps) {
      goNext()
      return
    }

    for (let s = 1; s <= totalSteps; s++) {
      const found = validateStep(s)
      if (Object.keys(found).length > 0) {
        setErrors(found)
        setStep(s)
        return
      }
    }

    setErrors({})
    setSubmitError('')
    setSubmitting(true)

    const memberData = {
      communityId: settings.communityId,
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      gender: form.gender,
      dateOfBirth: form.dateOfBirth,
      location: form.location.trim(),
      maritalStatus: form.maritalStatus,
      occupation: form.occupation.trim(),
      bornAgain: form.bornAgain,
      holySpirit: form.holySpirit,
      howHeard: form.howHeard,
      expectations: form.expectations.trim(),
      walkWithGod: form.walkWithGod.trim(),
      status: 'pending',
      termsAcceptedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, memberData.email, form.password)
      await setDoc(doc(db, 'members', cred.user.uid), memberData)
      navigate('/pending')
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setSubmitError('This email is already registered. Try logging in.')
      } else if (code === 'auth/network-request-failed') {
        setSubmitError('Network problem. Check your connection and try again.')
      } else {
        setSubmitError('Something went wrong. Please try again.')
        console.error(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='min-h-screen bg-paper flex items-center justify-center p-4'>
      <form
        onSubmit={handleSubmit}
        noValidate
        className='w-full max-w-md bg-white rounded-xl shadow p-6'
      >
        <h1 className='font-display text-3xl font-semibold text-navy'>Join {settings.name}</h1>

        <p className='text-sm text-gray-500 mt-1 mb-1'>
          Step {step} of {totalSteps}
        </p>

        <p className='text-sm font-semibold text-brand mb-6'>{titles[step - 1]}</p>

        {step === 1 && (
          <div>
            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Full name</label>
              <input
                name='fullName'
                value={form.fullName}
                onChange={handleChange}
                className={fieldClass('fullName')}
              />
              {errors.fullName && <p className='text-sm text-red-600 mt-1'>{errors.fullName}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Email</label>
              <input
                name='email'
                type='email'
                value={form.email}
                onChange={handleChange}
                className={fieldClass('email')}
              />
              {errors.email && <p className='text-sm text-red-600 mt-1'>{errors.email}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>WhatsApp number</label>
              <input
                name='phone'
                type='tel'
                value={form.phone}
                onChange={handleChange}
                className={fieldClass('phone')}
              />
              {errors.phone && <p className='text-sm text-red-600 mt-1'>{errors.phone}</p>}
            </div>

            <div className='mb-6'>
              <label className='block text-sm font-medium text-navy mb-1'>Password</label>
              <input
                name='password'
                type='password'
                value={form.password}
                onChange={handleChange}
                className={fieldClass('password')}
              />
              {errors.password && <p className='text-sm text-red-600 mt-1'>{errors.password}</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Gender</label>
              <select
                name='gender'
                value={form.gender}
                onChange={handleChange}
                className={fieldClass('gender')}
              >
                <option value=''>Select gender</option>
                <option value='male'>Male</option>
                <option value='female'>Female</option>
              </select>
              {errors.gender && <p className='text-sm text-red-600 mt-1'>{errors.gender}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Date of birth</label>
              <input
                name='dateOfBirth'
                type='date'
                value={form.dateOfBirth}
                onChange={handleChange}
                className={fieldClass('dateOfBirth')}
              />
              {errors.dateOfBirth && <p className='text-sm text-red-600 mt-1'>{errors.dateOfBirth}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Location (city and country)</label>
              <input
                name='location'
                value={form.location}
                onChange={handleChange}
                placeholder='e.g. Lagos, Nigeria'
                className={fieldClass('location')}
              />
              {errors.location && <p className='text-sm text-red-600 mt-1'>{errors.location}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Marital status</label>
              <select
                name='maritalStatus'
                value={form.maritalStatus}
                onChange={handleChange}
                className={fieldClass('maritalStatus')}
              >
                <option value=''>Select one</option>
                <option value='single'>Single</option>
                <option value='married'>Married</option>
                <option value='divorced'>Divorced</option>
                <option value='widowed'>Widowed</option>
              </select>
              {errors.maritalStatus && <p className='text-sm text-red-600 mt-1'>{errors.maritalStatus}</p>}
            </div>

            <div className='mb-6'>
              <label className='block text-sm font-medium text-navy mb-1'>Occupation (optional)</label>
              <input
                name='occupation'
                value={form.occupation}
                onChange={handleChange}
                className={fieldClass('occupation')}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Are you born again?</label>
              <select
                name='bornAgain'
                value={form.bornAgain}
                onChange={handleChange}
                className={fieldClass('bornAgain')}
              >
                <option value=''>Select one</option>
                <option value='yes'>Yes</option>
                <option value='no'>No</option>
              </select>
              {errors.bornAgain && <p className='text-sm text-red-600 mt-1'>{errors.bornAgain}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>Have you received the Holy Spirit?</label>
              <select
                name='holySpirit'
                value={form.holySpirit}
                onChange={handleChange}
                className={fieldClass('holySpirit')}
              >
                <option value=''>Select one</option>
                <option value='yes'>Yes</option>
                <option value='no'>No</option>
                <option value='not-sure'>Not sure</option>
              </select>
              {errors.holySpirit && <p className='text-sm text-red-600 mt-1'>{errors.holySpirit}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>How did you hear about us?</label>
              <select
                name='howHeard'
                value={form.howHeard}
                onChange={handleChange}
                className={fieldClass('howHeard')}
              >
                <option value=''>Select one</option>
                <option value='friend-or-family'>Friend or family</option>
                <option value='whatsapp'>WhatsApp</option>
                <option value='social-media'>Social media</option>
                <option value='event'>Event or gathering</option>
                <option value='other'>Other</option>
              </select>
              {errors.howHeard && <p className='text-sm text-red-600 mt-1'>{errors.howHeard}</p>}
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-navy mb-1'>What are your expectations from {settings.name}?</label>
              <textarea
                name='expectations'
                value={form.expectations}
                onChange={handleChange}
                rows={3}
                className={fieldClass('expectations')}
              />
            </div>

            <div className='mb-6'>
              <label className='block text-sm font-medium text-navy mb-1'>Tell us about your walk with God</label>
              <textarea
                name='walkWithGod'
                value={form.walkWithGod}
                onChange={handleChange}
                rows={3}
                className={fieldClass('walkWithGod')}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className='bg-paper border border-gray-200 rounded-lg p-3 text-sm text-gray-600 mb-4'>
              <p className='mb-2'>
                By joining {settings.name}, you agree that the information you give here is true and
                that it will be used only to run this community.
              </p>
              <p className='mb-2'>
                Your details are private. The community leaders can see them, and you can see your
                own, but other members cannot.
              </p>
              <p>
                Your membership starts after a leader approves your registration.
              </p>
            </div>

            <div className='mb-6'>
              <label className='flex items-start gap-2 text-sm text-navy'>
                <input
                  type='checkbox'
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked)
                    setErrors({})
                  }}
                  className='mt-1'
                />
                <span>I agree to the terms and conditions</span>
              </label>
              {errors.terms && <p className='text-sm text-red-600 mt-1'>{errors.terms}</p>}
            </div>
          </div>
        )}

        {submitError && <p className='text-sm text-red-600 mb-3'>{submitError}</p>}

        <div className='flex gap-3'>
          {step > 1 && (
            <button
              type='button'
              onClick={goBack}
              className='w-1/3 border border-gray-300 text-navy font-semibold rounded-lg py-2'
            >
              Back
            </button>
          )}

          {step < totalSteps && (
            <button
              type='button'
              onClick={goNext}
              className='flex-1 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2'
            >
              Next
            </button>
          )}

          {step === totalSteps && (
            <button
              type='submit'
              disabled={submitting}
              className='flex-1 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2 disabled:opacity-60'
            >
              {submitting ? 'Registering...' : 'Register'}
            </button>
          )}
        </div>

        <p className='text-sm text-gray-500 mt-4 text-center'>
          Already registered? <Link to='/login' className='text-brand'>Log in</Link>
        </p>
      </form>
    </div>
  )
}

export default Register