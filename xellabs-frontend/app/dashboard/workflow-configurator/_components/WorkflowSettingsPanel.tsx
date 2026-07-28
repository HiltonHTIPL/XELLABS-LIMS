'use client'
import { useState } from 'react'
import MI from './Icon'
import styles from './styles.module.css'
import type { Stage, WorkflowSettings } from './types'

type SectionKey = 'details' | 'rules' | 'sla'

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`${styles.switchTrack} ${on ? styles.switchTrackOn : ''}`}>
      <span className={`${styles.switchThumb} ${on ? styles.switchThumbOn : ''}`} />
    </button>
  )
}

function AccordionSection({ title, subtitle, sectionKey, open, onToggle, children }: {
  title: string; subtitle: string; sectionKey: SectionKey; open: boolean; onToggle: (key: SectionKey) => void
  children: React.ReactNode
}) {
  return (
    <div className={styles.accordion}>
      <button className={styles.accordionHeader} onClick={() => onToggle(sectionKey)}>
        <div style={{ textAlign: 'left' }}>
          <div className={styles.accordionTitle}>{title}</div>
          <div className={styles.accordionSub}>{subtitle}</div>
        </div>
        <MI name={open ? 'expand_less' : 'expand_more'} size={18} color="#9CA3AF" />
      </button>
      {open && <div className={styles.accordionBody}>{children}</div>}
    </div>
  )
}

export default function WorkflowSettingsPanel({
  settings, stages, onUpdate,
}: {
  settings: WorkflowSettings
  stages: Stage[]
  onUpdate: (patch: Partial<WorkflowSettings>) => void
}) {
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set(['details']))

  function toggleSection(key: SectionKey) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className={styles.main}>
      <AccordionSection title="Workflow Details" subtitle="Name, version, and publish status" sectionKey="details"
        open={openSections.has('details')} onToggle={toggleSection}>
        <label className={styles.fieldLabel} style={{ marginTop: 12 }}>Workflow Name</label>
        <input value={settings.name} onChange={e => onUpdate({ name: e.target.value })} className={styles.fieldInput} />

        <label className={styles.fieldLabel}>Version</label>
        <input value={settings.version} onChange={e => onUpdate({ version: e.target.value })} className={styles.fieldInput} />

        <label className={styles.fieldLabel} style={{ marginBottom: 8 }}>Status</label>
        <div className={styles.orderRow}>
          {(['draft', 'active'] as const).map(s => (
            <label key={s} className={styles.orderOption}>
              <input type="radio" checked={settings.status === s} onChange={() => onUpdate({ status: s })} />
              {s === 'draft' ? 'Draft' : 'Active'}
            </label>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection title="Global Rules" subtitle="Behavior that applies to every stage" sectionKey="rules"
        open={openSections.has('rules')} onToggle={toggleSection}>
        <div className={styles.switchRow} style={{ marginTop: 14 }}>
          <div>
            <div className={styles.switchLabel}>Require reason on every e-signature</div>
            <div className={styles.switchHint}>Signer must enter a justification when signing.</div>
          </div>
          <Switch on={settings.requireSignatureReason} onToggle={() => onUpdate({ requireSignatureReason: !settings.requireSignatureReason })} />
        </div>

        <div className={styles.switchRow}>
          <div>
            <div className={styles.switchLabel}>Notify assignee on stage entry</div>
            <div className={styles.switchHint}>Send a notification when a sample enters a new stage.</div>
          </div>
          <Switch on={settings.notifyOnStageEntry} onToggle={() => onUpdate({ notifyOnStageEntry: !settings.notifyOnStageEntry })} />
        </div>

        <div className={styles.switchRow} style={{ marginBottom: 0 }}>
          <div>
            <div className={styles.switchLabel}>Allow parallel review</div>
            <div className={styles.switchHint}>Multiple reviewers can sign the same stage at once.</div>
          </div>
          <Switch on={settings.allowParallelReview} onToggle={() => onUpdate({ allowParallelReview: !settings.allowParallelReview })} />
        </div>
      </AccordionSection>

      <AccordionSection title="Stage SLAs" subtitle="Expected turnaround time before a stage is overdue" sectionKey="sla"
        open={openSections.has('sla')} onToggle={toggleSection}>
        <div style={{ marginTop: 14 }}>
          {stages.filter(s => !s.isBranch).map(s => (
            <div key={s.statusKey} className={styles.slaRow}>
              <div className={styles.slaStageLabel}>
                <MI name="schedule" size={16} color="#0154FC" /> {s.name}
              </div>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} value={settings.stageSlaHours[s.statusKey] ?? ''}
                  onChange={e => onUpdate({ stageSlaHours: { ...settings.stageSlaHours, [s.statusKey]: Number(e.target.value) } })}
                  className={styles.slaInput} />
                <span className="text-xs" style={{ color: '#9CA3AF' }}>hours</span>
              </div>
            </div>
          ))}
          {stages.filter(s => !s.isBranch).length === 0 && (
            <div className="text-xs" style={{ color: '#9CA3AF' }}>Add stages in the Designer tab to set SLAs.</div>
          )}
        </div>
      </AccordionSection>
    </div>
  )
}
