'use client'
import { useState } from 'react'
import MI from './Icon'
import styles from './styles.module.css'
import { STAGE_ACCENT, STAGE_BG, STAGE_ICON, STAGE_TYPE_LABEL } from './constants'
import { rolesForStage } from './permissionUtils'
import type { ESignatureStep, PermissionsMatrix, Stage } from './types'

export default function WorkflowPreviewMode({ stages, esigs, permissions, onExit }: {
  stages: Stage[]
  esigs: ESignatureStep[]
  permissions: PermissionsMatrix
  onExit: () => void
}) {
  const mainStages = stages.filter(s => !s.isBranch)
  const [index, setIndex] = useState(0)
  const stage = mainStages[index]
  const esig = stage ? esigs.find(e => e.afterStatusKey === stage.statusKey) : undefined
  const roles = stage ? rolesForStage(stage, permissions) : []

  if (mainStages.length === 0) {
    return (
      <div className={styles.previewWrap}>
        <div className="text-sm" style={{ color: '#9CA3AF' }}>No main-path stages to preview yet.</div>
        <button className={`${styles.btn} ${styles.btnSecondary}`} style={{ marginTop: 16 }} onClick={onExit}>
          <MI name="close" size={14} /> Exit Preview
        </button>
      </div>
    )
  }

  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewProgress}>
        {mainStages.map((s, i) => (
          <span key={s.statusKey}
            className={`${styles.previewDot} ${i === index ? styles.previewDotActive : ''} ${i < index ? styles.previewDotDone : ''}`} />
        ))}
      </div>

      <div className={styles.previewCard}>
        <span className={styles.previewBadge} style={{ background: STAGE_BG[stage.stageType], color: STAGE_ACCENT[stage.stageType] }}>
          <MI name={STAGE_ICON[stage.stageType]} size={13} color={STAGE_ACCENT[stage.stageType]} />
          {STAGE_TYPE_LABEL[stage.stageType]} · Step {index + 1} of {mainStages.length}
        </span>
        <div className={styles.previewName}>{stage.name}</div>
        <div className={styles.previewDesc}>{stage.description || 'No description set for this stage.'}</div>

        <div className={styles.previewSectionLabel}>Allowed Actions</div>
        <div className={styles.chipRow}>
          {stage.allowedActions.length === 0
            ? <span className="text-xs" style={{ color: '#9CA3AF' }}>No actions configured</span>
            : stage.allowedActions.map(a => <span key={a} className={styles.chip}>{a}</span>)}
        </div>

        <div className={styles.previewSectionLabel}>Roles Who Can Act Here</div>
        <div className={styles.chipRow}>
          {roles.length === 0
            ? <span className="text-xs" style={{ color: '#9CA3AF' }}>No role granted access to this stage's actions</span>
            : roles.map(r => <span key={r} className={`${styles.chip} ${styles.chipRoleActive}`}>{r}</span>)}
        </div>

        {esig && (
          <div className={styles.previewEsigBanner}>
            <MI name="edit" size={16} color="#7C3AED" />
            <span className={styles.previewEsigText}>
              Leaving this stage requires <strong>{esig.label}</strong> from {esig.requiredRoles.length ? esig.requiredRoles.join(' / ') : 'an unassigned role'} ({esig.order === 'sequential' ? 'sequential' : 'parallel'})
            </span>
          </div>
        )}
      </div>

      <div className={styles.previewNav}>
        <button className={`${styles.btn} ${styles.btnSecondary}`} disabled={index === 0} onClick={() => setIndex(i => i - 1)}>
          <MI name="arrow_back" size={14} /> Back
        </button>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onExit}>
          <MI name="close" size={14} /> Exit Preview
        </button>
        <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={index === mainStages.length - 1} onClick={() => setIndex(i => i + 1)}>
          Next <MI name="arrow_forward" size={14} color="#fff" />
        </button>
      </div>
    </div>
  )
}
