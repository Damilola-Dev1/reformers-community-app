import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

function AuthBackground({ children }: Props) {
  return (
    <div className='relative min-h-screen overflow-hidden bg-paper flex items-center justify-center p-4'>
      <div aria-hidden='true' className='auth-blob auth-blob-1' />
      <div aria-hidden='true' className='auth-blob auth-blob-2' />
      <div aria-hidden='true' className='auth-blob auth-blob-3' />
      <div className='relative z-10 w-full flex justify-center'>{children}</div>
    </div>
  )
}

export default AuthBackground