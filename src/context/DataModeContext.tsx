// =============================================================================
//  DATA MODE: STRICT NASA PSI (default) OR PSI + NTRS SUPPLEMENTAL
// =============================================================================
//  Strict (the default) shows only what the 14 NASA PSI tables contain. Two
//  kinds of material are then kept out of the main views:
//   * the BASS-II endings and flow directions transcribed (with AI) from the
//     BASS-II Summary Report's Appendix A (tier NTRS_APPENDIX_TRANSCRIBED), and
//   * results from other NASA reports on NTRS (tier NTRS_EXTERNAL_LITERATURE).
//  They stay reachable inside a collapsed, clearly labelled box. The Lunar
//  habitat page always uses them, because a complete habitat assessment needs
//  NASA work beyond PSI.
// =============================================================================

import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Dataset } from '../data'
import type { TestRecord } from '../types'

interface Mode { strictPsiOnly: boolean; setStrict: (v: boolean) => void }
const Ctx = createContext<Mode>({ strictPsiOnly: true, setStrict: () => {} })

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [strictPsiOnly, set] = useState<boolean>(() => {
    try { return localStorage.getItem('mf-data-mode') !== 'supplemental' } catch { return true }
  })
  const setStrict = (v: boolean) => { set(v); try { localStorage.setItem('mf-data-mode', v ? 'strict' : 'supplemental') } catch { /* private mode */ } }
  return <Ctx.Provider value={{ strictPsiOnly, setStrict }}>{children}</Ctx.Provider>
}

export const useDataMode = () => useContext(Ctx)

/** A row with every Appendix-A-transcribed field set to null. */
function stripRow(t: TestRecord): TestRecord {
  const tiers = Object.entries(t.field_tiers ?? {}).filter(([, v]) => v === 'NTRS_APPENDIX_TRANSCRIBED')
  if (!tiers.length) return t
  const n = { ...t.normalized }
  for (const [f] of tiers) (n as Record<string, unknown>)[f] = null
  return { ...t, normalized: n }
}

/** The dataset as the current mode shows it. */
export function useView(data: Dataset): Dataset {
  const { strictPsiOnly } = useDataMode()
  const strictTests = useMemo(() => data.tests.map(stripRow), [data.tests])
  return useMemo(() => (strictPsiOnly ? {
    ...data, tests: strictTests, materials: data.strict.materials, findings: data.strict.findings,
    investigations: data.strict.investigations,
  } : data), [data, strictPsiOnly, strictTests])
}

/** Non-PSI context: shown inline in supplemental mode, collapsed with a
 *  warning in strict mode. */
export function Supplemental({ children, title }: { children: ReactNode; title?: string }) {
  const { strictPsiOnly } = useDataMode()
  if (!strictPsiOnly) return <>{children}</>
  return (
    <details className="border border-dashed border-rule rounded-md">
      <summary className="cursor-pointer px-4 py-3 small text-ink2">
        <span className="flag flag-warn">Supplemental Non-PSI Context (NTRS - Excluded from Strict Mode)</span>
        {title && <span className="text-mute"> · {title}</span>}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

/** The pill in the top bar that switches the mode. */
export function DataModePill({ compact = false }: { compact?: boolean }) {
  const { strictPsiOnly, setStrict } = useDataMode()
  const full = strictPsiOnly ? 'Data Mode: 100% NASA PSI Strict' : 'Data Mode: PSI + NTRS Supplemental'
  return (
    <button onClick={() => setStrict(!strictPsiOnly)} aria-pressed={strictPsiOnly} aria-label={full}
            title="Strict: only the 14 NASA PSI tables. Supplemental: adds the BASS-II report transcription and other NASA reports (NTRS)."
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[12.5px] font-medium ${strictPsiOnly ? 'border-[#1f7a4d] text-[#1f7a4d] bg-[#1f7a4d]/5' : 'border-accent text-accent bg-accent/5'}`}>
      {compact ? (strictPsiOnly ? 'PSI Strict' : 'PSI + NTRS') : full}
    </button>
  )
}
