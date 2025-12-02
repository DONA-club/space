"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import PsychrometricChart from "@/components/PsychrometricChart";
import { Undo2, Redo2, Globe, UploadCloud, FileJson, Grid2x2, Grid, Info, Ruler, ChartLine } from "lucide-react";

const Toolbar = () => {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b bg-white/80 backdrop-blur-sm">
      {/* Left groups */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled className="uppercase tracking-wide">PSYCHROMETRY:</Button>
        <Button variant="outline" size="icon" disabled className="h-8 w-8" aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" disabled className="h-8 w-8" aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Globe className="h-4 w-4" />
              Weather Station
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Weather Station</DropdownMenuLabel>
            <DropdownMenuItem>Load Weather File...</DropdownMenuItem>
            <DropdownMenuItem>Find Weather Station...</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Example Data</DropdownMenuLabel>
            <DropdownMenuItem>1. London, England</DropdownMenuItem>
            <DropdownMenuItem>2. Perth, Western Australia</DropdownMenuItem>
            <DropdownMenuItem>3. New York, USA</DropdownMenuItem>
            <DropdownMenuItem>4. Singapore</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Import/Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Import/Export</DropdownMenuLabel>
            <DropdownMenuItem>Import Point Data...</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Export Psychrometric Data...</DropdownMenuItem>
            <DropdownMenuItem>Export as SVG...</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <FileJson className="h-4 w-4" />
              Settings Data
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Settings Data</DropdownMenuLabel>
            <DropdownMenuItem>Load Settings...</DropdownMenuItem>
            <DropdownMenuItem>Save Settings...</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Edit Settings as JSON...</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Store Settings as Default...</DropdownMenuItem>
            <DropdownMenuItem>Clear Default Settings...</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right groups */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm">UNITS</Button>
        <Tooltip>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Chart settings">
            <Grid className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Tooltip>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Overlay data scale">
            <Grid2x2 className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Tooltip>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Chart padding">
            <Ruler className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Tooltip>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Information">
            <Info className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

const PanelSection: React.FC<{ title: string; defaultOpen?: boolean; children?: React.ReactNode }> = ({ title, defaultOpen = true, children }) => {
  return (
    <Card className="mb-2 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold bg-gray-100">{title}</div>
      {defaultOpen && <div className="p-2">{children}</div>}
    </Card>
  );
};

const LeftPanels = () => {
  return (
    <div className="w-[240px] p-2">
      <PanelSection title="DATA MAPPING">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm">Load EPW...</Button>
          <Button variant="outline" size="sm">Load CSV...</Button>
        </div>
        <Separator className="my-2" />
        <Button variant="outline" size="sm" className="w-full">Select Display Metric...</Button>
        <Separator className="my-2" />
        <div className="flex items-center gap-2 text-xs">
          <Checkbox id="show-date-range" />
          <label htmlFor="show-date-range" className="cursor-pointer">Show Date Range Selector</label>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm">Year</Button>
          <Button variant="outline" size="sm">Month</Button>
          <Button variant="outline" size="sm">Day</Button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm">Snapshot</Button>
          <Button variant="outline" size="sm">Regions</Button>
        </div>
      </PanelSection>

      <PanelSection title="COMFORT OVERLAY" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="col-span-2">Reset</Button>
          <Button variant="outline" size="sm" className="col-span-2">Options</Button>
        </div>
      </PanelSection>

      <PanelSection title="PROCESS LINES">
        <div className="flex items-center gap-2 text-xs">
          <Checkbox id="show-indicator" />
          <label htmlFor="show-indicator" className="cursor-pointer">Show Position Indicator</label>
        </div>
        <div className="mt-2 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Dry-Bulb Temperature:</span>
            <span className="font-mono">23.0°C</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Relative Humidity:</span>
            <span className="font-mono">40.0 %</span>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="w-full">Normal</Button>
          <Button variant="outline" size="sm" className="w-full">Precise</Button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm">Add Point</Button>
          <Button variant="outline" size="sm">Points</Button>
        </div>
      </PanelSection>

      <PanelSection title="CHART METRICS">
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2"><Checkbox id="m-dbt" defaultChecked /><label htmlFor="m-dbt">Dry-Bulb Temp.</label></div>
          <div className="flex items-center gap-2"><Checkbox id="m-ah" defaultChecked /><label htmlFor="m-ah">Absolute Humidity</label></div>
          <div className="flex items-center gap-2"><Checkbox id="m-rh" defaultChecked /><label htmlFor="m-rh">Relative Humidity</label></div>
          <div className="flex items-center gap-2"><Checkbox id="m-wbt" /><label htmlFor="m-wbt">Wet-Bulb Temp.</label></div>
          <div className="flex items-center gap-2"><Checkbox id="m-vp" /><label htmlFor="m-vp">Vapour Pressure</label></div>
          <div className="flex items-center gap-2"><Checkbox id="m-vol" /><label htmlFor="m-vol">Specific Volume</label></div>
          <div className="flex items-center gap-2"><Checkbox id="m-enth" /><label htmlFor="m-enth">Enthalpy</label></div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm">Default</Button>
          <Button variant="outline" size="sm">None</Button>
        </div>
      </PanelSection>

      <PanelSection title="WEATHER STATION">
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between"><span>Name:</span><span className="font-mono">[None]</span></div>
          <div className="flex items-center justify-between"><span>Region:</span><span className="font-mono">-</span></div>
          <div className="flex items-center justify-between"><span>Country:</span><span className="font-mono">-</span></div>
          <div className="flex items-center justify-between"><span>WMO:</span><span className="font-mono">-</span></div>
          <Separator className="my-2" />
          <div className="font-semibold text-[11px]">Geographic Location</div>
          <div className="flex items-center justify-between"><span>Latitude:</span><span className="font-mono">-</span></div>
          <div className="flex items-center justify-between"><span>Longitude:</span><span className="font-mono">-</span></div>
          <div className="flex items-center justify-between"><span>Timezone:</span><span className="font-mono">-</span></div>
          <div className="flex items-center justify-between"><span>Elevation:</span><span className="font-mono">-</span></div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm">Load...</Button>
          <Button variant="outline" size="sm">Find...</Button>
        </div>
      </PanelSection>
    </div>
  );
};

const ChartArea = () => {
  // Example point to mimic indicator (approx. from markdown snapshot)
  const points = [{ name: "Indicator", temperature: 23, absoluteHumidity: 7.09 }];
  const outdoorTemp = 29.0;

  return (
    <div className="flex-1 relative">
      <div className="absolute inset-0">
        <PsychrometricChart points={points} outdoorTemp={outdoorTemp} />
      </div>
      {/* Optional overlay for a crosshair-like indicator */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <ChartLine className="h-5 w-5 text-red-500 opacity-50" />
      </div>
    </div>
  );
};

const PsychroReplica: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <LeftPanels />
        <ChartArea />
      </div>
    </div>
  );
};

export default PsychroReplica;