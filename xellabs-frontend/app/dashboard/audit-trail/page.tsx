import { getAuditEvents, getLoginEvents, getSecurityEvents, getRecordVersions } from '@/app/actions/audit-trail'
import AuditTrailShell from './_components/AuditTrailShell'

export default async function AuditTrailPage() {
  const [auditEvents, loginEvents, securityEvents, recordVersions] = await Promise.all([
    getAuditEvents(),
    getLoginEvents(),
    getSecurityEvents(),
    getRecordVersions(),
  ])
  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <AuditTrailShell
        initialAuditEvents={auditEvents}
        initialLoginEvents={loginEvents}
        initialSecurityEvents={securityEvents}
        initialRecordVersions={recordVersions}
      />
    </div>
  )
}
