import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, children, className }) => {
  return (
    <div className={`bg-slate-800 rounded-lg shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-3 mb-4">
        {title}
      </h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};