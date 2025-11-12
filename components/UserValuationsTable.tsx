"use client"

import { useState, useMemo } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bookmark, ChevronUp, ChevronDown, ChevronRight } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import clsx from "clsx"
import { Select } from "@/components/ui/select"
import { SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useRouter } from "next/navigation"

export interface ValuationResult {
  title: string
  address: string
  url: string
  link: string
  revenue: number
  price: string
  location: string
  category: string
  createdAt: string
  checked: boolean
  bookmarked?: boolean
}

interface UserValuationsTableProps {
  results: ValuationResult[]
  onViewValuation: (valuation: ValuationResult) => void
  onBookmark: (valuation: ValuationResult) => void
  onNewValuation?: () => void
  onUpgrade?: (valuation: ValuationResult) => void
}

export function UserValuationsTable({
  results,
  onViewValuation,
  onBookmark,
  onNewValuation,
  onUpgrade,
}: UserValuationsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [showBookmarked, setShowBookmarked] = useState(false)

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  const tableData = useMemo(() => {
    let data = Array.isArray(results) ? results : []
    if (showBookmarked) {
      data = data.filter((b) => b.bookmarked)
    }
    return data
  }, [results, showBookmarked])

  const totalCount = Array.isArray(results) ? results.length : 0
  const filteredCount = tableData.length

  const columns: ColumnDef<ValuationResult>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => {
        const isSorted = column.getIsSorted()
        return (
          <div className="flex items-center gap-1 cursor-pointer select-none min-w-[120px]" onClick={() => column.toggleSorting(isSorted === "asc")}>Name
            <span className={clsx("ml-1", isSorted ? "text-primary" : "text-gray-400")}> 
              <ChevronUp className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
              <ChevronDown className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
            </span>
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium min-w-[120px]">{row.original.title}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "category",
      header: ({ column }) => {
        const isSorted = column.getIsSorted()
        return (
          <div className="flex items-center gap-1 cursor-pointer select-none min-w-[150px]" onClick={() => column.toggleSorting(isSorted === "asc")}>Category
            <span className={clsx("ml-1", isSorted ? "text-primary" : "text-gray-400")}> 
              <ChevronUp className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
              <ChevronDown className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
            </span>
          </div>
        )
      },
      cell: ({ row }) => (
        <span className="min-w-[150px]">{row.original.category || "N/A"}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "revenue",
      header: ({ column }) => {
        const isSorted = column.getIsSorted()
        return (
          <div className="flex items-center gap-1 cursor-pointer select-none min-w-[100px] whitespace-nowrap" onClick={() => column.toggleSorting(isSorted === "asc")}>Revenue
            <span className={clsx("ml-1", isSorted ? "text-primary" : "text-gray-400")}> 
              <ChevronUp className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
              <ChevronDown className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
            </span>
          </div>
        )
      },
      cell: ({ row }) => (
        <span>{row.original.price || "N/A"}</span>
      ),
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        return (rowA.original.revenue || 0) - (rowB.original.revenue || 0)
      },
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => (
        <span>{row.original.location || "N/A"}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        const isSorted = column.getIsSorted()
        return (
          <div className="flex items-center gap-1 cursor-pointer select-none min-w-[100px] whitespace-nowrap" onClick={() => column.toggleSorting(isSorted === "asc")}>Date
            <span className={clsx("ml-1", isSorted ? "text-primary" : "text-gray-400")}> 
              <ChevronUp className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
              <ChevronDown className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
            </span>
          </div>
        )
      },
      cell: ({ row }) => (
        <span>{formatDate(row.original.createdAt)}</span>
      ),
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.createdAt).getTime()
        const dateB = new Date(rowB.original.createdAt).getTime()
        return dateA - dateB
      },
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewValuation(row.original)}
            className="text-xs sm:text-sm"
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBookmark(row.original)}
            className="text-xs sm:text-sm"
          >
            <Bookmark className={`h-4 w-4 ${row.original.bookmarked ? "fill-yellow-400 text-yellow-400" : ""}`} />
          </Button>
          {onUpgrade && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpgrade(row.original)}
              className="text-xs sm:text-sm text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              Upgrade
            </Button>
          )}
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
    autoResetPageIndex: false,
  })

  return (
    <div className="space-y-4">
      {/* New Valuation Button */}
      <div className="flex justify-end sm:justify-end">
        <Button 
          size="lg" 
          className="rounded-full h-12 px-8 text-base w-full sm:w-auto"
          onClick={() => {
            if (onNewValuation) {
              onNewValuation()
            } else {
              router.push('/valuations')
            }
          }}
        >
          New Valuation
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search all columns..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-lg text-xs sm:text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs">Show only bookmarked</span>
          <Switch checked={showBookmarked} onCheckedChange={setShowBookmarked} />
        </div>
      </div>
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs">Results: {filteredCount} / {totalCount}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs">Results per page:</span>
          <Select value={String(table.getState().pagination.pageSize)} onValueChange={v => table.setPageSize(Number(v))}>
            <SelectTrigger className="w-20 h-8 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="text-xs sm:text-sm">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row, index) => (
                  <TableRow
                    key={`${row.original.title}|${row.original.location}|${index}`}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-xs sm:text-sm">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-xs sm:text-sm"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div>
            {table.getPageCount() > 1 && (
              <div className="flex gap-1">
                {Array.from({ length: table.getPageCount() }, (_, i) => (
                  <Button
                    key={i}
                    variant={table.getState().pagination.pageIndex === i ? "default" : "outline"}
                    size="sm"
                    onClick={() => table.setPageIndex(i)}
                    className="px-3 text-xs sm:text-sm"
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="text-xs sm:text-sm"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="text-xs sm:text-sm"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

