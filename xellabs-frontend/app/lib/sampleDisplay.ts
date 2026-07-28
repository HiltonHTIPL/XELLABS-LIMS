// Django's own `sample_id` is a locally-generated id (prefix + today's date +
// sequence, e.g. "E2E-20260714-0001") — cosmetically similar to but NOT the
// real SENAITE-assigned id (e.g. "E2E-0001"), stored separately as
// `senaite_ar_id`. Every page showing a sample identifier to the user must
// prefer the real SENAITE id (falling back to sample_id only for samples
// created before senaite_ar_id existed) so the same sample reads identically
// everywhere in the UI.
export function sampleDisplayId(s: { sample_id: string; senaite_ar_id?: string | null }): string {
  return s.senaite_ar_id || s.sample_id
}
