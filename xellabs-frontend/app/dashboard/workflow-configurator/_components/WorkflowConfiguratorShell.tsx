'use client'
import { useMemo, useState } from 'react'
import MI from './Icon'
import styles from './styles.module.css'
import WorkflowCanvas from './WorkflowCanvas'
import StageConfigDrawer from './StageConfigDrawer'
import StageOutlineRail from './StageOutlineRail'
import ValidationStrip, { type ValidationIssue } from './ValidationStrip'
import WorkflowPreviewMode from './WorkflowPreviewMode'
import WorkflowSettingsPanel from './WorkflowSettingsPanel'
import WorkflowPermissionsPanel from './WorkflowPermissionsPanel'
import { INITIAL_ESIGS, INITIAL_PERMISSIONS, INITIAL_SETTINGS, INITIAL_STAGES } from './constants'
import type { ESignatureStep, PermissionsMatrix, Stage, WorkflowSettings } from './types'

type HistorySnapshot = { stages: Stage[]; esigs: ESignatureStep[] }

function newStatusKey() {
  return `stage_${Math.random().toString(36).slice(2, 8)}`
}

export default function WorkflowConfiguratorShell() {
  const [tab, setTab] = useState<'designer' | 'settings' | 'permissions'>('designer')
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES)
  const [esigs, setEsigs] = useState<ESignatureStep[]>(INITIAL_ESIGS)
  const [settings, setSettings] = useState<WorkflowSettings>(INITIAL_SETTINGS)
  const [permissions, setPermissions] = useState<PermissionsMatrix>(INITIAL_PERMISSIONS)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [history, setHistory] = useState<{ past: HistorySnapshot[]; future: HistorySnapshot[] }>({ past: [], future: [] })
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ stages: INITIAL_STAGES, esigs: INITIAL_ESIGS, settings: INITIAL_SETTINGS, permissions: INITIAL_PERMISSIONS }))

  const selected = useMemo(() => stages.find(s => s.statusKey === selectedKey) ?? null, [stages, selectedKey])
  const esigForSelected = useMemo(() => esigs.find(e => e.afterStatusKey === selectedKey) ?? null, [esigs, selectedKey])

  const mainStageCount = useMemo(() => stages.filter(s => !s.isBranch).length, [stages])
  const branchCount = useMemo(() => stages.filter(s => s.isBranch).length, [stages])

  const isDirty = useMemo(
    () => JSON.stringify({ stages, esigs, settings, permissions }) !== savedSnapshot,
    [stages, esigs, settings, permissions, savedSnapshot],
  )

  const issues: ValidationIssue[] = useMemo(() => {
    const list: ValidationIssue[] = []
    if (mainStageCount === 0) list.push({ id: 'no-main', message: 'Workflow has no main-path stages.' })
    stages.forEach(s => {
      if (s.allowedActions.length === 0) list.push({ id: `no-actions-${s.statusKey}`, message: `"${s.name}" has no allowed actions.`, statusKey: s.statusKey })
      if (s.isBranch && (!s.branchFrom || s.branchFrom.length === 0)) list.push({ id: `no-origin-${s.statusKey}`, message: `Exception branch "${s.name}" has no origin stage set.`, statusKey: s.statusKey })
    })
    esigs.forEach(e => {
      if (e.requiredRoles.length === 0) list.push({ id: `no-role-${e.id}`, message: `E-signature "${e.label}" has no required role.`, statusKey: e.afterStatusKey })
    })
    return list
  }, [stages, esigs, mainStageCount])

  function pushHistory() {
    setHistory(h => ({ past: [...h.past, { stages, esigs }].slice(-20), future: [] }))
  }

  function undo() {
    if (!history.past.length) return
    const prev = history.past[history.past.length - 1]
    setHistory(h => ({ past: h.past.slice(0, -1), future: [{ stages, esigs }, ...h.future].slice(0, 20) }))
    setStages(prev.stages)
    setEsigs(prev.esigs)
  }

  function redo() {
    if (!history.future.length) return
    const next = history.future[0]
    setHistory(h => ({ past: [...h.past, { stages, esigs }].slice(-20), future: h.future.slice(1) }))
    setStages(next.stages)
    setEsigs(next.esigs)
  }

  function updateStage(statusKey: string, patch: Partial<Stage>) {
    pushHistory()
    setStages(prev => prev.map(s => (s.statusKey === statusKey ? { ...s, ...patch } : s)))
  }

  function removeStage(statusKey: string) {
    pushHistory()
    setStages(prev => prev.filter(s => s.statusKey !== statusKey))
    setEsigs(prev => prev.filter(e => e.afterStatusKey !== statusKey))
    setSelectedKey(null)
  }

  function addStage(afterKey: string | null) {
    pushHistory()
    const key = newStatusKey()
    const stage: Stage = { statusKey: key, name: 'New Stage', description: '', stageType: 'standard', allowedActions: [] }
    setStages(prev => {
      if (!afterKey) return [...prev.filter(s => !s.isBranch), stage, ...prev.filter(s => s.isBranch)]
      const idx = prev.findIndex(s => s.statusKey === afterKey)
      const copy = [...prev]
      copy.splice(idx + 1, 0, stage)
      return copy
    })
    setSelectedKey(key)
  }

  function addBranch() {
    pushHistory()
    const key = newStatusKey()
    const stage: Stage = { statusKey: key, name: 'New Exception', description: '', stageType: 'terminal', allowedActions: [], isBranch: true, branchFrom: [] }
    setStages(prev => [...prev, stage])
    setSelectedKey(key)
  }

  function moveStage(key: string, dir: -1 | 1) {
    pushHistory()
    setStages(prev => {
      const idx = prev.findIndex(s => s.statusKey === key)
      const swapWith = idx + dir
      if (idx < 0 || swapWith < 0 || swapWith >= prev.length) return prev
      if (!!prev[idx].isBranch !== !!prev[swapWith].isBranch) return prev
      const copy = [...prev]
      ;[copy[idx], copy[swapWith]] = [copy[swapWith], copy[idx]]
      return copy
    })
  }

  function toggleActionForSelected(action: string) {
    if (!selected) return
    const has = selected.allowedActions.includes(action)
    updateStage(selected.statusKey, {
      allowedActions: has ? selected.allowedActions.filter(a => a !== action) : [...selected.allowedActions, action],
    })
  }

  function toggleEsig(enabled: boolean) {
    if (!selected) return
    pushHistory()
    if (enabled && !esigForSelected) {
      setEsigs(prev => [...prev, { id: `esig-${selected.statusKey}`, label: `${selected.name} Approval`, afterStatusKey: selected.statusKey, requiredRoles: [], order: 'sequential' }])
    } else if (!enabled && esigForSelected) {
      setEsigs(prev => prev.filter(e => e.afterStatusKey !== selected.statusKey))
    }
  }

  function updateEsig(patch: Partial<ESignatureStep>) {
    if (!esigForSelected) return
    pushHistory()
    setEsigs(prev => prev.map(e => (e.id === esigForSelected.id ? { ...e, ...patch } : e)))
  }

  function toggleEsigRole(role: string) {
    if (!esigForSelected) return
    const has = esigForSelected.requiredRoles.includes(role)
    updateEsig({ requiredRoles: has ? esigForSelected.requiredRoles.filter(r => r !== role) : [...esigForSelected.requiredRoles, role] })
  }

  function togglePermission(role: string, action: string) {
    setPermissions(prev => {
      const current = prev[role] ?? []
      const has = current.includes(action)
      return { ...prev, [role]: has ? current.filter(a => a !== action) : [...current, action] }
    })
  }

  function selectStage(key: string) {
    setSelectedKey(key === '' ? null : key)
  }

  function updateSettings(patch: Partial<WorkflowSettings>) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  function saveWorkflow(asTemplate: boolean) {
    setSavedSnapshot(JSON.stringify({ stages, esigs, settings, permissions }))
    setToast(asTemplate ? 'Workflow saved as template (mockup — not yet persisted).' : 'Workflow saved (mockup — not yet persisted).')
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.titleRow}>
            <input value={settings.name} onChange={e => updateSettings({ name: e.target.value })} className={styles.titleInput} style={{ width: `${Math.max(settings.name.length, 8)}ch` }} />
            <input value={settings.version} onChange={e => updateSettings({ version: e.target.value })} className={styles.versionInput} />
            <span className={`${styles.pill} ${settings.status === 'active' ? styles.pillActive : styles.pillDraft}`}>{settings.status}</span>
            {isDirty && <span className={styles.dirtyDot}><span className={styles.dirtyDotMark} /> Unsaved changes</span>}
          </div>
          <p className={styles.subtitle}>Design the sample lifecycle workflow and its e-signature gates.</p>
        </div>
        <div className={styles.topbarActions}>
          <button className={styles.iconBtn} disabled={!history.past.length} onClick={undo} title="Undo">
            <MI name="undo" size={16} />
          </button>
          <button className={styles.iconBtn} disabled={!history.future.length} onClick={redo} title="Redo">
            <MI name="redo" size={16} />
          </button>
          {tab === 'designer' && (
            <button className={`${styles.btn} ${previewMode ? styles.btnGhostActive : styles.btnSecondary}`} onClick={() => setPreviewMode(p => !p)}>
              <MI name="play_arrow" size={16} color={previewMode ? '#0154FC' : undefined} /> {previewMode ? 'Exit Preview' : 'Preview'}
            </button>
          )}
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => saveWorkflow(true)}>
            <MI name="bookmark_border" size={16} /> Save as Template
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => saveWorkflow(false)}>
            <MI name="save" size={16} color="#fff" /> Save Workflow
          </button>
        </div>
      </div>

      <div className={styles.tabBar}>
        {([['designer', 'Workflow Designer'], ['settings', 'Workflow Settings'], ['permissions', 'Permissions']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`${styles.tabBtn} ${tab === key ? styles.tabBtnActive : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {tab === 'settings' ? (
        <WorkflowSettingsPanel settings={settings} stages={stages} onUpdate={updateSettings} />
      ) : tab === 'permissions' ? (
        <WorkflowPermissionsPanel matrix={permissions} stages={stages} esigs={esigs} onToggle={togglePermission} />
      ) : previewMode ? (
        <WorkflowPreviewMode stages={stages} esigs={esigs} permissions={permissions} onExit={() => setPreviewMode(false)} />
      ) : (
        <div className={styles.body}>
          <StageOutlineRail stages={stages} selectedKey={selectedKey} onSelect={selectStage} onMove={moveStage}
            onAddStage={() => addStage(stages.filter(s => !s.isBranch).slice(-1)[0]?.statusKey ?? null)}
            onAddBranch={addBranch} />

          <div className={styles.main}>
            <ValidationStrip issues={issues} onSelectStage={selectStage} />

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <button className={styles.iconBtn} onClick={() => setLegendOpen(o => !o)} title="Legend">
                <MI name="info" size={16} />
              </button>
              {legendOpen && (
                <div className={styles.legendPopover}>
                  <div className={styles.legendRow}><MI name="description" size={16} color="#0154FC" /> Standard — a normal in-flow stage</div>
                  <div className={styles.legendRow}><MI name="shield" size={16} color="#D97706" /> Verification — results checked before approval</div>
                  <div className={styles.legendRow}><MI name="verified" size={16} color="#0F9D58" /> Approval — final sign-off / release</div>
                  <div className={styles.legendRow}><MI name="check_circle" size={16} color="#6B7280" /> Terminal — end of the sample lifecycle</div>
                  <div className={styles.legendRow}><MI name="edit" size={16} color="#7C3AED" /> E-Signature — approval gate attached to a stage</div>
                </div>
              )}
            </div>

            <WorkflowCanvas stages={stages} esigs={esigs} permissions={permissions} selectedKey={selectedKey}
              onSelect={selectStage} onAddStage={addStage} onAddBranch={addBranch} />

            <div className={styles.statGrid}>
              {[
                { label: 'Total Stages', value: stages.length, icon: 'view_column', color: '#0154FC' },
                { label: 'Exception Branches', value: branchCount, icon: 'alt_route', color: '#D97706' },
                { label: 'E-Signatures Required', value: esigs.length, icon: 'edit', color: '#7C3AED' },
                { label: 'Open Issues', value: issues.length, icon: 'checklist', color: issues.length > 0 ? '#B42318' : '#0F9D58' },
              ].map(t => (
                <div key={t.label} className={styles.statCard}>
                  <MI name={t.icon} size={18} color={t.color} />
                  <div className={styles.statValue}>{t.value}</div>
                  <div className={styles.statLabel}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>

          <StageConfigDrawer
            stage={selected}
            esig={esigForSelected}
            allStages={stages}
            permissions={permissions}
            onSelectStage={selectStage}
            onUpdateStage={patch => selected && updateStage(selected.statusKey, patch)}
            onRemoveStage={() => selected && removeStage(selected.statusKey)}
            onToggleAction={toggleActionForSelected}
            onTogglePermission={togglePermission}
            onToggleEsig={toggleEsig}
            onUpdateEsig={updateEsig}
            onToggleEsigRole={toggleEsigRole}
          />
        </div>
      )}
    </div>
  )
}
