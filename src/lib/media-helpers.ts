import type { MediaKind } from '@/services/media'

export const MEDIA_KIND_OPTIONS: { value: MediaKind; label: string }[] = [
  { value: 'video', label: 'Video (YouTube)' },
  { value: 'audio', label: 'Audio' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'sheet_music', label: 'Sheet music' },
  { value: 'looptube', label: 'LoopTube' },
  { value: 'tab', label: 'Tab' },
  { value: 'other', label: 'Other' },
]

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = Object.fromEntries(
  MEDIA_KIND_OPTIONS.map((o) => [o.value, o.label]),
) as Record<MediaKind, string>

export const MEDIA_KIND_ICON: Record<MediaKind, string> = {
  video: 'pi pi-video',
  audio: 'pi pi-volume-up',
  spotify: 'pi pi-spotify',
  sheet_music: 'pi pi-image',
  looptube: 'pi pi-replay',
  tab: 'pi pi-list',
  other: 'pi pi-link',
}

export interface YouTubeRef {
  id: string
  start?: number
}

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'])

export function parseYouTube(url: string): YouTubeRef | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  let id: string | null = null
  if (u.hostname === 'youtu.be') {
    id = u.pathname.slice(1) || null
  } else if (YT_HOSTS.has(u.hostname)) {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else if (u.pathname.startsWith('/embed/')) id = u.pathname.slice('/embed/'.length)
    else if (u.pathname.startsWith('/shorts/')) id = u.pathname.slice('/shorts/'.length)
  }
  if (!id) return null
  id = id.split('/')[0].split('?')[0]
  const tRaw = u.searchParams.get('t') ?? u.searchParams.get('start')
  let start: number | undefined
  if (tRaw) {
    // Accept "90" or "1m30s" / "1h2m3s".
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(tRaw)
    if (m) {
      const [, h, mn, s] = m
      start = (h ? +h * 3600 : 0) + (mn ? +mn * 60 : 0) + (s ? +s : 0)
    } else {
      const n = Number(tRaw)
      if (!Number.isNaN(n)) start = n
    }
  }
  return { id, start }
}

export function youTubeEmbedSrc(ref: YouTubeRef): string {
  const params = new URLSearchParams()
  if (ref.start) params.set('start', String(Math.floor(ref.start)))
  const qs = params.toString()
  return `https://www.youtube.com/embed/${ref.id}${qs ? `?${qs}` : ''}`
}

const SP_HOSTS = new Set(['open.spotify.com', 'play.spotify.com'])

export function parseSpotify(url: string): { type: string; id: string } | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (!SP_HOSTS.has(u.hostname)) return null
  // Typical paths: /track/<id>, /episode/<id>, /playlist/<id>, /album/<id>, /intl-xx/track/<id>
  const parts = u.pathname.split('/').filter(Boolean)
  // Skip leading locale segment like 'intl-en'.
  if (parts[0]?.startsWith('intl-')) parts.shift()
  if (parts.length < 2) return null
  const [type, id] = parts
  if (!['track', 'album', 'playlist', 'episode'].includes(type)) return null
  return { type, id: id.split('?')[0] }
}

export function spotifyEmbedSrc(parsed: { type: string; id: string }): string {
  return `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`
}

/** Decide a default kind for a freshly-pasted URL when the user hasn't picked one. */
export function inferKindFromUrl(url: string): MediaKind {
  if (parseYouTube(url)) return 'video'
  if (parseSpotify(url)) return 'spotify'
  if (/looptube\.xyz/i.test(url)) return 'looptube'
  return 'other'
}
