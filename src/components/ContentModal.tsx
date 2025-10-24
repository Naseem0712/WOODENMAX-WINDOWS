import React from 'react';
import { Button } from './ui/Button';
import { XMarkIcon } from './icons/XMarkIcon';

interface ContentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Section: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
    <div className="mb-6">
        <h3 className="text-xl font-bold text-indigo-300 mb-2 border-b-2 border-indigo-500/30 pb-1">{title}</h3>
        <div className="space-y-3 text-slate-300 leading-relaxed">{children}</div>
    </div>
);

export const ContentModal: React.FC<ContentModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">About Our Design Platform</h2>
          <Button onClick={onClose} variant="secondary" className="p-2 rounded-full h-10 w-10">
            <XMarkIcon className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
            <Section title="Welcome to Real Vibe Studio">
                <p>
                    This powerful design and quotation tool is brought to you by <strong>WoodenMax Architectural Elements</strong>, a leader in innovative building solutions. Our online platform, hosted at <strong>realvibestudio.in</strong>, is engineered to provide fabricators, architects, and clients across India and the world with state-of-the-art design capabilities, completely free of charge.
                </p>
                 <p>
                    This tool was expertly designed and developed by <strong>WoodenMax</strong> to streamline the complexities of architectural fabrication.
                </p>
            </Section>

            <Section title="Our Flagship Window & Door Designer">
                <p>
                    Our initial offering on the Real Vibe Studio platform is this comprehensive window and door design software. It simplifies the entire workflow, from initial design to final quotation and material planning for all types of aluminium and uPVC profiles.
                </p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li>Design complex <strong>sliding window systems</strong>, including 2-track and 3-track configurations.</li>
                    <li>Create detailed plans for <strong>casement windows and hinged doors</strong>.</li>
                    <li>Effortlessly configure <strong>ventilators, fixed panels, and interior glass partitions</strong>.</li>
                    <li>Generate a complete <strong>Bill of Materials (BOM)</strong>, acting as a powerful cutting list software.</li>
                </ul>
            </Section>

            <Section title="Beyond Windows: Our Manufacturing Expertise">
                <p>
                    WoodenMax Architectural Elements is not just about windows. We specialize in the manufacturing of a wide range of high-quality architectural products:
                </p>
                 <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Pergolas & Louvers:</strong> We craft stunning and durable <strong>iron and profiles pergolas</strong>. Our expertise includes the manufacturing of advanced <strong>retractable pergolas</strong> and high-quality <strong>metal louvers</strong>, perfect for modern indoor and outdoor spaces.</li>
                    <li><strong>Fabricated Structures:</strong> We provide end-to-end solutions for modular construction, including custom <strong>fabricated homes, shops, and rooms</strong>. Our precision engineering ensures quality and speed for your projects.</li>
                </ul>
            </Section>

             <Section title="A Tool for Professionals">
                 <p>
                    Whether you are calculating the price for a 3-track sliding window or planning the material list for a large-scale retractable pergola, our Real Vibe Studio platform is designed to be your trusted partner. It eliminates manual errors, saves time, and empowers you to deliver professional, accurate quotations every time.
                </p>
            </Section>
        </div>
      </div>
    </div>
  );
};