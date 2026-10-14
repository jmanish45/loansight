import { useState, useRef } from 'react';

export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
}) {
  const [selectedTab, setSelectedTab] = useState(activeTab || tabs[0]?.id);
  const currentTab = activeTab !== undefined ? activeTab : selectedTab;
  const tabListRef = useRef(null);

  const handleSelect = (id) => {
    if (activeTab === undefined) setSelectedTab(id);
    if (onChange) onChange(id);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % tabs.length;
      handleSelect(tabs[nextIndex].id);
      tabListRef.current?.children[nextIndex]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + tabs.length) % tabs.length;
      handleSelect(tabs[prevIndex].id);
      tabListRef.current?.children[prevIndex]?.focus();
    }
  };

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="Content sections"
      className={`flex items-center gap-1 border-b border-slate-200 overflow-x-auto scrollbar-none ${className}`}
    >
      {tabs.map((tab, idx) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleSelect(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`
              inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold tracking-tight border-b-2 transition-colors duration-150 cursor-pointer whitespace-nowrap outline-none
              ${isActive
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }
            `}
          >
            {tab.icon && <tab.icon className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.2 text-[10px] rounded font-mono ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
