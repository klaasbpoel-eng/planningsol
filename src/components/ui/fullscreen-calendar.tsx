"use client"

import * as React from "react"
import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfToday,
  startOfWeek,
} from "date-fns"
import { nl, type Locale } from "date-fns/locale"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusCircleIcon,
  SearchIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useMediaQuery } from "@/hooks/use-media-query"

export interface CalendarEvent {
  id: number | string
  name: string
  time: string
  datetime: string
  color?: string
}

export interface CalendarData {
  day: Date
  events: CalendarEvent[]
}

export interface FullScreenCalendarProps {
  data: CalendarData[]
  onDayClick?: (day: Date) => void
  onEventClick?: (event: CalendarEvent) => void
  onNewEvent?: () => void
  locale?: Locale
}

const colStartClasses = [
  "",
  "col-start-2",
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-6",
  "col-start-7",
]

export function FullScreenCalendar({ 
  data, 
  onDayClick, 
  onEventClick,
  onNewEvent,
  locale = nl 
}: FullScreenCalendarProps) {
  const today = startOfToday()
  const [selectedDay, setSelectedDay] = React.useState(today)
  const [currentMonth, setCurrentMonth] = React.useState(
    format(today, "MMM-yyyy")
  )
  const firstDayCurrentMonth = parse(currentMonth, "MMM-yyyy", new Date())
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayCurrentMonth, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(firstDayCurrentMonth), { weekStartsOn: 1 }),
  })

  function previousMonth() {
    const firstDayNextMonth = add(firstDayCurrentMonth, { months: -1 })
    setCurrentMonth(format(firstDayNextMonth, "MMM-yyyy"))
  }

  function nextMonth() {
    const firstDayNextMonth = add(firstDayCurrentMonth, { months: 1 })
    setCurrentMonth(format(firstDayNextMonth, "MMM-yyyy"))
  }

  function goToToday() {
    setCurrentMonth(format(today, "MMM-yyyy"))
    setSelectedDay(today)
  }

  const handleDayClick = (day: Date) => {
    setSelectedDay(day)
    onDayClick?.(day)
  }

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    onEventClick?.(event)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Calendar Header */}
      <div className="flex flex-col space-y-4 p-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="text-xs font-medium uppercase">
                {format(today, "MMM", { locale })}
              </span>
              <span className="text-xl font-bold">
                {format(today, "d")}
              </span>
            </div>
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold">
              {format(firstDayCurrentMonth, "MMMM yyyy", { locale })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {format(firstDayCurrentMonth, "d MMM yyyy", { locale })} -{" "}
              {format(endOfMonth(firstDayCurrentMonth), "d MMM yyyy", { locale })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="hidden md:flex">
            <SearchIcon className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="hidden h-6 md:block" />

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={previousMonth}>
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Vandaag
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="hidden h-6 md:block" />

          <Button size="sm" onClick={onNewEvent} className="hidden md:flex">
            <PlusCircleIcon className="mr-2 h-4 w-4" />
            Nieuw Event
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto border-t">
        {/* Week Days Header */}
        <div className="sticky top-0 z-10 grid grid-cols-7 border-b bg-background text-center text-sm font-medium text-muted-foreground">
          <div className="border-r py-2">Ma</div>
          <div className="border-r py-2">Di</div>
          <div className="border-r py-2">Wo</div>
          <div className="border-r py-2">Do</div>
          <div className="border-r py-2">Vr</div>
          <div className="border-r py-2">Za</div>
          <div className="py-2">Zo</div>
        </div>

        {/* Calendar Days */}
        <div className="flex-1">
          {isDesktop ? (
            <div className="grid grid-cols-7">
              {days.map((day, dayIdx) => (
                <div
                  key={day.toString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    dayIdx === 0 && colStartClasses[getDay(day) === 0 ? 6 : getDay(day) - 1],
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      !isSameMonth(day, firstDayCurrentMonth) &&
                      "bg-accent/50 text-muted-foreground",
                    "relative flex min-h-[120px] flex-col border-b border-r p-2 hover:bg-muted/50 cursor-pointer transition-colors",
                    isEqual(day, selectedDay) && "bg-accent",
                  )}
                >
                  <div className="flex justify-end">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-sm",
                        isToday(day) && "bg-primary text-primary-foreground font-semibold",
                        isEqual(day, selectedDay) && !isToday(day) && "bg-accent-foreground/10",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  <div className="mt-1 flex-1 space-y-1 overflow-hidden">
                    {data
                      .filter((event) => isSameDay(event.day, day))
                      .map((dayData) => (
                        <div key={dayData.day.toString()}>
                          {dayData.events.slice(0, 2).map((event) => (
                            <div
                              key={event.id}
                              onClick={(e) => handleEventClick(event, e)}
                              className={cn(
                                "mb-1 truncate rounded px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                event.color || "bg-primary/10 text-primary"
                              )}
                            >
                              <span className="truncate">{event.name}</span>
                              <span className="ml-1 opacity-70">{event.time}</span>
                            </div>
                          ))}
                          {dayData.events.length > 2 && (
                            <div className="px-2 text-xs text-muted-foreground">
                              + {dayData.events.length - 2} meer
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((day, dayIdx) => (
                <button
                  onClick={() => handleDayClick(day)}
                  key={day.toString()}
                  type="button"
                  className={cn(
                    isEqual(day, selectedDay) && "text-primary-foreground",
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      isSameMonth(day, firstDayCurrentMonth) &&
                      "text-foreground",
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      !isSameMonth(day, firstDayCurrentMonth) &&
                      "text-muted-foreground",
                    (isEqual(day, selectedDay) || isToday(day)) &&
                      "font-semibold",
                    "flex h-14 flex-col items-center border-b border-r px-1 py-2 hover:bg-muted focus:z-10",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday(day) && "bg-primary text-primary-foreground",
                      isEqual(day, selectedDay) && !isToday(day) && "bg-accent"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {data.filter((date) => isSameDay(date.day, day)).length > 0 && (
                    <div className="mt-1 flex gap-0.5">
                      {data
                        .filter((date) => isSameDay(date.day, day))
                        .slice(0, 3)
                        .map((date) => (
                          <div key={date.day.toString()} className="flex gap-0.5">
                            {date.events.slice(0, 2).map((event) => (
                              <div
                                key={event.id}
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  event.color ? event.color.split(" ")[0] : "bg-primary"
                                )}
                              />
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
