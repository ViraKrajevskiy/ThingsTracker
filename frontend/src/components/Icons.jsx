import React from 'react'

const S = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

export const IconUser = (p) => <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></S>
export const IconCalendar = (p) => <S {...p}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></S>
export const IconTrash = (p) => <S {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></S>
export const IconPalette = (p) => <S {...p}><path d="M12 3a9 9 0 100 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.2 0-.9.8-1.6 1.7-1.6H16a5 5 0 005-5c0-3.9-4-7.2-9-7.2z" /><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" /><circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" /></S>
export const IconGear = (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.7 1.6 1.6 0 01-3.2 0 1.6 1.6 0 00-2.7-.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-.7-2.7 1.6 1.6 0 010-3.2 1.6 1.6 0 00.7-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-.7 1.6 1.6 0 013.2 0 1.6 1.6 0 002.7.7l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00.7 2.7 1.6 1.6 0 010 3.2 1.6 1.6 0 00-1 .9z" /></S>
export const IconPaperclip = (p) => <S {...p}><path d="M21 11.5l-8.5 8.5a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8" /></S>
export const IconComment = (p) => <S {...p}><path d="M21 12a8 8 0 01-11.5 7.2L4 20l1-4.8A8 8 0 1121 12z" /></S>
export const IconPlay = (p) => <S {...p}><path d="M7 4l13 8-13 8V4z" fill="currentColor" /></S>
export const IconMenu = (p) => <S {...p}><path d="M4 6h16M4 12h16M4 18h16" /></S>
export const IconChevronLeft = (p) => <S {...p}><path d="M15 6l-6 6 6 6" /></S>
export const IconPlus = (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>
export const IconClose = (p) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>
export const IconPoll = (p) => <S {...p}><path d="M4 20V10M10 20V4M16 20v-7M4 20h16" /></S>
export const IconLink = (p) => <S {...p}><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.5-1.5" /></S>
export const IconFile = (p) => <S {...p}><path d="M14 3v5h5M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8l-6-5z" /></S>
