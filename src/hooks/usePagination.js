import { useState } from 'react'

export function usePagination({ total = 0, pageSize: initialPageSize = 10 } = {}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize
  const to = Math.min(from + pageSize - 1, total - 1)

  function nextPage() { setPage((p) => Math.min(p + 1, totalPages)) }
  function prevPage() { setPage((p) => Math.max(p - 1, 1)) }
  function goToPage(p) { setPage(Math.max(1, Math.min(p, totalPages))) }
  function changePageSize(size) { setPageSize(size); setPage(1) }

  return { page, pageSize, totalPages, from, to, nextPage, prevPage, goToPage, changePageSize }
}
