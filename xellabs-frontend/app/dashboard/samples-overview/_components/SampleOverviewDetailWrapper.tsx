'use client'

import { useEffect, useState } from 'react'
import { getLabSample, type LabSample } from '@/app/actions/lab-samples'
import { getAnalysisRequestsForSample, type AnalysisRequest } from '@/app/actions/analysis-requests'
import SampleOverviewDetail from '../[id]/_components/SampleOverviewDetail'

export default function SampleOverviewDetailWrapper({ djangoId, onClose }: { djangoId: number; onClose: () => void }) {
  const [sample, setSample] = useState<LabSample | null>(null)
  const [analysisRequests, setAnalysisRequests] = useState<AnalysisRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      getLabSample(djangoId),
      getAnalysisRequestsForSample(djangoId)
    ]).then(([s, ars]) => {
      if (!active) return
      setSample(s)
      setAnalysisRequests(ars)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [djangoId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#F9FAFB' }}>
        <div style={{ fontSize: 13, color: '#6B7280' }}>Loading local sample details...</div>
      </div>
    )
  }

  if (!sample) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#F9FAFB' }}>
        <div style={{ fontSize: 13, color: '#EF4444' }}>Sample not found.</div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: '#fff', border: '1px solid #E5E7EB', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
        <span className="material-icons" style={{ fontSize: 18, color: '#6B7280' }}>close</span>
      </button>
      <div style={{ height: '100%', overflowY: 'auto' }}>
        <SampleOverviewDetail sample={sample} id={String(djangoId)} analysisRequests={analysisRequests} isDrawer={true} />
      </div>
    </div>
  )
}
