import React from 'react';

export const CricketIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {/* Cricket Bat */}
      <path d="M14.5 2.5L3.5 13.5L6.5 16.5L17.5 5.5L14.5 2.5Z" />
      <path d="M17.5 5.5L20.5 8.5" />
      {/* Cricket Ball */}
      <circle cx="18" cy="18" r="3" fill="currentColor" fillOpacity="0.2" />
      <path d="M15.5 16.5a3 3 0 0 1 5 3" />
    </svg>
  );
};
