'use client';

import React from 'react';

export default function Header() {
  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-white border-b border-surface-200 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="logo text-xl font-bold text-primary">RUM Monitor</div>
      </div>
      {/* Right side of header is now empty */}
      <div></div>
    </header>
  );
}