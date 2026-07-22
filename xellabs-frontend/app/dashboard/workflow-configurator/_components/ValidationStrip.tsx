'use client'
import { useState } from 'react'
import MI from './Icon'
import styles from './styles.module.css'

export type ValidationIssue = { id: string; message: string; statusKey?: string }

export default function ValidationStrip({ issues, onSelectStage }: {
  issues: ValidationIssue[]
  onSelectStage: (key: string) => void
}) {
  const [open, setOpen] = useState(issues.length > 0)
  const ok = issues.length === 0

  return (
    <div className={styles.validation}>
      <button className={styles.validationHeader} onClick={() => setOpen(o => !o)}>
        <span className={`${styles.validationHeaderLeft} ${ok ? styles.validationOk : styles.validationWarn}`}>
          <MI name={ok ? 'check_circle' : 'error'} size={16} color={ok ? '#0F7A3D' : '#B42318'} />
          {ok ? 'Workflow is valid' : `${issues.length} issue${issues.length === 1 ? '' : 's'} found`}
        </span>
        <MI name={open ? 'expand_less' : 'expand_more'} size={18} color="#9CA3AF" />
      </button>
      {open && !ok && (
        <div className={styles.validationList}>
          {issues.map(issue => (
            <button key={issue.id} className={styles.validationRow}
              onClick={() => issue.statusKey && onSelectStage(issue.statusKey)}
              disabled={!issue.statusKey}>
              <MI name="chevron_right" size={14} color="#B42318" />
              {issue.message}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
