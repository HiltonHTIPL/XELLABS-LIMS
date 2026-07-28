import { useEffect, useRef } from 'react'
import MI from './Icon'
import styles from './styles.module.css'
import { rolesForStage, roleInitials } from './permissionUtils'
import type { ESignatureStep, PermissionsMatrix, Stage, StageType } from './types'

const ACCENT_CLASS: Record<StageType, string> = {
  standard: styles.stageStandardAccent, verification: styles.stageVerificationAccent,
  approval: styles.stageApprovalAccent, terminal: styles.stageTerminalAccent,
}
const BG_CLASS: Record<StageType, string> = {
  standard: styles.stageStandardBg, verification: styles.stageVerificationBg,
  approval: styles.stageApprovalBg, terminal: styles.stageTerminalBg,
}
const TEXT_CLASS: Record<StageType, string> = {
  standard: styles.stageStandardText, verification: styles.stageVerificationText,
  approval: styles.stageApprovalText, terminal: styles.stageTerminalText,
}
const ICON_BY_TYPE: Record<StageType, string> = {
  standard: 'description', verification: 'shield', approval: 'verified', terminal: 'check_circle',
}

function RoleAvatars({ stage, permissions }: { stage: Stage; permissions: PermissionsMatrix }) {
  const roles = rolesForStage(stage, permissions)
  if (roles.length === 0) return <div className={styles.noRolesHint}>No role assigned yet</div>
  const shown = roles.slice(0, 3)
  const extra = roles.length - shown.length
  return (
    <div className={styles.roleAvatars} title={roles.join(', ')}>
      {shown.map(r => <span key={r} className={styles.roleAvatar}>{roleInitials(r)}</span>)}
      {extra > 0 && <span className={styles.roleAvatarMore}>+{extra}</span>}
    </div>
  )
}

function StageNode({ stage, index, selected, permissions, onClick }: {
  stage: Stage; index: number; selected: boolean; permissions: PermissionsMatrix; onClick: () => void
}) {
  return (
    <button onClick={onClick} className={`${styles.stageNode} ${selected ? styles.stageNodeSelected : ''}`}>
      <div className={`${styles.stageAccent} ${ACCENT_CLASS[stage.stageType]}`} />
      <div className={`${styles.stageBody} ${BG_CLASS[stage.stageType]}`}>
        <div className={styles.stageTopRow}>
          <span className={`${styles.stageIndex} ${TEXT_CLASS[stage.stageType]}`}>{index + 1}</span>
          <MI name={ICON_BY_TYPE[stage.stageType]} size={14} color="currentColor" />
        </div>
        <div className={styles.stageName}>{stage.name}</div>
        <div className={styles.stageDesc}>{stage.description}</div>
        <RoleAvatars stage={stage} permissions={permissions} />
      </div>
    </button>
  )
}

function ESigNode({ esig, order, selected, onClick }: { esig: ESignatureStep; order: number; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${styles.esigNode} ${selected ? styles.esigNodeSelected : ''}`}>
      <div className={styles.esigTopRow}>
        <MI name="edit" size={13} color="#7C3AED" />
        <span className={styles.esigOrderLabel}>E-Signature {order}</span>
      </div>
      <div className={styles.esigLabel}>{esig.label}</div>
      <div className={styles.esigRoles}>{esig.requiredRoles.length > 0 ? esig.requiredRoles.join(' / ') : 'No role set'}</div>
    </button>
  )
}

function AddInlineButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button className={styles.addInlineBtn} onClick={onClick} title={title} aria-label={title}>
      <MI name="add" size={14} />
    </button>
  )
}

export default function WorkflowCanvas({ stages, esigs, permissions, selectedKey, onSelect, onAddStage, onAddBranch }: {
  stages: Stage[]; esigs: ESignatureStep[]; permissions: PermissionsMatrix
  selectedKey: string | null; onSelect: (key: string) => void
  onAddStage: (afterKey: string | null) => void
  onAddBranch: () => void
}) {
  const mainStages = stages.filter(s => !s.isBranch)
  const branchStages = stages.filter(s => s.isBranch)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedKey || !rowRef.current) return
    const el = rowRef.current.querySelector<HTMLElement>(`[data-stage-key="${CSS.escape(selectedKey)}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedKey])

  function scrollCanvas(dir: -1 | 1) {
    rowRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' })
  }

  return (
    <div className={styles.canvasCard}>
      <div className={styles.canvasNavRow}>
        <button className={styles.iconBtn} onClick={() => scrollCanvas(-1)} title="Scroll left" aria-label="Scroll canvas left">
          <MI name="chevron_left" size={18} />
        </button>
        <button className={styles.iconBtn} onClick={() => scrollCanvas(1)} title="Scroll right" aria-label="Scroll canvas right">
          <MI name="chevron_right" size={18} />
        </button>
      </div>
      <div className={styles.canvasRow} ref={rowRef}>
        {mainStages.map((s, i) => {
          const esig = esigs.find(e => e.afterStatusKey === s.statusKey)
          const esigIndex = esig ? esigs.indexOf(esig) + 1 : 0
          return (
            <div key={s.statusKey} data-stage-key={s.statusKey} className={styles.stageCol}>
              <div className={styles.stageStack}>
                <StageNode stage={s} index={i} selected={selectedKey === s.statusKey} permissions={permissions} onClick={() => onSelect(s.statusKey)} />
                {esig && (
                  <>
                    <div className={styles.esigDivider} />
                    <ESigNode esig={esig} order={esigIndex} selected={selectedKey === s.statusKey} onClick={() => onSelect(s.statusKey)} />
                  </>
                )}
              </div>
              <div className={styles.connectorArrow}>
                <div className={styles.connectorLine} />
                <AddInlineButton onClick={() => onAddStage(s.statusKey)} title={`Insert stage after ${s.name}`} />
                {i < mainStages.length - 1 && <div className={styles.connectorLine} />}
                {i < mainStages.length - 1 && <MI name="arrow_forward" size={16} color="#C7CCDA" />}
              </div>
            </div>
          )
        })}
        {mainStages.length === 0 && (
          <button className={styles.addInlineBtn} onClick={() => onAddStage(null)} title="Add the first stage">
            <MI name="add" size={16} />
          </button>
        )}
      </div>

      <div className={styles.branchSection}>
        <div className={styles.branchHeader}>
          <MI name="alt_route" size={15} color="#9CA3AF" />
          <span className={styles.branchHeaderLabel}>Exception Path</span>
        </div>
        <div className={styles.branchRow}>
          {branchStages.map((b, i) => (
            <div key={b.statusKey} data-stage-key={b.statusKey} className={styles.branchCol}>
              <StageNode stage={b} index={mainStages.length + i} selected={selectedKey === b.statusKey} permissions={permissions} onClick={() => onSelect(b.statusKey)} />
              <div className={styles.branchFromLabel}>
                {b.branchFrom && b.branchFrom.length > 0
                  ? `From: ${b.branchFrom.map(k => mainStages.find(s => s.statusKey === k)?.name ?? k).join(', ')}`
                  : 'No origin stage set'}
              </div>
            </div>
          ))}
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onAddBranch}>
            <MI name="add" size={14} /> Add Exception Branch
          </button>
        </div>
      </div>
    </div>
  )
}
