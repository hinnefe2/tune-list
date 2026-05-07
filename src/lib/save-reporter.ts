import type { ToastServiceMethods } from 'primevue/toastservice'
import type { CreateTuneResult } from '@/services/tune-creation'

export interface ReportOptions {
  /** Override the success toast summary. Default: `${tune.name} saved`. */
  successSummary?: string
  /** Append after the success summary as the toast detail (e.g. "Add another?"). */
  successDetail?: string
  /** Success toast lifetime (ms). Default 2500. */
  successLife?: number
  /** Skip the success toast entirely. The caller may want to draw it themselves. */
  silenceSuccess?: boolean
}

function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Standardize the toast UX after a tune-create operation. Emits up to two
 * toasts:
 *   - one success toast summarizing what was attached
 *   - one warn toast aggregating any per-attachment failures
 *
 * The tune itself was always created (or this would be reporting an error),
 * so we never emit an error toast here. Errors thrown out of
 * createTuneWithAttachments are the caller's to surface separately.
 */
export function reportSaveResult(
  toast: ToastServiceMethods,
  result: CreateTuneResult,
  opts: ReportOptions = {},
): void {
  const { tune, succeeded, failures } = result

  if (!opts.silenceSuccess) {
    const attachedParts: string[] = []
    if (succeeded.sources) attachedParts.push(pluralize(succeeded.sources, 'source'))
    if (succeeded.media) attachedParts.push(pluralize(succeeded.media, 'media link'))
    if (succeeded.recording) attachedParts.push('recording')
    const detailFromAttachments = attachedParts.length
      ? `Attached ${attachedParts.join(', ')}.`
      : undefined
    toast.add({
      severity: 'success',
      summary: opts.successSummary ?? `${tune.name} saved`,
      detail: opts.successDetail ?? detailFromAttachments,
      life: opts.successLife ?? 2500,
    })
  }

  if (failures.length) {
    const counts = new Map<string, number>()
    for (const f of failures) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1)
    const summary = Array.from(counts.entries())
      .map(([kind, n]) => pluralize(n, kind === 'media' ? 'media link' : kind))
      .join(', ')
    toast.add({
      severity: 'warn',
      summary: `Some attachments failed: ${summary}`,
      detail: failures[0].error.message,
      life: 6000,
    })
  }
}
