'use client';

// SOURCING: 21st/@jshguo/sidebar-component, installed as published (Frame760 /
// TwoLevelSidebar). Product shells export TwoLevelSidebarShell below; do not
// replace this file with a hand-rolled icon rail.
//
// Retokened onto the register (Twenty pass). The published file shipped raw
// Tailwind neutrals, rounded-lg, Lexend literals, and duration-500, none of
// which resolve here: register-bridge.css resets --color-*, --radius-*, and
// --font-* to initial, so those classes emitted nothing at all. Structure and
// behavior are untouched; only paint, arc, face, and motion now come from the
// register. Elevation follows the Twenty tiers: the icon rail is lifted
// (--ij-chrome), the detail panel is the frame, and wells are sunken
// (--ij-editor). The Carbon glyphs that remain drive the vendor's own Frame760
// demo content, which no product surface renders; every rail icon a user sees
// arrives through the `items` prop as a Noun Project mark.

import React, { useState, type ReactNode } from 'react';
import {
  Search as SearchIcon,
  Dashboard,
  Task,
  Folder,
  Calendar as CalendarIcon,
  UserMultiple,
  Analytics,
  DocumentAdd,
  Settings as SettingsIcon,
  User as UserIcon,
  ChevronDown as ChevronDownIcon,
  AddLarge,
  Filter,
  Time,
  InProgress,
  CheckmarkOutline,
  Flag,
  Archive,
  View,
  Report,
  StarFilled,
  Group,
  ChartBar,
  FolderOpen,
  Share,
  CloudUpload,
  Security,
  Notification,
  Integration,
} from '@carbon/icons-react';

/** ======================= Local SVG paths (inline) ======================= */
const svgPaths = {
  p10dcabc0: "M8 11L3 6.00001L3.7 5.30001L8 9.60001L12.3 5.30001L13 6.00001L8 11Z",
  p13593580:
    "M12 9C12.5523 9 13 8.55228 13 8C13 7.44772 12.5523 7 12 7C11.4477 7 11 7.44772 11 8C11 8.55228 11.4477 9 12 9Z",
  p154b5b00:
    "M14.5 13.793L10.724 10.0169C11.6313 8.92758 12.0838 7.53039 11.9872 6.11596C11.8907 4.70154 11.2525 3.37879 10.2055 2.42289C9.15856 1.46699 7.78336 0.951523 6.36601 0.983731C4.94866 1.01594 3.59829 1.59334 2.59581 2.59581C1.59334 3.59829 1.01594 4.94866 0.983731 6.36601C0.951523 7.78336 1.46699 9.15856 2.42289 10.2055C3.37879 11.2525 4.70154 11.8907 6.11596 11.9872C7.53039 12.0838 8.92758 11.6313 10.0169 10.724L13.793 14.5L14.5 13.793ZM2 6.5C2 5.60999 2.26392 4.73996 2.75839 3.99994C3.25286 3.25992 3.95566 2.68314 4.77793 2.34255C5.6002 2.00195 6.505 1.91284 7.37791 2.08647C8.25082 2.2601 9.05265 2.68869 9.68198 3.31802C10.3113 3.94736 10.7399 4.74918 10.9135 5.6221C11.0872 6.49501 10.9981 7.39981 10.6575 8.22208C10.3169 9.04435 9.74009 9.74715 9.00007 10.2416C8.26005 10.7361 7.39002 11 6.5 11C5.30694 10.9987 4.16311 10.5242 3.31949 9.68052C2.47586 8.8369 2.00133 7.69307 2 6.5Z",
  p15853b70:
    "M0.528 0C0.343183 0 0.250774 0 0.180183 0.0359679C0.11809 0.0676061 0.0676061 0.11809 0.0359679 0.180183C0 0.250774 0 0.343183 0 0.528V9.097C0 9.28181 0 9.37422 0.0359678 9.44481C0.0676061 9.50691 0.11809 9.55739 0.180183 9.58903C0.250774 9.625 0.343183 9.625 0.528 9.625L4.972 9.625C5.15682 9.625 5.24923 9.625 5.31982 9.58903C5.38191 9.55739 5.43239 9.50691 5.46403 9.44481C5.5 9.37422 5.5 9.28182 5.5 9.097V6.028C5.5 5.84318 5.5 5.75077 5.53597 5.68018C5.56761 5.61809 5.61809 5.56761 5.68018 5.53597C5.75077 5.5 5.84318 5.5 6.028 5.5L26.972 5.5C27.1568 5.5 27.2492 5.5 27.3198 5.53597C27.3819 5.56761 27.4324 5.61809 27.464 5.68018C27.5 5.75077 27.5 5.84318 27.5 6.028V9.097C27.5 9.28182 27.5 9.37423 27.536 9.44482C27.5676 9.50691 27.6181 9.55739 27.6802 9.58903C27.7508 9.625 27.8432 9.625 28.028 9.625L32.472 9.625C32.6568 9.625 32.7492 9.625 32.8198 9.58903C32.8819 9.55739 32.9324 9.50691 32.964 9.44482C33 9.37423 33 9.28182 33 9.097V0.528C33 0.343183 33 0.250774 32.964 0.180183C32.9324 0.11809 32.8819 0.0676061 32.8198 0.0359679C32.7492 0 32.6568 0 32.472 0H0.528Z",
  p1a3cd600:
    "M8.778 13.75C8.59318 13.75 8.50077 13.75 8.43018 13.714C8.36809 13.6824 8.31761 13.6319 8.28597 13.5698C8.25 13.4992 8.25 13.4068 8.25 13.222V8.778C8.25 8.59318 8.25 8.50077 8.28597 8.43018C8.31761 8.36809 8.36809 8.31761 8.43018 8.28597C8.50077 8.25 8.59318 8.25 8.778 8.25L24.222 8.25C24.4068 8.25 24.4992 8.25 24.5698 8.28597C24.6319 8.31761 24.6824 8.36809 24.714 8.43018C24.75 8.50077 24.75 8.59318 24.75 8.778V13.222C24.75 13.4068 24.75 13.4992 24.714 13.5698C24.6824 13.6319 24.6319 13.6824 24.5698 13.714C24.4992 13.75 24.4068 13.75 24.222 13.75H8.778Z",
  p29bde780: "M4 9C4.55228 9 5 8.55228 5 8C5 7.44772 4.55228 7 4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9Z",
  p2b29ce00:
    "M13 15H12V12.5C12 12.1717 11.9353 11.8466 11.8097 11.5433C11.6841 11.24 11.4999 10.9644 11.2678 10.7322C11.0356 10.5001 10.76 10.3159 10.4567 10.1903C10.1534 10.0647 9.8283 10 9.5 10H6.5C5.83696 10 5.20107 10.2634 4.73223 10.7322C4.26339 11.2011 4 11.837 4 12.5V15H3V12.5C3 11.5717 3.36875 10.6815 4.02513 10.0251C4.6815 9.36875 5.57174 9 6.5 9H9.5C10.4283 9 11.3185 9.36875 11.9749 10.0251C12.6313 10.6815 13 11.5717 13 12.5V15Z",
  p35081d00:
    "M0.528 22C0.343183 22 0.250774 22 0.180183 21.964C0.11809 21.9324 0.0676061 21.8819 0.0359679 21.8198C0 21.7492 0 21.6568 0 21.472V12.903C0 12.7182 0 12.6258 0.0359679 12.5552C0.0676061 12.4931 0.11809 12.4426 0.180183 12.411C0.250774 12.375 0.343183 12.375 0.528 12.375H4.972C5.15682 12.375 5.24923 12.375 5.31982 12.411C5.38191 12.4426 5.43239 12.4931 5.46403 12.5552C5.5 12.6258 5.5 12.7182 5.5 12.903V15.972C5.5 16.1568 5.5 16.2492 5.53597 16.3198C5.56761 16.3819 5.61809 16.4324 5.68018 16.464C5.75077 16.5 5.84318 16.5 6.028 16.5L26.972 16.5C27.1568 16.5 27.2492 16.5 27.3198 16.464C27.3819 16.4324 27.4324 16.3819 27.464 16.3198C27.5 16.2492 27.5 16.1568 27.5 15.972V12.903C27.5 12.7182 27.5 12.6258 27.536 12.5552C27.5676 12.4931 27.6181 12.4426 27.6802 12.411C27.7508 12.375 27.8432 12.375 28.028 12.375H32.472C32.6568 12.375 32.7492 12.375 32.8198 12.411C32.8819 12.4426 32.9324 12.4931 32.964 12.5552C33 12.6258 33 12.7182 33 12.903V21.472C33 21.6568 33 21.7492 32.964 21.8198C32.9324 21.8819 32.8819 21.9324 32.8198 21.964C32.7492 22 32.6568 22 32.472 22H0.528Z",
  p355df480:
    "M0.32 16C0.20799 16 0.151984 16 0.109202 15.9782C0.0715695 15.959 0.0409734 15.9284 0.0217987 15.8908C0 15.848 0 15.792 0 15.68V9.32C0 9.20799 0 9.15198 0.0217987 9.1092C0.0409734 9.07157 0.0715695 9.04097 0.109202 9.0218C0.151984 9 0.207989 9 0.32 9H3.68C3.79201 9 3.84802 9 3.8908 9.0218C3.92843 9.04097 3.95903 9.07157 3.9782 9.1092C4 9.15198 4 9.20799 4 9.32V11.68C4 11.792 4 11.848 4.0218 11.8908C4.04097 11.9284 4.07157 11.959 4.1092 11.9782C4.15198 12 4.20799 12 4.32 12L19.68 12C19.792 12 19.848 12 19.8908 11.9782C19.9284 11.959 19.959 11.9284 19.9782 11.8908C20 11.848 20 11.792 20 11.68V9.32C20 9.20799 20 9.15199 20.0218 9.1092C20.041 9.07157 20.0716 9.04098 20.1092 9.0218C20.152 9 20.208 9 20.32 9H23.68C23.792 9 23.848 9 23.8908 9.0218C23.9284 9.04098 23.959 9.07157 23.9782 9.1092C24 9.15199 24 9.20799 24 9.32V15.68C24 15.792 24 15.848 23.9782 15.8908C23.959 15.9284 23.9284 15.959 23.8908 15.9782C23.848 16 23.792 16 23.68 16H0.32Z",
  p36880f80:
    "M0.32 0C0.20799 0 0.151984 0 0.109202 0.0217987C0.0715695 0.0409734 0.0409734 0.0715695 0.0217987 0.109202C0 0.151984 0 0.20799 0 0.32V6.68C0 6.79201 0 6.84801 0.0217987 6.8908C0.0409734 6.92843 0.0715695 6.95902 0.109202 6.9782C0.151984 7 0.207989 7 0.32 7L3.68 7C3.79201 7 3.84802 7 3.8908 6.9782C3.92843 6.95903 3.95903 6.92843 3.9782 6.8908C4 6.84801 4 6.79201 4 6.68V4.32C4 4.20799 4 4.15198 4.0218 4.1092C4.04097 4.07157 4.07157 4.04097 4.1092 4.0218C4.15198 4 4.20799 4 4.32 4L19.68 4C19.792 4 19.848 4 19.8908 4.0218C19.9284 4.04097 19.959 4.07157 19.9782 4.1092C20 4.15198 20 4.20799 20 4.32V6.68C20 6.79201 20 6.84802 20.0218 6.8908C20.041 6.92843 20.0716 6.95903 20.1092 6.9782C20.152 7 20.208 7 20.32 7L23.68 7C23.792 7 23.848 7 23.8908 6.9782C23.9284 6.95903 23.959 6.92843 23.9782 6.8908C24 6.84802 24 6.79201 24 6.68V0.32C24 0.20799 24 0.151984 23.9782 0.109202C23.959 0.0715695 23.9284 0.0409734 23.8908 0.0217987C23.848 0 23.792 0 23.68 0H0.32Z",
  p3801bf80:
    "M8 2C8.49445 2 8.9778 2.14662 9.38893 2.42133C9.80005 2.69603 10.1205 3.08648 10.3097 3.54329C10.4989 4.00011 10.5484 4.50277 10.452 4.98773C10.3555 5.47268 10.1174 5.91814 9.76777 6.26777C9.41814 6.6174 8.97268 6.8555 8.48773 6.95196C8.00277 7.04843 7.50011 6.99892 7.04329 6.8097C6.58648 6.62048 6.19603 6.30005 5.92133 5.88893C5.64662 5.4778 5.5 4.99445 5.5 4.5C5.5 3.83696 5.76339 3.20107 6.23223 2.73223C6.70107 2.26339 7.33696 2 8 2ZM8 1C7.30777 1 6.63108 1.20527 6.0555 1.58986C5.47993 1.97444 5.03133 2.52107 4.76642 3.16061C4.50152 3.80015 4.4322 4.50388 4.56725 5.18282C4.7023 5.86175 5.03564 6.48539 5.52513 6.97487C6.01461 7.46436 6.63825 7.7977 7.31718 7.93275C7.99612 8.0678 8.69985 7.99849 9.33939 7.73358C9.97893 7.46867 10.5256 7.02007 10.9101 6.4445C11.2947 5.86892 11.5 5.19223 11.5 4.5C11.5 3.57174 11.1313 2.6815 10.4749 2.02513C9.8185 1.36875 8.92826 1 8 1Z",
  p3af0dbf2: "M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z",
  p5113400:
    'M14.252 4.06808L8.25195 0.568081C8.17548 0.523469 8.08853 0.499962 8 0.499962C7.91147 0.499962 7.82452 0.523469 7.74805 0.568081L1.74805 4.06808C1.67257 4.11212 1.60994 4.17517 1.56642 4.25095C1.5229 4.32673 1.5 4.41259 1.5 4.49998V11.5C1.5 11.5874 1.5229 11.6732 1.56642 11.749C1.60994 11.8248 1.67257 11.8878 1.74805 11.9319L7.74805 15.4319C7.82452 15.4765 7.91147 15.5 8 15.5C8.08853 15.5 8.17548 15.4765 8.25195 15.4319L14.252 11.9319C14.3274 11.8878 14.3901 11.8248 14.4336 11.749C14.4771 11.6732 14.5 11.5874 14.5 11.5V4.49998C14.5 4.41259 14.4771 4.32673 14.4336 4.25095C14.3901 4.17517 14.3274 4.11212 14.252 4.06808ZM8 1.57883L13.0078 4.49998L8 7.42113L2.9922 4.49998L8 1.57883ZM2.5 5.37058L7.5 8.28708V14.1294L2.5 11.2129V5.37058ZM8.5 14.1294V8.28708L13.5 5.37058V11.2129L8.5 14.1294Z',
  pfa0d600:
    'M6.32 10C6.20799 10 6.15198 10 6.1092 9.9782C6.07157 9.95903 6.04097 9.92843 6.0218 9.8908C6 9.84802 6 9.79201 6 9.68V6.32C6 6.20799 6 6.15198 6.0218 6.1092C6.04097 6.07157 6.07157 6.04097 6.1092 6.0218C6.15198 6 6.20799 6 6.32 6L17.68 6C17.792 6 17.848 6 17.8908 6.0218C17.9284 6.04097 17.959 6.07157 17.9782 6.1092C18 6.15198 18 6.20799 18 6.32V9.68C18 9.79201 18 9.84802 17.9782 9.8908C17.959 9.92843 17.9284 9.95903 17.8908 9.9782C17.848 10 17.792 10 17.68 10H6.32Z',
};
/** ======================================================================= */

// Motion comes from the register: --ij-motion / --ij-ease, applied as
// duration-(--ij-motion) ease-(--ij-ease) so reduced motion (which pins
// --ij-motion to 0ms) settles this component with everything else.

/* ----------------------------- Brand / Logos ----------------------------- */

function InterfacesLogoSquare() {
  return (
    <div className="aspect-[24/24] grow min-h-px min-w-px overflow-clip relative shrink-0">
      <div className="absolute aspect-[24/16] left-0 right-0 top-1/2 -translate-y-1/2">
        <svg className="block size-full" fill="none" viewBox="0 0 24 16">
          <g>
            <path d={svgPaths.p36880f80} fill="var(--ij-ink)" />
            <path d={svgPaths.p355df480} fill="var(--ij-ink)" />
            <path d={svgPaths.pfa0d600} fill="var(--ij-ink)" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function BrandBadge() {
  return (
    <div className="relative shrink-0 w-full">
      <div className="flex items-center p-1 w-full">
        <div className="h-10 w-8 flex items-center justify-center pl-2">
          <InterfacesLogoSquare />
        </div>
        <div className="px-2 py-1">
          <div className="font-ij-ui font-semibold text-ij-island-title text-ij-ink">
            Interfaces
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Avatar -------------------------------- */

function AvatarCircle() {
  return (
    <div className="relative rounded-full shrink-0 size-8 bg-ij-chrome">
      <div className="flex items-center justify-center size-8">
        <UserIcon size={16} className="text-ij-ink" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-ij-seam pointer-events-none"
      />
    </div>
  );
}

/* ------------------------------ Search Input ----------------------------- */

function SearchContainer({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [searchValue, setSearchValue] = useState("");

  return (
    <div
      className={`relative shrink-0 transition-all duration-(--ij-motion) ease-(--ij-ease) ${
        isCollapsed ? "w-full flex justify-center" : "w-full"
      }`}
    >
      <div
        className={`bg-ij-editor h-10 relative rounded-ij-arc flex items-center transition-all duration-(--ij-motion) ease-(--ij-ease) ${
          isCollapsed ? "w-10 min-w-10 justify-center" : "w-full"
        }`}
      >
        <div
          className={`flex items-center justify-center shrink-0 transition-all duration-(--ij-motion) ease-(--ij-ease) ${
            isCollapsed ? "p-1" : "px-1"
          }`}
          >
          <div className="size-8 flex items-center justify-center">
            <SearchIcon size={16} className="text-ij-ink" />
          </div>
        </div>

        <div
          className={`flex-1 relative transition-opacity duration-(--ij-motion) ease-(--ij-ease) overflow-hidden ${
            isCollapsed ? "opacity-0 w-0" : "opacity-100"
          }`}
          >
          <div className="flex flex-col justify-center size-full">
            <div className="flex flex-col gap-2 items-start justify-center pr-2 py-1 w-full">
              <input
                type="text"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full bg-transparent border-none outline-none font-ij-ui text-ij-ink placeholder:text-ij-ink-disabled"
                tabIndex={isCollapsed ? -1 : 0}
              />
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-ij-arc border border-ij-seam pointer-events-none"
        />
      </div>
    </div>
  );
}

/* --------------------------- Types / Content Map -------------------------- */

interface MenuItemT {
  icon?: React.ReactNode;
  label: string;
  hasDropdown?: boolean;
  isActive?: boolean;
  children?: MenuItemT[];
}
interface MenuSectionT {
  title: string;
  items: MenuItemT[];
}
interface SidebarContent {
  title: string;
  sections: MenuSectionT[];
}

function getSidebarContent(activeSection: string): SidebarContent {
  const contentMap: Record<string, SidebarContent> = {
    dashboard: {
      title: "Dashboard",
      sections: [
        {
          title: "Dashboard Types",
          items: [
            { icon: <View size={16} className="text-ij-ink" />, label: "Overview", isActive: true },
            {
              icon: <Dashboard size={16} className="text-ij-ink" />,
              label: "Executive Summary",
              hasDropdown: true,
              children: [
                { label: "Revenue Overview" },
                { label: "Key Performance Indicators" },
                { label: "Strategic Goals Progress" },
                { label: "Department Highlights" },
              ],
            },
            {
              icon: <ChartBar size={16} className="text-ij-ink" />,
              label: "Operations Dashboard",
              hasDropdown: true,
              children: [
                { label: "Project Timeline" },
                { label: "Resource Allocation" },
                { label: "Team Performance" },
                { label: "Capacity Planning" },
              ],
            },
            {
              icon: <Analytics size={16} className="text-ij-ink" />,
              label: "Financial Dashboard",
              hasDropdown: true,
              children: [
                { label: "Budget vs Actual" },
                { label: "Cash Flow Analysis" },
                { label: "Expense Breakdown" },
                { label: "Profit & Loss Summary" },
              ],
            },
          ],
        },
        {
          title: "Report Summaries",
          items: [
            {
              icon: <Report size={16} className="text-ij-ink" />,
              label: "Weekly Reports",
              hasDropdown: true,
              children: [
                { label: "Team Productivity: 87% ↑" },
                { label: "Project Completion: 12/15" },
                { label: "Budget Utilization: 73%" },
                { label: "Client Satisfaction: 4.6/5" },
              ],
            },
            {
              icon: <StarFilled size={16} className="text-ij-ink" />,
              label: "Monthly Insights",
              hasDropdown: true,
              children: [
                { label: "Revenue Growth: +15.3%" },
                { label: "New Clients: 24" },
                { label: "Team Expansion: 8 hires" },
                { label: "Cost Reduction: 7.2%" },
              ],
            },
            {
              icon: <View size={16} className="text-ij-ink" />,
              label: "Quarterly Analysis",
              hasDropdown: true,
              children: [
                { label: "Market Position: Improved" },
                { label: "ROI: 23.4%" },
                { label: "Customer Retention: 92%" },
                { label: "Innovation Index: 8.7/10" },
              ],
            },
          ],
        },
        {
          title: "Business Intelligence",
          items: [
            {
              icon: <ChartBar size={16} className="text-ij-ink" />,
              label: "Performance Metrics",
              hasDropdown: true,
              children: [
                { label: "Sales Conversion: 34.2%" },
                { label: "Lead Response Time: 2.3h" },
                { label: "Customer Lifetime Value: $4,280" },
                { label: "Churn Rate: 3.1%" },
              ],
            },
            {
              icon: <Analytics size={16} className="text-ij-ink" />,
              label: "Predictive Analytics",
              hasDropdown: true,
              children: [
                { label: "Q4 Revenue Forecast: $2.4M" },
                { label: "Resource Demand: High" },
                { label: "Market Trends: Positive" },
                { label: "Risk Assessment: Low" },
              ],
            },
          ],
        },
      ],
    },

    tasks: {
      title: "Tasks",
      sections: [
        {
          title: "Quick Actions",
          items: [
            { icon: <AddLarge size={16} className="text-ij-ink" />, label: "New task" },
            { icon: <Filter size={16} className="text-ij-ink" />, label: "Filter tasks" },
          ],
        },
        {
          title: "My Tasks",
          items: [
            {
              icon: <Time size={16} className="text-ij-ink" />,
              label: "Due today",
              hasDropdown: true,
              children: [
                { icon: <Flag size={14} className="text-ij-ink-info" />, label: "Review design mockups" },
                { icon: <CheckmarkOutline size={14} className="text-ij-ink-info" />, label: "Update documentation" },
                { icon: <InProgress size={14} className="text-ij-ink-info" />, label: "Test new feature" },
              ],
            },
            {
              icon: <InProgress size={16} className="text-ij-ink" />,
              label: "In progress",
              hasDropdown: true,
              children: [
                { icon: <Task size={14} className="text-ij-ink-info" />, label: "Implement user auth" },
                { icon: <Task size={14} className="text-ij-ink-info" />, label: "Database migration" },
              ],
            },
            {
              icon: <CheckmarkOutline size={16} className="text-ij-ink" />,
              label: "Completed",
              hasDropdown: true,
              children: [
                { icon: <CheckmarkOutline size={14} className="text-ij-ink-info" />, label: "Fixed login bug" },
                { icon: <CheckmarkOutline size={14} className="text-ij-ink-info" />, label: "Updated dependencies" },
                { icon: <CheckmarkOutline size={14} className="text-ij-ink-info" />, label: "Code review completed" },
              ],
            },
          ],
        },
        {
          title: "Other",
          items: [
            {
              icon: <Flag size={16} className="text-ij-ink" />,
              label: "Priority tasks",
              hasDropdown: true,
              children: [
                { icon: <Flag size={14} className="text-ij-error" />, label: "Security update" },
                { icon: <Flag size={14} className="text-ij-warn" />, label: "Client presentation" },
              ],
            },
            { icon: <Archive size={16} className="text-ij-ink" />, label: "Archived" },
          ],
        },
      ],
    },

    projects: {
      title: "Projects",
      sections: [
        {
          title: "Quick Actions",
          items: [
            { icon: <AddLarge size={16} className="text-ij-ink" />, label: "New project" },
            { icon: <Filter size={16} className="text-ij-ink" />, label: "Filter projects" },
          ],
        },
        {
          title: "Active Projects",
          items: [
            {
              icon: <FolderOpen size={16} className="text-ij-ink" />,
              label: "Web Application",
              hasDropdown: true,
              children: [
                { icon: <Task size={14} className="text-ij-ink-info" />, label: "Frontend development" },
                { icon: <Task size={14} className="text-ij-ink-info" />, label: "API integration" },
                { icon: <Task size={14} className="text-ij-ink-info" />, label: "Testing & QA" },
              ],
            },
            {
              icon: <FolderOpen size={16} className="text-ij-ink" />,
              label: "Mobile App",
              hasDropdown: true,
              children: [
                { icon: <Task size={14} className="text-ij-ink-info" />, label: "UI/UX design" },
                { icon: <Task size={14} className="text-ij-ink-info" />, label: "Native development" },
              ],
            },
          ],
        },
        {
          title: "Other",
          items: [
            { icon: <CheckmarkOutline size={16} className="text-ij-ink" />, label: "Completed" },
            { icon: <Archive size={16} className="text-ij-ink" />, label: "Archived" },
          ],
        },
      ],
    },

    calendar: {
      title: "Calendar",
      sections: [
        {
          title: "Views",
          items: [
            { icon: <View size={16} className="text-ij-ink" />, label: "Month view" },
            { icon: <CalendarIcon size={16} className="text-ij-ink" />, label: "Week view" },
            { icon: <Time size={16} className="text-ij-ink" />, label: "Day view" },
          ],
        },
        {
          title: "Events",
          items: [
            {
              icon: <Time size={16} className="text-ij-ink" />,
              label: "Today's events",
              hasDropdown: true,
              children: [
                { icon: <UserMultiple size={14} className="text-ij-ink-info" />, label: "Team standup (9:00 AM)" },
                { icon: <UserIcon size={14} className="text-ij-ink-info" />, label: "Client call (2:00 PM)" },
                { icon: <UserMultiple size={14} className="text-ij-ink-info" />, label: "Project review (4:00 PM)" },
              ],
            },
            { icon: <CalendarIcon size={16} className="text-ij-ink" />, label: "Upcoming events" },
          ],
        },
        {
          title: "Quick Actions",
          items: [
            { icon: <AddLarge size={16} className="text-ij-ink" />, label: "New event" },
            { icon: <Share size={16} className="text-ij-ink" />, label: "Share calendar" },
          ],
        },
      ],
    },

    teams: {
      title: "Teams",
      sections: [
        {
          title: "My Teams",
          items: [
            {
              icon: <Group size={16} className="text-ij-ink" />,
              label: "Development Team",
              hasDropdown: true,
              children: [
                { icon: <UserIcon size={14} className="text-ij-ink-info" />, label: "John Doe (Lead)" },
                { icon: <UserIcon size={14} className="text-ij-ink-info" />, label: "Jane Smith" },
                { icon: <UserIcon size={14} className="text-ij-ink-info" />, label: "Mike Johnson" },
              ],
            },
            {
              icon: <Group size={16} className="text-ij-ink" />,
              label: "Design Team",
              hasDropdown: true,
              children: [
                { icon: <UserIcon size={14} className="text-ij-ink-info" />, label: "Sarah Wilson" },
                { icon: <UserIcon size={14} className="text-ij-ink-info" />, label: "Tom Brown" },
              ],
            },
          ],
        },
        {
          title: "Quick Actions",
          items: [
            { icon: <AddLarge size={16} className="text-ij-ink" />, label: "Invite member" },
            { icon: <UserMultiple size={16} className="text-ij-ink" />, label: "Manage teams" },
          ],
        },
      ],
    },

    analytics: {
      title: "Analytics",
      sections: [
        {
          title: "Reports",
          items: [
            { icon: <Report size={16} className="text-ij-ink" />, label: "Performance report" },
            { icon: <ChartBar size={16} className="text-ij-ink" />, label: "Task completion" },
            { icon: <Analytics size={16} className="text-ij-ink" />, label: "Team productivity" },
          ],
        },
        {
          title: "Insights",
          items: [
            {
              icon: <StarFilled size={16} className="text-ij-ink" />,
              label: "Key metrics",
              hasDropdown: true,
              children: [
                { icon: <CheckmarkOutline size={14} className="text-ij-ink-info" />, label: "Tasks completed: 24" },
                { icon: <Time size={14} className="text-ij-ink-info" />, label: "Avg. completion time: 2.5d" },
                { icon: <UserMultiple size={14} className="text-ij-ink-info" />, label: "Team efficiency: 87%" },
              ],
            },
          ],
        },
      ],
    },

    files: {
      title: "Files",
      sections: [
        {
          title: "Quick Actions",
          items: [
            { icon: <CloudUpload size={16} className="text-ij-ink" />, label: "Upload file" },
            { icon: <AddLarge size={16} className="text-ij-ink" />, label: "New folder" },
          ],
        },
        {
          title: "Recent Files",
          items: [
            {
              icon: <DocumentAdd size={16} className="text-ij-ink" />,
              label: "Recent documents",
              hasDropdown: true,
              children: [
                { icon: <DocumentAdd size={14} className="text-ij-ink-info" />, label: "Project proposal.pdf" },
                { icon: <DocumentAdd size={14} className="text-ij-ink-info" />, label: "Meeting notes.docx" },
                { icon: <DocumentAdd size={14} className="text-ij-ink-info" />, label: "Design specs.figma" },
              ],
            },
            { icon: <Share size={16} className="text-ij-ink" />, label: "Shared with me" },
          ],
        },
        {
          title: "Organization",
          items: [
            { icon: <Folder size={16} className="text-ij-ink" />, label: "All folders" },
            { icon: <Archive size={16} className="text-ij-ink" />, label: "Archived files" },
          ],
        },
      ],
    },

    settings: {
      title: "Settings",
      sections: [
        {
          title: "Account",
          items: [
            { icon: <UserIcon size={16} className="text-ij-ink" />, label: "Profile settings" },
            { icon: <Security size={16} className="text-ij-ink" />, label: "Security" },
            { icon: <Notification size={16} className="text-ij-ink" />, label: "Notifications" },
          ],
        },
        {
          title: "Workspace",
          items: [
            {
              icon: <SettingsIcon size={16} className="text-ij-ink" />,
              label: "Preferences",
              hasDropdown: true,
              children: [
                { icon: <View size={14} className="text-ij-ink-info" />, label: "Theme settings" },
                { icon: <Time size={14} className="text-ij-ink-info" />, label: "Time zone" },
                { icon: <Notification size={14} className="text-ij-ink-info" />, label: "Default notifications" },
              ],
            },
            { icon: <Integration size={16} className="text-ij-ink" />, label: "Integrations" },
          ],
        },
      ],
    },
  };

  return contentMap[activeSection] || contentMap.tasks;
}

/* ---------------------------- Left Icon Nav Rail -------------------------- */

function IconNavButton({
  children,
  isActive = false,
  onClick,
}: {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex items-center justify-center rounded-ij-arc size-10 min-w-10 transition-colors duration-(--ij-motion) ease-(--ij-ease)
        ${isActive ? "bg-ij-raised text-ij-ink" : "hover:bg-ij-raised text-ij-ink-disabled hover:text-ij-ink-info"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export type TwoLevelSidebarItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
};

function IconNavigation({
  activeSection,
  onSectionChange,
  items,
  brand,
  footer,
}: {
  activeSection: string;
  onSectionChange: (section: string) => void;
  items?: readonly TwoLevelSidebarItem[];
  brand?: ReactNode;
  footer?: ReactNode;
}) {
  const navItems: readonly TwoLevelSidebarItem[] = items ?? [
    { id: 'dashboard', icon: <Dashboard size={16} />, label: 'Dashboard' },
    { id: 'tasks', icon: <Task size={16} />, label: 'Tasks' },
    { id: 'projects', icon: <Folder size={16} />, label: 'Projects' },
    { id: 'calendar', icon: <CalendarIcon size={16} />, label: 'Calendar' },
    { id: 'teams', icon: <UserMultiple size={16} />, label: 'Teams' },
    { id: 'analytics', icon: <Analytics size={16} />, label: 'Analytics' },
    { id: 'files', icon: <DocumentAdd size={16} />, label: 'Files' },
  ];

  return (
    <aside
      data-jshguo-icon-rail
      className="bg-ij-chrome flex h-full min-h-0 w-16 flex-col items-center gap-2 rounded-l-ij-island border-r border-ij-seam p-4"
    >
      <div className="mb-2 flex size-10 items-center justify-center">
        {brand ?? (
          <div className="size-7">
            <InterfacesLogoSquare />
          </div>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        {navItems.map((item) => (
          <IconNavButton
            key={item.id}
            isActive={activeSection === item.id}
            onClick={() => onSectionChange(item.id)}
          >
            <span className="sr-only">{item.label}</span>
            {item.icon}
          </IconNavButton>
        ))}
      </div>

      <div className="flex-1" />

      <div className="flex w-full flex-col items-center gap-2">
        {footer ?? (
          <>
            <IconNavButton
              isActive={activeSection === 'settings'}
              onClick={() => onSectionChange('settings')}
            >
              <SettingsIcon size={16} />
            </IconNavButton>
            <div className="size-8">
              <AvatarCircle />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------ Right Sidebar ----------------------------- */

function SectionTitle({
  title,
  onToggleCollapse,
  isCollapsed,
}: {
  title: string;
  onToggleCollapse: () => void;
  isCollapsed: boolean;
}) {
  if (isCollapsed) {
    return (
      <div className="w-full flex justify-center transition-all duration-(--ij-motion) ease-(--ij-ease)">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center justify-center rounded-ij-arc size-10 min-w-10 transition-all duration-(--ij-motion) ease-(--ij-ease) hover:bg-ij-raised text-ij-ink-disabled hover:text-ij-ink-info"
            aria-label="Expand sidebar"
        >
          <span className="inline-block rotate-180">
            <ChevronDownIcon size={16} />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden transition-all duration-(--ij-motion) ease-(--ij-ease)">
      <div className="flex items-center justify-between">
        <div className="flex items-center h-10">
          <div className="px-2 py-1">
            <div className="font-ij-ui font-semibold text-ij-island-title text-ij-ink">
              {title}
            </div>
          </div>
        </div>
        <div className="pr-1">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center justify-center rounded-ij-arc size-10 min-w-10 transition-all duration-(--ij-motion) ease-(--ij-ease) hover:bg-ij-raised text-ij-ink-disabled hover:text-ij-ink-info"
                aria-label="Collapse sidebar"
          >
            <ChevronDownIcon size={16} className="-rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailSidebar({
  activeSection,
  isCollapsed: isCollapsedProp,
  onCollapsedChange,
  title,
  panel,
  brand,
}: {
  activeSection: string;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  title?: string;
  panel?: ReactNode;
  /* Same slot the icon rail already exposes, extended to the panel. Without
     it the published BrandBadge is hard-wired, so a product shell wearing
     this sidebar advertises the vendor's demo brand. */
  brand?: ReactNode;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = isCollapsedProp ?? internalCollapsed;
  const content = getSidebarContent(activeSection);
  const resolvedTitle = title ?? content.title;

  const toggleExpanded = (itemKey: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  const toggleCollapse = () => {
    const next = !isCollapsed;
    onCollapsedChange?.(next);
    if (isCollapsedProp === undefined) setInternalCollapsed(next);
  };

  return (
    <aside
      data-jshguo-detail-panel
      data-collapsed={isCollapsed ? 'true' : 'false'}
      className={`bg-ij-frame flex h-full min-h-0 flex-col items-start gap-4 rounded-r-ij-island p-4 transition-all duration-(--ij-motion) ease-(--ij-ease) ${
        isCollapsed ? 'w-16 min-w-16 !px-0 justify-center' : 'w-80'
      }`}
    >
      {!isCollapsed && (brand ?? <BrandBadge />)}

      <SectionTitle title={resolvedTitle} onToggleCollapse={toggleCollapse} isCollapsed={isCollapsed} />

      {panel ? (
        !isCollapsed ? (
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">{panel}</div>
        ) : null
      ) : (
        <>
          <SearchContainer isCollapsed={isCollapsed} />

          <div
            className={`flex w-full flex-col overflow-y-auto transition-all duration-(--ij-motion) ease-(--ij-ease) ${
              isCollapsed ? 'items-center gap-2' : 'items-start gap-4'
            }`}
              >
            {content.sections.map((section, index) => (
              <MenuSection
                key={`${activeSection}-${index}`}
                section={section}
                expandedItems={expandedItems}
                onToggleExpanded={toggleExpanded}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>

          {!isCollapsed && (
            <div className="mt-auto w-full border-t border-ij-seam pt-2">
              <div className="flex items-center gap-2 px-2 py-2">
                <AvatarCircle />
                <div className="font-ij-ui text-ij-ink">
                  Text content
                </div>
                <button
                  type="button"
                  className="ml-auto flex size-8 items-center justify-center rounded-ij-arc hover:bg-ij-raised"
                  aria-label="More"
                >
                  <svg className="size-4" viewBox="0 0 16 16" fill="none">
                    <circle cx="4" cy="8" r="1" fill="var(--ij-ink)" />
                    <circle cx="8" cy="8" r="1" fill="var(--ij-ink)" />
                    <circle cx="12" cy="8" r="1" fill="var(--ij-ink)" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

/* ------------------------------ Menu Elements ---------------------------- */

function MenuItem({
  item,
  isExpanded,
  onToggle,
  onItemClick,
  isCollapsed,
}: {
  item: MenuItemT;
  isExpanded?: boolean;
  onToggle?: () => void;
  onItemClick?: () => void;
  isCollapsed?: boolean;
}) {
  const handleClick = () => {
    if (item.hasDropdown && onToggle) onToggle();
    else onItemClick?.();
  };

  return (
    <div
      className={`relative shrink-0 transition-all duration-(--ij-motion) ease-(--ij-ease) ${
        isCollapsed ? "w-full flex justify-center" : "w-full"
      }`}
    >
      <div
        className={`rounded-ij-arc cursor-pointer transition-all duration-(--ij-motion) ease-(--ij-ease) flex items-center relative ${
          item.isActive ? "bg-ij-raised" : "hover:bg-ij-raised"
        } ${isCollapsed ? "w-10 min-w-10 h-10 justify-center p-4" : "w-full h-10 px-4 py-2"}`}
        onClick={handleClick}
        title={isCollapsed ? item.label : undefined}
      >
        <div className="flex items-center justify-center shrink-0">{item.icon}</div>

        <div
          className={`flex-1 relative transition-opacity duration-(--ij-motion) ease-(--ij-ease) overflow-hidden ${
            isCollapsed ? "opacity-0 w-0" : "opacity-100 ml-3"
          }`}
          >
          <div className="font-ij-ui text-ij-ink truncate">
            {item.label}
          </div>
        </div>

        {item.hasDropdown && (
          <div
            className={`flex items-center justify-center shrink-0 transition-opacity duration-(--ij-motion) ease-(--ij-ease) ${
              isCollapsed ? "opacity-0 w-0" : "opacity-100 ml-2"
            }`}
              >
            <ChevronDownIcon
              size={16}
              className="text-ij-ink transition-transform duration-(--ij-motion) ease-(--ij-ease)"
              style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SubMenuItem({ item, onItemClick }: { item: MenuItemT; onItemClick?: () => void }) {
  return (
    <div className="w-full pl-9 pr-1 py-[1px]">
      <div
        className="h-10 w-full rounded-ij-arc cursor-pointer transition-colors hover:bg-ij-raised flex items-center px-3 py-1"
        onClick={onItemClick}
      >
        <div className="flex-1 min-w-0">
          <div className="font-ij-ui text-ij-ink-info truncate">
            {item.label}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuSection({
  section,
  expandedItems,
  onToggleExpanded,
  isCollapsed,
}: {
  section: MenuSectionT;
  expandedItems: Set<string>;
  onToggleExpanded: (itemKey: string) => void;
  isCollapsed?: boolean;
}) {
  return (
    <div className="flex flex-col w-full">
      <div
        className={`relative shrink-0 w-full transition-all duration-(--ij-motion) ease-(--ij-ease) overflow-hidden ${
          isCollapsed ? "h-0 opacity-0" : "h-10 opacity-100"
        }`}
      >
        <div className="flex items-center h-10 px-4">
          <div className="font-ij-ui text-ij-ink-disabled">
            {section.title}
          </div>
        </div>
      </div>

      {section.items.map((item, index) => {
        const itemKey = `${section.title}-${index}`;
        const isExpanded = expandedItems.has(itemKey);
        return (
          <div key={itemKey} className="w-full flex flex-col">
            <MenuItem
              item={item}
              isExpanded={isExpanded}
              onToggle={() => onToggleExpanded(itemKey)}
              onItemClick={() => console.log(`Clicked ${item.label}`)}
              isCollapsed={isCollapsed}
            />
            {isExpanded && item.children && !isCollapsed && (
              <div className="flex flex-col gap-1 mb-2">
                {item.children.map((child, childIndex) => (
                  <SubMenuItem
                    key={`${itemKey}-${childIndex}`}
                    item={child}
                    onItemClick={() => console.log(`Clicked ${child.label}`)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- Layout -------------------------------- */

function TwoLevelSidebarDemo() {
  const [activeSection, setActiveSection] = useState('dashboard');

  return (
    <div className="flex h-[800px] flex-row">
      <IconNavigation activeSection={activeSection} onSectionChange={setActiveSection} />
      <DetailSidebar activeSection={activeSection} />
    </div>
  );
}

export type TwoLevelSidebarShellProps = {
  readonly items: readonly TwoLevelSidebarItem[];
  readonly activeSection: string;
  readonly onSectionChange: (section: string) => void;
  readonly panel: ReactNode;
  /** When false, the detail panel collapses to the published chevron control. */
  readonly panelOpen?: boolean;
  readonly onPanelOpenChange?: (open: boolean) => void;
  readonly title?: string;
  /** Compact mark for the icon rail's size-10 brand box. */
  readonly brand?: ReactNode;
  /** Mark plus wordmark for the detail panel's brand row. */
  readonly panelBrand?: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly 'data-testid'?: string;
};

/**
 * Product mount of the published jshguo TwoLevelSidebar: icon rail always on,
 * detail panel with injected CommonPlace content. Visual DNA stays in this file.
 */
export function TwoLevelSidebarShell({
  items,
  activeSection,
  onSectionChange,
  panel,
  panelOpen = true,
  onPanelOpenChange,
  title,
  brand,
  panelBrand,
  footer,
  className = '',
  'data-testid': testId,
}: TwoLevelSidebarShellProps) {
  return (
    <div
      data-jshguo-sidebar
      data-testid={testId}
      data-panel-open={panelOpen ? 'true' : 'false'}
      className={`flex h-full min-h-0 flex-row ${className}`}
    >
      <IconNavigation
        activeSection={activeSection}
        onSectionChange={(section) => {
          onSectionChange(section);
          if (!panelOpen) onPanelOpenChange?.(true);
        }}
        items={items}
        brand={brand}
        footer={footer}
      />
      <DetailSidebar
        activeSection={activeSection}
        isCollapsed={!panelOpen}
        onCollapsedChange={(collapsed) => onPanelOpenChange?.(!collapsed)}
        title={title}
        panel={panel}
        brand={panelBrand}
      />
    </div>
  );
}

/* ------------------------------- Root Frame ------------------------------ */

export function Frame760() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ij-chrome p-4">
      <TwoLevelSidebarDemo />
    </div>
  );
}

export default Frame760;
