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
          <h2 className="text-2xl font-bold text-white">Features & Guides</h2>
          <Button onClick={onClose} variant="secondary" className="p-2 rounded-full h-10 w-10">
            <XMarkIcon className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
            <Section title="How to Use This Tool">
                <ol className="list-decimal list-inside space-y-2 pl-2">
                    <li><strong>Select Design Type:</strong> Choose from Sliding, Casement, Ventilator, Partition, etc. to start.</li>
                    <li><strong>Enter Dimensions:</strong> Input the overall width and height for your design.</li>
                    <li><strong>Configure Layout:</strong> Use the controls to add fixed panels, create grid layouts, define shutter configurations, and more.</li>
                    <li><strong>Customize Appearance:</strong> Pick your profile color and glass type. You can even upload custom textures.</li>
                    <li><strong>Generate Quotation:</strong> Set the quantity and rate, then save the item to your quotation list.</li>
                    <li><strong>Export & Print:</strong> Open the "View Quotation" modal to finalize details and export a professional PDF for your client or a complete Bill of Materials (BOM) for your workshop.</li>
                </ol>
            </Section>

            <Section title="Frequently Asked Questions (FAQ)">
                <div className="space-y-4">
                    <div>
                        <p className="font-semibold text-slate-100">What is the WoodenMax Design Tool?</p>
                        <p>This is a powerful, <strong>free online tool</strong> created by WoodenMax for designing custom architectural elements like aluminium/uPVC windows, doors, glass partitions, and louvers. It serves as an all-in-one <strong>window design tool</strong> and <strong>quotation software</strong>.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-100">Who is this tool for?</p>
                        <p>It's designed for professionals in the construction and design industry, including <strong>fabricators, architects, contractors, and builders</strong>. It helps streamline the design-to-quote process, reducing errors and saving time.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-100">Can I generate a cutting list for fabrication?</p>
                        <p>Yes. The tool functions as a <strong>window cutting list software</strong>. After adding items to your quotation, you can export a complete <strong>Bill of Materials (BOM)</strong>. This summary details all required profile lengths, hardware quantities, and weights, making it an essential <strong>aluminium window calculator</strong> for production.</p>
                    </div>
                     <div>
                        <p className="font-semibold text-slate-100">What types of windows can I design?</p>
                        <p>You can design a wide variety of systems, including <strong>2-track sliding windows</strong>, <strong>3-track sliding windows</strong> (with options for glass and mesh), <strong>casement windows</strong>, and <strong>fixed windows</strong>. The tool is flexible enough to handle many common profile series.</p>
                    </div>
                </div>
            </Section>
            
            <Section title="About WoodenMax">
                <p>
                    <strong>WoodenMax Architectural Elements</strong> is a leader in innovative building solutions. This platform, hosted at <strong>realvibestudio.in</strong>, is part of our commitment to empowering industry professionals with free, state-of-the-art digital tools.
                </p>
                <p>
                    Beyond this software, we specialize in manufacturing high-quality <strong>iron and profiles pergolas, retractable pergolas, metal louvers,</strong> and custom <strong>fabricated structures</strong> like modular homes and shops.
                </p>
            </Section>
        </div>
      </div>
    </div>
  );
};