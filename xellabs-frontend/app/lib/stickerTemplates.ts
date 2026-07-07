import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import type { CocSample } from '@/app/actions/storage'

export type StickerSymbology = 'code128' | 'code39' | 'code93' | 'qr' | 'none'
export type StickerLayout = 'table' | 'barcode' | 'address' | 'qr'

export type StickerTemplate = {
  id: string
  name: string
  symbology: StickerSymbology
  layout: StickerLayout
  widthMm: number
  heightMm: number
  barHeightMm?: number
  showHRI?: boolean
  quietZone?: boolean
  idField: 'sample_id' | 'barcode'
}

export const STICKER_TEMPLATES: StickerTemplate[] = [
  { id: 'code_128_1x48mm',   name: 'Code 128 — 48 x 18mm',            symbology: 'code128', layout: 'table',   widthMm: 48,   heightMm: 18, barHeightMm: 8,  showHRI: false, quietZone: true,  idField: 'sample_id' },
  { id: 'code_39_40x20mm',   name: 'Code 39 — 40 x 20mm',             symbology: 'code39',  layout: 'barcode', widthMm: 40,   heightMm: 20, barHeightMm: 10, showHRI: false, quietZone: false, idField: 'sample_id' },
  { id: 'code_39_1x54mm',    name: 'Code 39 — 25.4 x 54mm',           symbology: 'code39',  layout: 'table',   widthMm: 25.4, heightMm: 54, barHeightMm: 10, showHRI: false, quietZone: false, idField: 'sample_id' },
  { id: 'code_39_1x72mm',    name: 'Code 39 — 25.4 x 72mm',           symbology: 'code39',  layout: 'table',   widthMm: 25.4, heightMm: 72, barHeightMm: 10, showHRI: false, quietZone: false, idField: 'sample_id' },
  { id: 'code_93_2x38mm',    name: 'Code 93 — 50.8 x 38mm',           symbology: 'code93',  layout: 'barcode', widthMm: 50.8, heightMm: 38, barHeightMm: 12, showHRI: false, quietZone: false, idField: 'sample_id' },
  { id: 'qr_1x14mmx39mm',    name: 'QR Code — 14 x 39mm',             symbology: 'qr',      layout: 'qr',      widthMm: 14,   heightMm: 39, idField: 'sample_id' },
  { id: 'din_address_40x85', name: 'Address Label — 40 x 85mm',       symbology: 'none',    layout: 'address', widthMm: 40,   heightMm: 85, idField: 'sample_id' },
  { id: 'worksheet_39x20mm', name: 'Worksheet — Code 39 40 x 20mm',   symbology: 'code39',  layout: 'barcode', widthMm: 40,   heightMm: 20, barHeightMm: 10, showHRI: false, quietZone: false, idField: 'sample_id' },
  { id: 'refsample_39x20mm', name: 'Reference Sample — Code 39 40 x 20mm', symbology: 'code39', layout: 'barcode', widthMm: 40, heightMm: 20, barHeightMm: 10, showHRI: false, quietZone: false, idField: 'sample_id' },
  { id: 'batch_39x20mm',     name: 'Batch — Code 39 40 x 20mm',       symbology: 'code39',  layout: 'barcode', widthMm: 40,   heightMm: 20, barHeightMm: 10, showHRI: false, quietZone: false, idField: 'sample_id' },
]

const MM_TO_PX = 3.78 // ~96dpi

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const JSBARCODE_FORMAT: Record<'code128' | 'code39' | 'code93', string> = {
  code128: 'CODE128',
  code39: 'CODE39',
  code93: 'CODE93',
}

function renderBarcodeSvg(value: string, template: StickerTemplate): string {
  if (typeof document === 'undefined') return ''
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, value, {
    format: JSBARCODE_FORMAT[template.symbology as 'code128' | 'code39' | 'code93'],
    height: (template.barHeightMm ?? 10) * MM_TO_PX,
    displayValue: template.showHRI ?? false,
    margin: template.quietZone ? 10 : 0,
    fontSize: 10,
  })
  return svg.outerHTML
}

async function renderQrDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, { margin: 1, width: 200 })
}

function fieldCell(label: string, value: string): string {
  return `<div class="cell"><div class="cell-label">${label}</div><div class="cell-value">${value || '—'}</div></div>`
}

function renderFieldTable(sample: CocSample): string {
  const rows: Array<[[string, string], [string, string]]> = [
    [['Sample ID', sample.sample_id], ['Date Sampled', fmtDate(sample.collection_date)]],
    [['Sampler', sample.collector], ['Order', sample.client_order_number]],
    [['Deviation', sample.sampling_deviation], ['Composite', sample.composite ? 'True' : 'False']],
    [['Container', sample.container_type], ['Preservation', sample.preservation]],
    [['Sample Type', sample.sample_type], ['Sample Point', sample.sample_point]],
  ]
  return `<div class="field-table">${rows.map(([a, b]) => fieldCell(a[0], a[1]) + fieldCell(b[0], b[1])).join('')}</div>`
}

export async function renderSticker(template: StickerTemplate, sample: CocSample): Promise<string> {
  const idValue = (template.idField === 'barcode' ? sample.barcode : sample.sample_id) || sample.sample_id

  let bodyHtml = ''
  switch (template.layout) {
    case 'table':
      bodyHtml = `
        ${renderFieldTable(sample)}
        <div class="bc">${renderBarcodeSvg(idValue, template)}</div>
        <div class="id">${idValue}</div>
      `
      break
    case 'barcode':
      bodyHtml = `
        <div class="bc">${renderBarcodeSvg(idValue, template)}</div>
        <div class="id">${idValue}</div>
      `
      break
    case 'qr': {
      const dataUrl = await renderQrDataUrl(idValue)
      bodyHtml = `
        <img class="qr" src="${dataUrl}" />
        <div class="id">${idValue}</div>
      `
      break
    }
    case 'address':
      bodyHtml = `
        <div class="addr">
          <div class="client">${sample.client}</div>
          <div class="id">${idValue}</div>
          <div class="meta">${fmtDate(sample.received_date)}</div>
        </div>
      `
      break
  }

  return `<div class="sticker sticker--${template.id}">${bodyHtml}</div>`
}

export function stickerPageCss(template: StickerTemplate): string {
  return `
    @page { size: ${template.widthMm}mm ${template.heightMm}mm; margin: 0; }
    .sticker--${template.id} {
      width: ${template.widthMm}mm;
      height: ${template.heightMm}mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: ${template.layout === 'table' ? 'flex-start' : 'center'};
      gap: 0.8mm;
      overflow: hidden;
      box-sizing: border-box;
      padding: 1mm;
    }
    .sticker--${template.id} .bc svg { max-width: 100%; height: auto; }
    .sticker--${template.id} .qr { width: ${Math.min(template.widthMm, template.heightMm) - 4}mm; height: auto; }
    .sticker--${template.id} .id { font-family: monospace; font-weight: 700; font-size: 6.5pt; letter-spacing: 0.03em; }
    .sticker--${template.id} .meta { font-size: 5.5pt; color: #444; text-align: center; }
    .sticker--${template.id} .addr { text-align: center; }
    .sticker--${template.id} .addr .client { font-weight: 700; font-size: 8pt; }
    .sticker--${template.id} .field-table {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 0.15mm solid #999;
    }
    .sticker--${template.id} .field-table .cell {
      border: 0.1mm solid #ccc;
      padding: 0.3mm 0.6mm;
    }
    .sticker--${template.id} .field-table .cell-label { font-size: 4.2pt; font-weight: 700; color: #111; line-height: 1.2; }
    .sticker--${template.id} .field-table .cell-value { font-size: 4.2pt; font-style: italic; color: #333; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `
}
