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
import { Star, Phone, Mail, Globe, Bookmark, CheckCircle, Facebook, Instagram, Twitter, MapPin, ChevronUp, ChevronDown } from "lucide-react"
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
  checked: boolean
  bookmarked?: boolean
  location: string
}

interface UserBusinessTableProps {
  results: BusinessResult[]
  onViewDashboard: (business: BusinessResult) => void
  onBookmark: (business: BusinessResult) => void
}

export function UserOffMarketTable({
  results,
  onViewDashboard,
  onBookmark,
}: UserBusinessTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [showBookmarked, setShowBookmarked] = useState(false)
  const [filterWebsite, setFilterWebsite] = useState(false)
  const [filterEmail, setFilterEmail] = useState(false)
  const [filterPhone, setFilterPhone] = useState(false)

  const tableData = useMemo(() => {
    let data = Array.isArray(results) ? results : []
    if (showBookmarked) {
      data = data.filter((b) => b.bookmarked)
    }
    if (filterWebsite) {
      data = data.filter((b) => b.website && b.website.trim() !== "")
    }
    if (filterEmail) {
      data = data.filter((b) => b.emails && b.emails.length > 0)
    }
    if (filterPhone) {
      data = data.filter((b) => b.phones && b.phones.length > 0)
    }
    return data
  }, [results, showBookmarked, filterWebsite, filterEmail, filterPhone])

  const totalCount = Array.isArray(results) ? results.length : 0
  const filteredCount = tableData.length

  const columns: ColumnDef<BusinessResult & { bookmarked?: boolean }>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => {
        const isSorted = column.getIsSorted()
        return (
          <div className="flex items-center gap-1 cursor-pointer select-none min-w-[100px] whitespace-nowrap" onClick={() => column.toggleSorting(isSorted === "asc")}>Name
            <span className={clsx("ml-1", isSorted ? "text-primary" : "text-gray-400")}> 
              <ChevronUp className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
              <ChevronDown className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
            </span>
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.original.title}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "address",
      header: "Address",
    },
    {
      accessorKey: "url",
      header: "Location",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(row.original.url, "_blank")}
        >
          <MapPin className="h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "website",
      header: "Website",
      cell: ({ row }) => (
        row.original.website ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(row.original.website, "_blank")}
          >
            <Globe className="h-4 w-4" />
          </Button>
        ) : null
      ),
    },
    {
      accessorKey: "totalScore",
      header: ({ column }) => {
        const isSorted = column.getIsSorted()
        return (
          <div className="flex items-center gap-1 cursor-pointer select-none min-w-[100px] whitespace-nowrap" onClick={() => column.toggleSorting(isSorted === "asc")}>Rating
            <span className={clsx("ml-1", isSorted ? "text-primary" : "text-gray-400")}> 
              <ChevronUp className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
              <ChevronDown className={clsx("h-3 w-3", !isSorted && "opacity-60")} style={{ display: "inline" }} />
            </span>
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span>{row.original.totalScore.toFixed(1)}</span>
          <span className="text-gray-500">({row.original.reviewsCount})</span>
        </div>
      ),
      enableSorting: true,
      sortingFn: 'auto',
    },
    {
      header: "Social",
      cell: ({ row }) => {
        const socials = [
          ...row.original.facebooks.map((fb: string) => ({ type: 'facebook', url: fb })),
          ...row.original.instagrams.map((ig: string) => ({ type: 'instagram', url: ig })),
          ...row.original.twitters.map((tw: string) => ({ type: 'twitter', url: tw })),
        ]
        const maxIcons = 6
        const shown = socials.slice(0, maxIcons)
        const extra = socials.length - maxIcons
        return (
          <div className="grid grid-cols-3 gap-1">
            {shown.map((item, index) => (
              <TooltipProvider key={item.type + '-' + index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(item.url, "_blank")}
                    >
                      {item.type === 'facebook' && <Facebook className="h-4 w-4" />}
                      {item.type === 'instagram' && <Instagram className="h-4 w-4" />}
                      {item.type === 'twitter' && <Twitter className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {extra > 0 && (
              <span className="col-span-3 text-xs rounded-full bg-muted px-2 py-0.5 text-center">+{extra}</span>
            )}
          </div>
        )
      },
    },
    {
      header: "Phone",
      cell: ({ row }) => {
        const maxIcons = 6
        const shown = row.original.phones.slice(0, maxIcons)
        const extra = row.original.phones.length - maxIcons
        return (
          <div className="grid grid-cols-3 gap-1">
            {shown.map((phone: string, index: number) => (
              <TooltipProvider key={index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8">
                      <Phone className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{phone}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {extra > 0 && (
              <span className="col-span-3 text-xs rounded-full bg-muted px-2 py-0.5 text-center">+{extra}</span>
            )}
          </div>
        )
      },
    },
    {
      header: "Email",
      cell: ({ row }) => {
        const maxIcons = 6
        const shown = row.original.emails.slice(0, maxIcons)
        const extra = row.original.emails.length - maxIcons
        return (
          <div className="grid grid-cols-3 gap-1">
            {shown.map((email: string, index: number) => (
              <TooltipProvider key={index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8">
                      <Mail className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{email}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {extra > 0 && (
              <span className="col-span-3 text-xs rounded-full bg-muted px-2 py-0.5 text-center">+{extra}</span>
            )}
          </div>
        )
      },
    },
    {
      id: "checked",
      header: () => <div className="w-full">Analysis</div>,
      cell: ({ row }) => (
        row.original.checked ? (
          <CheckCircle className="h-5 w-5 text-green-500" aria-label="Checked" />
        ) : null
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
          >
            View Dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBookmark(row.original)}
          >
            <Bookmark className={`h-4 w-4 ${row.original.bookmarked ? "fill-yellow-400 text-yellow-400" : ""}`} />
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search all columns..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Show only bookmarked</span>
          <Switch checked={showBookmarked} onCheckedChange={setShowBookmarked} />
        </div>
      </div>
      <div className="flex items-center gap-4 pb-2">
        <div className="flex items-center gap-2">
          <Checkbox checked={filterWebsite} onCheckedChange={checked => setFilterWebsite(checked === true)} id="website-filter" />
          <label htmlFor="website-filter" className="text-sm">Has website</label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={filterEmail} onCheckedChange={checked => setFilterEmail(checked === true)} id="email-filter" />
          <label htmlFor="email-filter" className="text-sm">Has email</label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={filterPhone} onCheckedChange={checked => setFilterPhone(checked === true)} id="phone-filter" />
          <label htmlFor="phone-filter" className="text-sm">Has phone</label>
        </div>
      </div>
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs">Results: {filteredCount} / {totalCount}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs">Results per page:</span>
          <Select value={String(table.getState().pagination.pageSize)} onValueChange={v => table.setPageSize(Number(v))}>
            <SelectTrigger className="w-20 h-8">
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
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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
                    className={row.original.checked ? "bg-green-50" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={['checked', 'url'].includes(cell.column.id) ? 'text-left' : ''}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
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
                    className="px-3"
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
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
