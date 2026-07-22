'use client'
import { useMemo } from 'react'
import MI from './Icon'
import styles from './styles.module.css'
import { ROLE_OPTIONS } from './constants'
import type { ESignatureStep, PermissionsMatrix, Stage } from './types'

export default function WorkflowPermissionsPanel({
  matrix, stages, esigs, onToggle,
}: {
  matrix: PermissionsMatrix
  stages: Stage[]
  esigs: ESignatureStep[]
  onToggle: (role: string, action: string) => void
}) {
  const actionColumns = useMemo(() => Array.from(new Set(stages.flatMap(s => s.allowedActions))), [stages])

  return (
    <div className={styles.main}>
      <div className={styles.canvasCard}>
        <div className={styles.accordionTitle} style={{ marginBottom: 2 }}>Role Permissions</div>
        <div className={styles.accordionSub} style={{ marginBottom: 12 }}>Which actions each role may perform, across any stage that allows them.</div>

        <div style={{ overflow: 'auto' }}>
          <table className={styles.permTable}>
            <thead>
              <tr>
                <th className={styles.permTh}>Role</th>
                {actionColumns.map(a => <th key={a} className={`${styles.permTh} ${styles.permThCenter}`}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROLE_OPTIONS.map(role => (
                <tr key={role}>
                  <td className={styles.permTd}>{role}</td>
                  {actionColumns.map(action => {
                    const active = (matrix[role] ?? []).includes(action)
                    return (
                      <td key={action} className={styles.permTdCenter}>
                        <button onClick={() => onToggle(role, action)}
                          className={`${styles.permCellBtn} ${active ? styles.permCellBtnActive : ''}`}>
                          {active && <MI name="check" size={13} color="#fff" />}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {actionColumns.length === 0 && (
            <div className="text-xs" style={{ color: '#9CA3AF', padding: '8px 0' }}>Add allowed actions to a stage in the Designer tab to populate this matrix.</div>
          )}
        </div>
      </div>

      <div className={styles.canvasCard} style={{ marginTop: 16 }}>
        <div className={styles.accordionTitle} style={{ marginBottom: 12 }}>Stages Requiring E-Signature</div>
        {esigs.length === 0 ? (
          <div className="text-xs" style={{ color: '#9CA3AF' }}>No stage in this workflow currently requires an e-signature.</div>
        ) : (
          esigs.map(e => {
            const stage = stages.find(s => s.statusKey === e.afterStatusKey)
            return (
              <div key={e.id} className={styles.esigSummaryRow}>
                <div className={styles.esigSummaryLeft}>
                  <MI name="edit" size={16} color="#7C3AED" />
                  <span style={{ fontWeight: 600 }}>{e.label}</span>
                  <span style={{ color: '#9CA3AF' }}>— {stage?.name ?? e.afterStatusKey}</span>
                </div>
                <div className={styles.esigSummaryMeta}>
                  {e.requiredRoles.length ? e.requiredRoles.join(', ') : 'No role assigned'} · {e.order === 'sequential' ? 'Sequential' : 'Parallel'}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
