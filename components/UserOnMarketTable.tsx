"use client"

import { useState, useMemo, useEffect } from "react"
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
import { Star, Phone, Mail, Globe, Bookmark, CheckCircle, Facebook, Instagram, Twitter, MapPin, ChevronUp, ChevronDown, ChevronRight } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import clsx from "clsx"
import { Select } from "@/components/ui/select"
import { SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import Link from "next/link"

export interface BusinessResult {
  title: string
  address: string
  website: string
  url: string
  phones: string[]
  emails: string[]
  facebooks: string[]
  instagrams: string[]
  twitters: string[]
  totalScore: number
  reviewsCount: number
  link: string
  price: string
  location: string
  checked: boolean
  bookmarked?: boolean
  contacted?: boolean
}

interface UserBusinessTableProps {
  results: BusinessResult[]
  onViewDashboard: (business: BusinessResult) => void
  onBookmark: (business: BusinessResult) => void
  onContact: (business: BusinessResult) => void
  onAnalyzeNew?: () => void
}

export function UserOnMarketTable({
  results,
  onViewDashboard,
  onBookmark,
  onContact,
  onAnalyzeNew,
}: UserBusinessTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [showBookmarked, setShowBookmarked] = useState(false)
  const [filterByPrice, setFilterByPrice] = useState(false)
  const [minPrice, setMinPrice] = useState<string>("any")
  const [maxPrice, setMaxPrice] = useState<string>("any")
  const [contactedLinks, setContactedLinks] = useState<string[]>([])
  const priceCategories = [
    { label: "$100,000", value: "100000" },
    { label: "$500,000", value: "500000" },
    { label: "$1,000,000", value: "1000000" },
    { label: "$2,000,000", value: "2000000" },
  ]

  const tableData = useMemo(() => {
    let data = Array.isArray(results) ? results : []
    if (showBookmarked) {
      data = data.filter((b) => b.bookmarked)
    }
    if (filterByPrice) {
      data = data.filter((b) => {
        const priceNum = parseInt((b.price || "").replace(/[^\d]/g, ""), 10)
        const min = minPrice !== "any" ? parseInt(minPrice, 10) : null
        const max = maxPrice !== "any" ? parseInt(maxPrice, 10) : null
        if (min !== null && priceNum < min) return false
        if (max !== null && priceNum > max) return false
        return true
      })
    }
    return data
  }, [results, showBookmarked, filterByPrice, minPrice, maxPrice])

  const totalCount = Array.isArray(results) ? results.length : 0
  const filteredCount = tableData.length

  const columns: ColumnDef<BusinessResult>[] = [
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
      accessorKey: "website",
      header: "Link",
      cell: ({ row }) => (
        row.original.website ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(row.original.website, "_blank")}
            className="p-0"
          >
            <Globe className="h-4 w-4" />
          </Button>
        ) : null
      ),
      size: 48,
      minSize: 40,
    },
    {
      accessorKey: "price",
      header: ({ column }) => {
        const isSorted = column.getIsSorted()
        return (
          <div className="flex items-center gap-1 cursor-pointer select-none min-w-[100px] whitespace-nowrap" onClick={() => column.toggleSorting(isSorted === "asc")}>Price
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
        const parse = (val: string | undefined) => parseInt((val || "").replace(/[^\d]/g, ""), 10) || 0
        return parse(rowA.original.price) - parse(rowB.original.price)
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
      id: "contacted",
      header: () => <div className="w-full">Contacted</div>,
      cell: ({ row }) => (
        <Checkbox 
          checked={row.original.contacted || false}
          onCheckedChange={(checked) => {
            // Update contacted state
            const updatedResults = results.map(b => 
              b.link === row.original.link 
                ? { ...b, contacted: checked === true }
                : b
            )
            // This would need to be handled by parent component
            // For now, just call onContact
            onContact(row.original)
          }}
        />
      ),
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDashboard(row.original)}
            className="text-xs sm:text-sm"
          >
            Dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBookmark(row.original)}
            className="text-xs sm:text-sm"
          >
            <Bookmark className={`h-4 w-4 ${row.original.bookmarked ? "fill-yellow-400 text-yellow-400" : ""}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Placeholder for checklist functionality
              console.log("Checklist clicked for:", row.original.title)
            }}
            className="text-xs sm:text-sm"
          >
            Checklist
          </Button>
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
      {/* New Analysis Button */}
      <div className="flex justify-end sm:justify-end">
        <Button 
          size="lg" 
          className="rounded-full h-12 px-8 text-base w-full sm:w-auto"
          onClick={onAnalyzeNew}
        >
          New Analysis
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
      <div className="flex flex-wrap items-center gap-4 gap-y-2 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Checkbox checked={filterByPrice} onCheckedChange={checked => setFilterByPrice(checked === true)} id="price-filter" />
          <label htmlFor="price-filter" className="text-xs">Filter by price</label>
          {filterByPrice && (
            <>
              <Select value={minPrice} onValueChange={setMinPrice}>
                <SelectTrigger className="w-full sm:w-28 h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="Min price" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Min price</SelectItem>
                  {priceCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="mx-1 text-xs">to</span>
              <Select value={maxPrice} onValueChange={setMaxPrice}>
                <SelectTrigger className="w-full sm:w-28 h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="Max price" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Max price</SelectItem>
                  {priceCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
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
                    key={`${row.original.title}|${row.original.address}|${index}`}
                    data-state={row.getIsSelected() && "selected"}
                    className={row.original.contacted ? "bg-green-50" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={`text-xs sm:text-sm ${cell.column.id === 'link' ? 'text-left w-12' : ['checked'].includes(cell.column.id) ? 'text-left' : ''}`}>
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
