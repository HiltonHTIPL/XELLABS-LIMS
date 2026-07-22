'use client'

import { useEffect, useState } from 'react'
import { getLabSample, getDjangoSampleTypes, type LabSample, type DjangoSampleType } from '@/app/actions/lab-samples'
import { getAnalysisRequestsForSample, type AnalysisRequest } from '@/app/actions/analysis-requests'
import { getAnalysisServices } from '@/app/actions/samples'
import { getClients, type DjangoClient } from '@/app/actions/clients'
import { getSampleTemplatesForNewSample } from '@/app/actions/sample-templates'
import { getBatchesList } from '@/app/actions/batches'
import { getAnalysisSpecifications, type AnalysisSpecification } from '@/app/actions/specifications'
import { getPreservations, getSamplingDeviations, getSamplePoints } from '@/app/actions/reference-data'
import { type SenaiteAnalysisService, type SenaiteBatch, type SenaiteSampleTemplate, type SenaiteRefOption } from '@/app/lib/senaite'
import SampleOverviewDetail from '../[id]/_components/SampleOverviewDetail'

// The overview detail needs the same reference data the dedicated page fetches
// so its inline Create-AR / Edit-Sample modals work from the list drawer too.
type DetailData = {
  sample: LabSample | null
  analysisRequests: AnalysisRequest[]
  services: SenaiteAnalysisService[]
  sampleTypes: DjangoSampleType[]
  clients: DjangoClient[]
  sampleTemplates: SenaiteSampleTemplate[]
  sampleContainers: SenaiteRefOption[]
  batches: SenaiteBatch[]
  analysisSpecifications: AnalysisSpecification[]
  preservations: SenaiteRefOption[]
  samplingDeviations: SenaiteRefOption[]
  samplePoints: SenaiteRefOption[]
}

export default function SampleOverviewDetailWrapper({ djangoId, onClose }: { djangoId: number; onClose: () => void }) {
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      getLabSample(djangoId),
      getAnalysisRequestsForSample(djangoId),
      getAnalysisServices(),
      getDjangoSampleTypes(),
      getClients(),
      getSampleTemplatesForNewSample(),
      getBatchesList(),
      getAnalysisSpecifications(),
      getPreservations(),
      getSamplingDeviations(),
      getSamplePoints(),
    ]).then(([
      s, ars, services, sampleTypes, clients, templateData,
      batches, analysisSpecifications, preservations, samplingDeviations, samplePoints,
    ]) => {
      if (!active) return
      setData({
        sample: s,
        analysisRequests: ars,
        services,
        sampleTypes,
        clients,
        sampleTemplates: templateData.sampleTemplates,
        sampleContainers: templateData.sampleContainers,
        batches,
        analysisSpecifications: analysisSpecifications.filter(spec => spec.is_active),
        preservations,
        samplingDeviations,
        samplePoints,
      })
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

  if (!data || !data.sample) {
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
        <SampleOverviewDetail
          sample={data.sample}
          id={String(djangoId)}
          analysisRequests={data.analysisRequests}
          services={data.services}
          sampleTypes={data.sampleTypes}
          clients={data.clients}
          sampleTemplates={data.sampleTemplates}
          sampleContainers={data.sampleContainers}
          batches={data.batches}
          analysisSpecifications={data.analysisSpecifications}
          preservations={data.preservations}
          samplingDeviations={data.samplingDeviations}
          samplePoints={data.samplePoints}
          isDrawer={true}
        />
      </div>
    </div>
  )
}
