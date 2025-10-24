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
          <h2 className="text-2xl font-bold text-white">Mastering Window & Door Design: Features & Guides</h2>
          <Button onClick={onClose} variant="secondary" className="p-2 rounded-full h-10 w-10">
            <XMarkIcon className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
            <Section title="The Ultimate Free Window Quotation Generator">
                <p>
                    Welcome to the premier `window design tool online`. This powerful `window design software` is built for fabricators, architects, and homeowners in India and worldwide. 
                    Our mission is to simplify the entire process of `aluminium window design` and `aluminium door design`. While optimized for aluminium, its principles are perfect for planning `upvc window design` projects as well.
                </p>
            </Section>

            <Section title="Comprehensive Design Capabilities">
                <p><strong>Sliding Systems:</strong> Effortlessly create `2 track sliding window design` and `3 track sliding window design` layouts. Our tool manages the `sliding window section details` and `3 track aluminium window profile` requirements automatically, helping you estimate the `3 track sliding window price` accurately. You can even use it to reference your `aluminium sliding window CAD drawing` needs or `sliding window track profile catalogue`.</p>
                <p><strong>Casement & Hinged Systems:</strong> Produce detailed `aluminium casement window design` and `hinged door design aluminium` plans. The tool helps visualize `casement window profile drawing` requirements and `aluminium door frame design` specifications, including `glass door profile section` details.</p>
                <p><strong>Ventilators & Fixed Panels:</strong> Quickly configure `aluminium ventilator design` and `fixed glass window design`. Access `fix window section detail` information through the profile editor, useful for both aluminium and `upvc ventilator window` projects.</p>
                <p><strong>Interior Glass Solutions:</strong> Expand your services by using our `glass door design online` feature. Plan `shower glass design` projects, `bathroom shower glass partition` layouts, including `shower glass door fittings` and `bathroom shower glass profile` specifications.</p>
            </Section>

            <Section title="Key Features of Our Window Making Software">
                 <p><strong>- Online & Accessible:</strong> As a leading `window design tool online`, there's no complex installation. Use the 'Add to Home Screen' feature for an experience similar to a `uPVC window design app` or an `aluminium window design software free download`.</p>
                <p><strong>- Detailed Profile Management:</strong> Our `window profile design tool` allows you to define every section. It acts as a powerful `window profile calculator` for lengths and materials, making it a must-have for any `aluminium window section designer`.</p>
                <p><strong>- Bill of Materials (BOM):</strong> Go beyond a simple quote with our `aluminium window cutting list software`. Generate a complete `window bill of materials` for accurate fabrication and purchasing.</p>
                 <p><strong>- Professional Quotations:</strong> Impress clients with clean, professional-looking quotations, detailing everything from `window frame design online` visualizations to final hardware costs.</p>
            </Section>

             <Section title="Why Use an Online Window Calculator?">
                 <p>
                    An online `aluminium window calculator` like this eliminates guesswork and manual errors. It ensures accuracy, saves significant time, and provides a clear, itemized breakdown for your clients. Whether you're doing `window frame design CAD` work or need a quick price, our tool builds trust and professionalism.
                </p>
            </Section>
        </div>
      </div>
    </div>
  );
};