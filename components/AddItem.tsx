
import React, { useRef, useState } from 'react';
import { ItemType, ItineraryItem } from '../types';
import { ChevronLeftIcon, BedIcon, TrainIcon, CameraIcon, UtensilsIcon, ScanIcon } from './Icons';
import { scanOrchestrator } from '../services/ScanOrchestrator';
import { UploadSecurityService } from '../services/UploadSecurityService';
import { compressImage } from '../utils/imageCompression';
import { TacticalAlert } from './TacticalAlert';

interface AddItemProps {
  onClose: () => void;
  onSelectType: (type: ItemType) => void;
  onScannedItem: (items: Partial<ItineraryItem>[]) => void;
  tripStartDate?: Date; // Added prop for context
}

const OptionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}> = ({ icon, title, desc, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 p-5 bg-tactical-card/50 hover:bg-tactical-card border border-tactical-muted/20 hover:border-tactical-accent/50 rounded-xl transition-all group text-left h-full"
  >
    <div className="w-12 h-12 rounded bg-tactical-bg flex items-center justify-center text-tactical-accent group-hover:bg-tactical-accent group-hover:text-black transition-colors shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-display font-bold text-white uppercase text-lg truncate">{title}</h3>
      <p className="text-tactical-muted text-sm truncate">{desc}</p>
    </div>
    <div className="text-tactical-muted group-hover:text-tactical-accent">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
    </div>
  </button>
);

const AddItem: React.FC<AddItemProps> = ({ onClose, onSelectType, onScannedItem, tripStartDate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [alertState, setAlertState] = useState<{ title: string; message: string; type: 'error' | 'success' | 'warning' } | null>(null);

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 1. Initial Security Check (Hard Limits)
      const securityCheck = UploadSecurityService.validateFile(file);
      if (!securityCheck.isValid) {
        setAlertState({ title: 'Security Alert', message: securityCheck.error || 'Invalid file.', type: 'error' });
        return;
      }

      // 2. Preliminary Abuse Check (Filenames)
      const abuseCheck = UploadSecurityService.preliminaryAbuseCheck(file);
      if (!abuseCheck.isValid) {
        setAlertState({ title: 'Protocol Violation', message: abuseCheck.error || 'Abusive content detected.', type: 'warning' });
        return;
      }

      setIsScanning(true);
      try {
        // Compress Image (if it's an image)
        let processedFile = file;
        if (file.type.startsWith('image/')) {
          console.log('Compressing image...');
          processedFile = await compressImage(file);
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          // Remove data:image/...;base64, prefix for API
          const base64Content = base64String.split(',')[1];

          // 3. PDF Deep Security Check
          if (file.type === 'application/pdf') {
            const { analyzePdfSecurity } = await import('../services/PdfService');
            const pdfCheck = await analyzePdfSecurity(base64Content);

            if (!pdfCheck.isSafe) {
              setIsScanning(false);
              setAlertState({ title: 'Security Alert', message: pdfCheck.error || 'PDF rejected.', type: 'error' });
              return;
            }

            console.log(`[AddItem] PDF Security Pass. Pages: ${pdfCheck.pageCount}, Density: ${pdfCheck.textDensity}`);
          }

          // Pass the file type (e.g., application/pdf or image/png)
          // Pass tripStartDate to assist with Year Inference
          const items = await scanOrchestrator.scanReceipt(base64Content, processedFile.type, tripStartDate);
          if (items && items.length > 0) {
            onScannedItem(items);
          } else {
            setAlertState({ title: 'Scan Failed', message: 'Could not extract intelligence from this document.', type: 'error' });
          }
          setIsScanning(false);
        };
        reader.readAsDataURL(processedFile);
      } catch (error) {
        console.error("Scan error", error);
        setIsScanning(false);
        setAlertState({ title: 'System Error', message: 'Scan failed due to an internal error.', type: 'error' });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-tactical-bg p-6 animate-fade-in relative">
      {/* Alert System */}
      {alertState && (
        <TacticalAlert
          title={alertState.title}
          message={alertState.message}
          type={alertState.type}
          onClose={() => setAlertState(null)}
        />
      )}

      {/* Loading Overlay */}
      {isScanning && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
          <ScanIcon className="w-16 h-16 text-tactical-accent animate-pulse mb-4" />
          <div className="font-display text-xl font-bold text-white uppercase tracking-widest">Adding Item...</div>
          <div className="text-sm text-gray-400 mt-2">Analyzing item details</div>
        </div>
      )}

      <header className="flex items-center justify-between mb-8">
        <button onClick={onClose} className="text-gray-400">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <span className="font-bold text-sm text-gray-500 uppercase tracking-widest">Add to Trip</span>
        <button onClick={onClose} className="text-xs font-bold text-gray-500 uppercase">Close</button>
      </header>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-tactical-accent uppercase leading-none mb-2">
          New Trip<br />Item
        </h1>
        <p className="text-gray-400 text-sm">Select what you'd like to add.</p>
      </div>

      <div className="flex-1 space-y-4">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Scan Button - Full Width */}
        <button
          onClick={handleScanClick}
          className="w-full flex items-center gap-4 p-5 bg-tactical-accent/10 hover:bg-tactical-accent/20 border border-tactical-accent/50 hover:border-tactical-accent rounded-xl transition-all group text-left mb-6"
        >
          <div className="w-12 h-12 rounded bg-tactical-bg flex items-center justify-center text-tactical-accent border border-tactical-accent/30 shadow-[0_0_15px_rgba(255,215,0,0.2)] shrink-0">
            <ScanIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-tactical-accent uppercase text-lg">Scan Booking / Receipt</h3>
            <p className="text-gray-400 text-sm">AI-Analysis from Camera or File</p>
          </div>
          <div className="text-tactical-accent">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </div>
        </button>

        {/* Action Grid for Larger Screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OptionCard
            icon={<BedIcon className="w-6 h-6" />}
            title="Stay"
            desc="Accommodation details"
            onClick={() => onSelectType(ItemType.STAY)}
          />
          <OptionCard
            icon={<TrainIcon className="w-6 h-6" />}
            title="Transport"
            desc="Travel details"
            onClick={() => onSelectType(ItemType.TRANSPORT)}
          />
          <OptionCard
            icon={<CameraIcon className="w-6 h-6" />}
            title="Activity"
            desc="Experience details"
            onClick={() => onSelectType(ItemType.ACTIVITY)}
          />
          <OptionCard
            icon={<UtensilsIcon className="w-6 h-6" />}
            title="Food & Drink"
            desc="Meal details"
            onClick={() => onSelectType(ItemType.FOOD)}
          />
        </div>
      </div>


    </div>
  );
};

export default AddItem;
