'use client'
import MI from './Icon'
import styles from './styles.module.css'
import { STAGE_ACCENT } from './constants'
import type { Stage } from './types'

function RailRow({ stage, index, selected, canMoveUp, canMoveDown, onSelect, onMove }: {
  stage: Stage; index: number; selected: boolean; canMoveUp: boolean; canMoveDown: boolean
  onSelect: () => void; onMove: (dir: -1 | 1) => void
}) {
  return (
    <div className="flex items-center">
      <button className={`${styles.railItem} ${selected ? styles.railItemActive : ''}`} onClick={onSelect}>
        <span className={styles.railItemDot} style={{ background: STAGE_ACCENT[stage.stageType] }} />
        <span className={styles.railItemLabel}>{index}. {stage.name}</span>
      </button>
      <div className={styles.railMoveBtns}>
        <button className={styles.railMoveBtn} disabled={!canMoveUp} onClick={() => onMove(-1)} aria-label={`Move ${stage.name} up`}>
          <MI name="keyboard_arrow_up" size={14} />
        </button>
        <button className={styles.railMoveBtn} disabled={!canMoveDown} onClick={() => onMove(1)} aria-label={`Move ${stage.name} down`}>
          <MI name="keyboard_arrow_down" size={14} />
        </button>
      </div>
    </div>
  )
}

export default function StageOutlineRail({
  stages, selectedKey, onSelect, onMove, onAddStage, onAddBranch,
}: {
  stages: Stage[]
  selectedKey: string | null
  onSelect: (key: string) => void
  onMove: (key: string, dir: -1 | 1) => void
  onAddStage: () => void
  onAddBranch: () => void
}) {
  const mainStages = stages.filter(s => !s.isBranch)
  const branchStages = stages.filter(s => s.isBranch)

  return (
    <div className={styles.rail}>
      <div className={styles.railHeader}>Stages ({stages.length})</div>
      <div className={styles.railBody}>
        <div className={styles.railSectionLabel}>Main Path</div>
        {mainStages.map((s, i) => (
          <RailRow key={s.statusKey} stage={s} index={i + 1} selected={selectedKey === s.statusKey}
            canMoveUp={i > 0} canMoveDown={i < mainStages.length - 1}
            onSelect={() => onSelect(s.statusKey)} onMove={dir => onMove(s.statusKey, dir)} />
        ))}
        <button className={styles.railAddBtn} onClick={onAddStage}>
          <MI name="add" size={14} /> Add Stage
        </button>

        <div className={styles.railSectionLabel}>Exception Branches</div>
        {branchStages.map((s, i) => (
          <RailRow key={s.statusKey} stage={s} index={mainStages.length + i + 1} selected={selectedKey === s.statusKey}
            canMoveUp={i > 0} canMoveDown={i < branchStages.length - 1}
            onSelect={() => onSelect(s.statusKey)} onMove={dir => onMove(s.statusKey, dir)} />
        ))}
        <button className={styles.railAddBtn} onClick={onAddBranch}>
          <MI name="add" size={14} /> Add Branch
        </button>
      </div>
    </div>
  )
}
