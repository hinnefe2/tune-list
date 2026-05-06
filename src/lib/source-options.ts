import type { SourceKind } from '@/services/sources'

export const SOURCE_KIND_OPTIONS: { value: SourceKind; label: string }[] = [
  { value: 'jam', label: 'Jam' },
  { value: 'festival', label: 'Festival' },
  { value: 'person', label: 'Person' },
  { value: 'lesson', label: 'Lesson' },
  { value: 'recording', label: 'Recording' },
  { value: 'other', label: 'Other' },
]

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = Object.fromEntries(
  SOURCE_KIND_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SourceKind, string>

export const SOURCE_KIND_ICON: Record<SourceKind, string> = {
  jam: 'pi pi-users',
  festival: 'pi pi-flag',
  person: 'pi pi-user',
  lesson: 'pi pi-book',
  recording: 'pi pi-volume-up',
  other: 'pi pi-tag',
}
