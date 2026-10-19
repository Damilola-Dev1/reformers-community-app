export const APP_URL = 'http://localhost:5173'

export function openWhatsAppShare(message: string) {
  const url = 'https://wa.me/?text=' + encodeURIComponent(message)
  window.open(url, '_blank', 'noopener,noreferrer')
}