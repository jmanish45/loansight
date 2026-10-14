import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Dropdown({
  trigger,
  items = [],
  align = 'left', // 'left', 'right'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const alignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger || (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            Options <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          role="menu"
          className={`
            absolute ${alignClass} z-50 mt-1 w-48 rounded-md bg-white border border-slate-200 shadow-panel py-1 text-xs font-medium text-slate-700 focus:outline-none animate-fade-in
          `}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={idx} className="my-1 border-t border-slate-100" />;
            }
            return (
              <button
                key={item.label || idx}
                role="menuitem"
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setIsOpen(false);
                }}
                disabled={item.disabled}
                className={`
                  w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                  ${item.danger ? 'text-red-600 hover:bg-red-50' : ''}
                `}
              >
                {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
