'use client'
import { Fragment } from 'react'
import { Chip, EmptyState, MI, T, thStyle, tdStyle, type ChipTone } from '@/app/dashboard/_components/ui'
import type { StockItem, ExpiryStatus } from '@/app/actions/inventory-dashboard'

const EXPIRY_META: Record<ExpiryStatus, { tone: ChipTone; label: string }> = {
  ok: { tone: 'green', label: 'In date' },
  expiring: { tone: 'orange', label: 'Expiring soon' },
  expired: { tone: 'red', label: 'Expired' },
  none: { tone: 'gray', label: 'No expiry' },
}

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export default function StockTable({
  items, expandedId, onToggle,
}: { items: StockItem[]; expandedId: number | null; onToggle: (id: number) => void }) {
  if (items.length === 0) {
    return <EmptyState icon="inventory_2" title="No items in this category" sub="Add reagents, solvents or standards from Inventory Items." />
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Item', 'On Hand', 'Min Stock', 'Lots', 'Status', ''].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const open = expandedId === item.id
            return (
              <Fragment key={item.id}>
                <tr onClick={() => onToggle(item.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: T.heading }}>{item.name}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: item.is_low ? T.danger : T.text }}>
                    {fmtQty(item.on_hand)} {item.unit}
                  </td>
                  <td style={tdStyle}>{fmtQty(item.min_stock_level)} {item.unit}</td>
                  <td style={tdStyle}>{item.lots.length}</td>
                  <td style={tdStyle}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Chip tone={item.is_low ? 'red' : 'green'} dot>{item.is_low ? 'Low stock' : 'In stock'}</Chip>
                      {item.expired_lots > 0 && <Chip tone="red">{item.expired_lots} expired</Chip>}
                      {item.expiring_lots > 0 && <Chip tone="orange">{item.expiring_lots} expiring</Chip>}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <MI name={open ? 'expand_less' : 'expand_more'} size={18} color={T.faint} />
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0, backgroundColor: '#FAFBFE', borderBottom: `1px solid ${T.rowBorder}` }}>
                      <div className="px-4 py-3">
                        {item.lots.length === 0 ? (
                          <p style={{ fontSize: 12, color: T.faint }}>No lots received for this item yet.</p>
                        ) : (
                          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                {['Lot #', 'On Hand', 'Expiry', 'Status', 'Storage'].map((h) => (
                                  <th key={h} style={{ ...thStyle, backgroundColor: 'transparent' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {item.lots.map((lot) => {
                                const meta = EXPIRY_META[lot.expiry_status]
                                return (
                                  <tr key={lot.id}>
                                    <td style={{ ...tdStyle, fontWeight: 600, color: T.text }}>{lot.lot_number}</td>
                                    <td style={tdStyle}>{fmtQty(lot.on_hand)} {item.unit}</td>
                                    <td style={tdStyle}>{lot.expiry_date ?? '—'}</td>
                                    <td style={tdStyle}><Chip tone={meta.tone} dot={lot.expiry_status !== 'none'}>{meta.label}</Chip></td>
                                    <td style={tdStyle}>{lot.storage_location != null ? `Location #${lot.storage_location}` : '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
