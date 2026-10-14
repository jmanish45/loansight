import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Command,
  LayoutDashboard,
  FilePlus2,
  Files,
  CheckCircle2,
  Sparkles,
  Building,
  ArrowRight,
  ShieldCheck,
  Globe,
  Sliders,
  X,
  Zap,
} from 'lucide-react';
import { ROUTES } from '../../constants/routes';

export default function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const COMMAND_ITEMS = [
    {
      category: 'Navigation',
      id: 'nav-applicant',
      title: 'Applicant Portal Dashboard',
      description: 'View active loan applications and status pipeline',
      icon: LayoutDashboard,
      action: () => navigate(ROUTES.APPLICANT),
      badge: 'Applicant',
    },
    {
      category: 'Navigation',
      id: 'nav-apply',
      title: 'Start New Loan Application',
      description: 'Select lending partner bank and complete details',
      icon: FilePlus2,
      action: () => navigate(ROUTES.APPLY),
      badge: 'Action',
    },
    {
      category: 'Navigation',
      id: 'nav-officer',
      title: 'Officer Underwriting Workspace',
      description: 'Review pending applications, risk scores, and evidence',
      icon: CheckCircle2,
      action: () => navigate(ROUTES.OFFICER_DASHBOARD),
      badge: 'Officer',
    },
    {
      category: 'Navigation',
      id: 'nav-all-apps',
      title: 'All Applications Queue',
      description: 'Search and filter all submitted applications',
      icon: Files,
      action: () => navigate(ROUTES.OFFICER_APPLICATIONS),
      badge: 'Officer',
    },
    {
      category: 'Navigation',
      id: 'nav-landing',
      title: 'LoanSight AI Public Homepage',
      description: 'Underwriting intelligence platform overview',
      icon: Globe,
      action: () => navigate(ROUTES.HOME),
      badge: 'Public',
    },
    {
      category: 'AI & Underwriting',
      id: 'ai-copilot',
      title: 'AI Underwriting Copilot & Vector Rules',
      description: 'Query hybrid RAG engine and bank policy index',
      icon: Sparkles,
      action: () => navigate(`${ROUTES.OFFICER_DASHBOARD}`),
      badge: 'RAG Engine',
    },
    {
      category: 'System',
      id: 'sys-policies',
      title: 'HDFC & Partner Lending Policies',
      description: 'Inspect FOIR rules, age limits, and salary matrices',
      icon: Building,
      action: () => navigate(ROUTES.OFFICER_DASHBOARD),
      badge: 'Policies',
    },
  ];

  const filteredItems = COMMAND_ITEMS.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.badge.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [isOpen, filteredItems, selectedIndex, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4 animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center gap-3">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search applications, or jump to page... (Press ESC to exit)"
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Items List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching commands or pages found.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition text-left cursor-pointer ${
                    isSelected ? 'bg-emerald-500/15 border border-emerald-500/30' : 'hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item.title}</span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{item.description}</p>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition ${
                      isSelected ? 'text-emerald-400 translate-x-1' : 'text-slate-600'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">↵</kbd> Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">ESC</kbd> Close
            </span>
          </div>
          <span className="hidden sm:inline text-emerald-400">LoanSight Command Engine v2.0</span>
        </div>
      </div>
    </div>
  );
}
