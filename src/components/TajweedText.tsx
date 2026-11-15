import React from 'react';

// Common tajweed classes from quran.com and their associated colors
const TAJWEED_COLORS: Record<string, string> = {
  ham_wasl: '#AAAAAA', // Gray (silent)
  laam_shamsiyah: '#AAAAAA', // Gray (silent)
  madda_normal: '#537EE8', // Blue
  madda_permissible: '#4050FF', // Dark blue
  madda_necessary: '#8A0707', // Dark red
  qalaqah: '#DD0008', // Red
  madda_obligatory: '#2144C1',
  ikhafa_shafawi: '#D500B7', // Pink
  ikhafa: '#9400A8', // Purple
  idgham_shafawi: '#58B800', // Green
  idgham_with_ghunnah: '#169777', // Teal
  idgham_without_ghunnah: '#169777',
  idgham_mutajanisayn: '#A1A1A1',
  idgham_mutaqaribayn: '#A1A1A1',
  ghunnah: '#FF7E1E', // Orange
};

interface TajweedTextProps {
  htmlContent: string;
  className?: string;
}

export const TajweedText: React.FC<TajweedTextProps> = ({ htmlContent, className = '' }) => {
  // We can use dangerouslySetInnerHTML, but we need to inject the CSS for the classes
  // Or we can parse and render. For safety and ease, we inject a style block
  
  const generateStyle = () => {
    return Object.entries(TAJWEED_COLORS)
      .map(([className, color]) => `tajweed.${className} { color: ${color}; }`)
      .join('\n');
  };

  return (
    <div className={`font-quran leading-loose ${className}`}>
      <style>{generateStyle()}</style>
      <div 
        dangerouslySetInnerHTML={{ __html: htmlContent }} 
        style={{ fontSize: '2rem', direction: 'rtl' }}
      />
    </div>
  );
};
