'use client'
import { useState } from 'react'
import MI from './Icon'
import styles from './styles.module.css'
import { ACTION_OPTIONS, ROLE_OPTIONS, STAGE_TYPE_LABEL } from './constants'
import type { ESignatureStep, PermissionsMatrix, Stage, StageType } from './types'

type DrawerTab = 'details' | 'actions' | 'permissions' | 'esign'

export default function StageConfigDrawer({
  stage, esig, allStages, permissions, onSelectStage, onUpdateStage, onRemoveStage,
  onToggleAction, onTogglePermission, onToggleEsig, onUpdateEsig, onToggleEsigRole,
}: {
  stage: Stage | null
  esig: ESignatureStep | null
  allStages: Stage[]
  permissions: PermissionsMatrix
  onSelectStage: (key: string) => void
  onUpdateStage: (patch: Partial<Stage>) => void
  onRemoveStage: () => void
  onToggleAction: (action: string) => void
  onTogglePermission: (role: string, action: string) => void
  onToggleEsig: (enabled: boolean) => void
  onUpdateEsig: (patch: Partial<ESignatureStep>) => void
  onToggleEsigRole: (role: string) => void
}) {
  const [tab, setTab] = useState<DrawerTab>('details')

  if (!stage) {
    return (
      <div className={`${styles.drawer} ${styles.drawerEmpty}`}>
        <MI name="ads_click" size={28} color="#C7CCDA" />
        <div className={styles.drawerEmptyTitle}>Select a stage</div>
        <div className={styles.drawerEmptyHint}>Click any stage or e-signature card on the canvas to configure it here.</div>
      </div>
    )
  }

  const branchLabel = stage.isBranch && stage.branchFrom
    ? stage.branchFrom.map(k => allStages.find(s => s.statusKey === k)?.name ?? k).join(', ')
    : null

  return (
    <div className={styles.drawer}>
      <div className={styles.drawerHeader}>
        <div className={styles.drawerTitle}>Stage Configuration</div>
        <button className={styles.drawerCloseBtn} onClick={() => onSelectStage('')}>
          <MI name="close" size={18} color="#6B7280" />
        </button>
      </div>

      <div className={styles.drawerSelectWrap}>
        <select value={stage.statusKey} onChange={e => onSelectStage(e.target.value)} className={styles.drawerSelect}>
          {allStages.map((s, i) => <option key={s.statusKey} value={s.statusKey}>{i + 1}. {s.name}</option>)}
        </select>

        <div className={styles.drawerHint}>
          Maps to Sample status <code>{stage.statusKey}</code>
          {branchLabel && <div className="mt-1">Exception branch — can occur from: {branchLabel}</div>}
        </div>
      </div>

      <div className={styles.drawerTabs}>
        {([['details', 'Details'], ['actions', 'Actions'], ['permissions', 'Permissions'], ['esign', 'E-Signature']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`${styles.drawerTabBtn} ${tab === key ? styles.drawerTabBtnActive : ''}`}>
            {label}
          </button>
        ))}
      </div>

      <div className={styles.drawerContent}>
        {tab === 'details' && (
          <>
            <label className={styles.fieldLabel}>Stage Name *</label>
            <input value={stage.name} onChange={e => onUpdateStage({ name: e.target.value })} className={styles.fieldInput} />

            <label className={styles.fieldLabel}>Description</label>
            <textarea value={stage.description} onChange={e => onUpdateStage({ description: e.target.value })}
              rows={3} className={styles.fieldTextarea} />

            <label className={styles.fieldLabel}>Stage Type</label>
            <select value={stage.stageType} onChange={e => onUpdateStage({ stageType: e.target.value as StageType })}
              className={styles.fieldInput} style={{ marginBottom: 16 }}>
              {(Object.keys(STAGE_TYPE_LABEL) as StageType[]).map(t => <option key={t} value={t}>{STAGE_TYPE_LABEL[t]}</option>)}
            </select>

            <button onClick={onRemoveStage} className={`${styles.btn} ${styles.btnDanger}`} style={{ width: '100%', justifyContent: 'center' }}>
              <MI name="delete" size={16} color="#B42318" /> Remove Stage
            </button>
          </>
        )}

        {tab === 'actions' && (
          <>
            <div className={styles.fieldLabel}>Allowed Actions</div>
            <div className={styles.fieldHint}>Actions a user may take while a sample sits in this stage.</div>
            <div className={styles.chipRow}>
              {ACTION_OPTIONS.map(a => (
                <button key={a} onClick={() => onToggleAction(a)}
                  className={`${styles.chip} ${stage.allowedActions.includes(a) ? styles.chipActionActive : ''}`}>
                  {a}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'permissions' && (
          <>
            <div className={styles.fieldLabel}>Role Access For This Stage</div>
            <div className={styles.fieldHint}>
              {stage.allowedActions.length === 0
                ? 'Add allowed actions on the Actions tab first — permissions are granted per action.'
                : 'Which roles may perform each of this stage\'s allowed actions.'}
            </div>
            {stage.allowedActions.length > 0 && ROLE_OPTIONS.map(role => (
              <div key={role} style={{ marginBottom: 12 }}>
                <div className={styles.fieldLabel} style={{ marginBottom: 6 }}>{role}</div>
                <div className={styles.chipRow}>
                  {stage.allowedActions.map(action => {
                    const active = (permissions[role] ?? []).includes(action)
                    return (
                      <button key={action} onClick={() => onTogglePermission(role, action)}
                        className={`${styles.chip} ${active ? styles.chipRoleActive : ''}`}>
                        {action}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'esign' && (
          <>
            <div className={styles.switchRow} style={{ marginBottom: 12 }}>
              <span className={styles.switchLabel}>Require E-Signature</span>
              <button onClick={() => onToggleEsig(!esig)} className={`${styles.switchTrack} ${esig ? styles.switchTrackOn : ''}`}>
                <span className={`${styles.switchThumb} ${esig ? styles.switchThumbOn : ''}`} />
              </button>
            </div>

            {esig ? (
              <>
                <label className={styles.fieldLabel}>E-Signature Label *</label>
                <input value={esig.label} onChange={e => onUpdateEsig({ label: e.target.value })} className={styles.fieldInput} />

                <label className={styles.fieldLabel}>Required Role(s) *</label>
                <div className={styles.chipRow} style={{ marginBottom: 16 }}>
                  {ROLE_OPTIONS.map(r => (
                    <button key={r} onClick={() => onToggleEsigRole(r)}
                      className={`${styles.chip} ${esig.requiredRoles.includes(r) ? styles.chipRoleActive : ''}`}>
                      {r}
                    </button>
                  ))}
                </div>

                <label className={styles.fieldLabel} style={{ marginBottom: 8 }}>Signature Order</label>
                <div className={styles.orderRow}>
                  {(['sequential', 'parallel'] as const).map(o => (
                    <label key={o} className={styles.orderOption}>
                      <input type="radio" checked={esig.order === o} onChange={() => onUpdateEsig({ order: o })} />
                      {o === 'sequential' ? 'Sequential' : 'Parallel'}
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs" style={{ color: '#9CA3AF' }}>No e-signature required to leave this stage.</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
