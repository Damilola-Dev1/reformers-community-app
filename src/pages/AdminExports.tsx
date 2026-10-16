import { useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { settings } from '../config/settings'

type ExportTable = {
  title: string
  fileName: string
  headers: string[]
  rows: string[][]
}

function todayStamp(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return now.getFullYear() + '-' + month + '-' + day
}

function cap(value: string): string {
  if (value === '') return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function buildMembersTable(): Promise<ExportTable> {
  const q = query(
    collection(db, 'members'),
    where('communityId', '==', settings.communityId),
    where('status', '==', 'approved')
  )
  const snap = await getDocs(q)
  const rows = snap.docs
    .map((d) => {
      const data = d.data()
      return [
        String(data.fullName ?? ''),
        String(data.email ?? ''),
        String(data.phone ?? ''),
        cap(String(data.gender ?? '')),
        String(data.dateOfBirth ?? ''),
        cap(String(data.maritalStatus ?? '')),
        String(data.location ?? ''),
        cap(String(data.status ?? '')),
      ]
    })
    .sort((a, b) => a[0].localeCompare(b[0]))

  return {
    title: settings.name + ' - Members',
    fileName: 'members-' + todayStamp(),
    headers: ['Name', 'Email', 'Phone', 'Gender', 'Date of birth', 'Marital status', 'Location', 'Status'],
    rows: rows,
  }
}

async function buildAttendanceTable(): Promise<ExportTable> {
  const membersQuery = query(
    collection(db, 'members'),
    where('communityId', '==', settings.communityId),
    where('status', '==', 'approved')
  )
  const servicesQuery = query(
    collection(db, 'services'),
    where('communityId', '==', settings.communityId),
    where('finalized', '==', true)
  )
  const attendanceQuery = query(
    collection(db, 'attendance'),
    where('communityId', '==', settings.communityId)
  )
  const [memberSnap, serviceSnap, attendanceSnap] = await Promise.all([
    getDocs(membersQuery),
    getDocs(servicesQuery),
    getDocs(attendanceQuery),
  ])

  const approvedIds = new Set(memberSnap.docs.map((d) => d.id))
  const counts = new Map<string, { present: number; absent: number }>()
  attendanceSnap.docs.forEach((d) => {
    const data = d.data()
    const memberId = String(data.memberId ?? '')
    if (!approvedIds.has(memberId)) return
    const serviceId = String(data.serviceId ?? '')
    const entry = counts.get(serviceId) ?? { present: 0, absent: 0 }
    if (data.status === 'present') entry.present += 1
    else entry.absent += 1
    counts.set(serviceId, entry)
  })

  const services = serviceSnap.docs
    .map((d) => {
      const data = d.data()
      return { id: d.id, title: String(data.title ?? ''), date: String(data.date ?? '') }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const rows = services.map((s) => {
    const entry = counts.get(s.id) ?? { present: 0, absent: 0 }
    const total = entry.present + entry.absent
    const percent = total === 0 ? 0 : Math.round((entry.present / total) * 100)
    return [s.date, s.title, String(entry.present), String(entry.absent), String(total), percent + '%']
  })

  return {
    title: settings.name + ' - Attendance',
    fileName: 'attendance-' + todayStamp(),
    headers: ['Date', 'Service', 'Present', 'Absent', 'Marked', 'Attendance'],
    rows: rows,
  }
}

async function downloadExcel(table: ExportTable) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Export')

  sheet.addRow(table.headers)
  table.rows.forEach((row) => sheet.addRow(row))

  sheet.getRow(1).font = { bold: true }
  sheet.columns.forEach((column, index) => {
    let widest = table.headers[index].length
    table.rows.forEach((row) => {
      if (row[index].length > widest) widest = row[index].length
    })
    column.width = Math.min(widest + 2, 40)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveBlob(blob, table.fileName + '.xlsx')
}

async function downloadPdf(table: ExportTable) {
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')

  const landscape = table.headers.length > 6
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })

  pdf.setFontSize(14)
  pdf.text(table.title, 14, 15)
  pdf.setFontSize(9)
  pdf.text('Exported ' + todayStamp(), 14, 21)

  autoTableModule.default(pdf, {
    head: [table.headers],
    body: table.rows,
    startY: 26,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 95] },
  })

  pdf.save(table.fileName + '.pdf')
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

type ExportCardProps = {
  title: string
  note: string
  busyKey: string
  excelKey: string
  pdfKey: string
  onExcel: () => void
  onPdf: () => void
}

function ExportCard({ title, note, busyKey, excelKey, pdfKey, onExcel, onPdf }: ExportCardProps) {
  const busy = busyKey !== ''
  return (
    <div className='bg-white rounded-xl shadow p-4 mb-4'>
      <h2 className='font-display text-xl font-semibold text-navy'>{title}</h2>
      <p className='text-sm text-gray-500 mt-1 mb-3'>{note}</p>
      <div className='flex flex-wrap gap-2'>
        <button
          type='button'
          onClick={onExcel}
          disabled={busy}
          className='bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60'
        >
          {busyKey === excelKey ? 'Preparing...' : 'Download Excel'}
        </button>
        <button
          type='button'
          onClick={onPdf}
          disabled={busy}
          className='border border-gray-300 bg-white text-navy text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60'
        >
          {busyKey === pdfKey ? 'Preparing...' : 'Download PDF'}
        </button>
      </div>
    </div>
  )
}

function AdminExports() {
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function run(key: string, kind: 'members' | 'attendance', format: 'excel' | 'pdf') {
    setError('')
    setMessage('')
    setBusyKey(key)
    try {
      const table = kind === 'members' ? await buildMembersTable() : await buildAttendanceTable()
      if (table.rows.length === 0) {
        setError(
          kind === 'members'
            ? 'There are no approved members to export yet.'
            : 'There are no finalized services to export yet.'
        )
        return
      }
      if (format === 'excel') await downloadExcel(table)
      else await downloadPdf(table)
      setMessage('Your file is ready. Check your downloads.')
    } catch (err) {
      console.error(err)
      setError('Could not create the file. Check your connection and try again.')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className='min-h-screen bg-paper p-4'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/admin' className='text-sm text-brand'>Back to dashboard</Link>

        <h1 className='font-display text-3xl font-semibold text-navy mt-2'>Exports</h1>
        <p className='text-sm text-gray-500 mt-1 mb-6'>Download your data as Excel or PDF</p>

        {error && <p className='text-sm text-red-600 mb-4'>{error}</p>}
        {message && <p className='text-sm text-green-700 mb-4'>{message}</p>}

        <ExportCard
          title='Members'
          note='All approved members with contact details.'
          busyKey={busyKey}
          excelKey='members-excel'
          pdfKey='members-pdf'
          onExcel={() => run('members-excel', 'members', 'excel')}
          onPdf={() => run('members-pdf', 'members', 'pdf')}
        />

        <ExportCard
          title='Attendance'
          note='One row per finalized service, with present, absent and percentage.'
          busyKey={busyKey}
          excelKey='attendance-excel'
          pdfKey='attendance-pdf'
          onExcel={() => run('attendance-excel', 'attendance', 'excel')}
          onPdf={() => run('attendance-pdf', 'attendance', 'pdf')}
        />
      </div>
    </div>
  )
}

export default AdminExports