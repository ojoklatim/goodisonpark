import React, { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { downloadCSV } from '../../lib/utils'

function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px', borderBottom: "1px solid var(--gp-border-light)" }}>
          <div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 0 }} />
        </td>
      ))}
    </tr>
  )
}

export function DataTable({
  columns = [],
  data = [],
  loading = false,
  keyField = 'id',
  searchable = true,
  exportable = true,
  pageSizeOptions = [10, 25, 50],
  emptyIcon,
  emptyTitle = 'No data found',
  emptyDescription,
  onRowClick,
}) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(pageSizeOptions[0])

  // Filter
  const filtered = data.filter((row) => {
    if (!search) return true
    return columns.some((col) => {
      const accessor = col.accessor || col.accessorKey
      const val = accessor ? row[accessor] : ''
      return String(val || '').toLowerCase().includes(search.toLowerCase())
    })
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0
    const aVal = a[sortKey] ?? ''
    const bVal = b[sortKey] ?? ''
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => { setPage(1) }, [search, sortKey, sortDir, pageSize])

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function handleExport() {
    const exportData = sorted.map((row) => {
      const obj = {}
      columns.forEach((col) => { 
        const accessor = col.accessor || col.accessorKey
        if (accessor) obj[col.header] = row[accessor] 
      })
      return obj
    })
    downloadCSV(exportData, 'export.csv')
  }

  return (
    <div style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)" }}>
      {/* Toolbar */}
      {(searchable || exportable) && (
        <div style={{
          padding: '12px 16px',
          borderBottom: "1px solid var(--gp-border-light)",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          {searchable && (
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', paddingLeft: 32, paddingRight: 12, height: 32,
                  border: '1px solid var(--gp-border-light)', borderRadius: 0, fontSize: '13px',
                  fontFamily: 'Inter, sans-serif', outline: 'none', background: 'var(--gp-card)', color: 'var(--gp-black)'
                }}
              />
            </div>
          )}
          {exportable && (
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', fontSize: '12px', fontWeight: 500,
                background: "var(--gp-dark)", color: '#FFFFFF', border: '1px solid #2A2A2A',
                cursor: 'pointer', borderRadius: 0, fontFamily: 'Inter, sans-serif',
              }}
            >
              <Download size={13} />
              Export CSV
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((col) => {
                const accessor = col.accessor || col.accessorKey
                const isSortable = col.sortable !== false && accessor
                return (
                  <th
                    key={col.header}
                    onClick={() => isSortable && toggleSort(accessor)}
                    style={{
                      padding: '10px 16px',
                      background: "var(--gp-background)", color: "var(--gp-black)",
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {col.header}
                      {isSortable && (
                        sortKey === accessor
                          ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          : <ChevronsUpDown size={12} color="#4B5563" />
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={columns.length} />)
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={row[keyField] || i}
                  style={{ borderBottom: "1px solid var(--gp-border-light)", cursor: onRowClick ? 'pointer' : 'default' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gp-background)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((col) => {
                    const accessor = col.accessor || col.accessorKey
                    const renderCell = () => {
                      if (col.cell) {
                        return col.cell({
                          getValue: () => row[accessor],
                          row: { original: row }
                        })
                      }
                      if (col.render) {
                        return col.render(row)
                      }
                      return accessor ? row[accessor] : null
                    }
                    return (
                      <td key={col.header} style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--gp-black)', whiteSpace: col.wrap ? 'normal' : 'nowrap' }}>
                        {renderCell()}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        padding: '10px 16px',
        borderTop: "1px solid var(--gp-border-light)",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '13px',
        color: '#6B7280',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{ border: '1px solid var(--gp-border-light)', padding: '2px 6px', fontSize: '13px', borderRadius: 0, fontFamily: 'Inter, sans-serif', background: 'var(--gp-card)', color: 'var(--gp-black)' }}
          >
            {pageSizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span>{sorted.length} total</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ background: 'none', border: '1px solid var(--gp-border-light)', padding: '4px 8px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, borderRadius: 0, color: 'var(--gp-black)' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ padding: '0 8px' }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ background: 'none', border: '1px solid var(--gp-border-light)', padding: '4px 8px', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, borderRadius: 0, color: 'var(--gp-black)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
