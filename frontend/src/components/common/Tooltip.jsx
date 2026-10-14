import { useState } from 'react';

export default function Tooltip({
  content,
  children,
  position = 'top', // 'top', 'bottom', 'left', 'right'
}) {
  const [isVisible, setIsVisible] = useState(false);

  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && content && (
        <div
          role="tooltip"
          className={`
            absolute z-50 px-2 py-1 text-[11px] font-medium text-white bg-slate-900 rounded
            shadow-subtle whitespace-nowrap pointer-events-none transition-opacity duration-150
            ${posClasses[position] || posClasses.top}
          `}
        >
          {content}
        </div>
      )}
    </div>
  );
}
