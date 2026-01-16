
import React, { useRef, useState } from 'react';
import { ItemType, ItineraryItem } from '../types';
import { ChevronLeftIcon, BedIcon, TrainIcon, CameraIcon, UtensilsIcon, ScanIcon } from './Icons';
import { analyzeReceipt } from '../services/geminiService';

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
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  </button>
);

const AddItem: React.FC<AddItemProps> = ({ onClose, onSelectType, onScannedItem, tripStartDate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleTestRun = () => {
    setIsScanning(true);
    // Simulate API delay
    setTimeout(() => {
        const mockItems: Partial<ItineraryItem>[] = [
            {
                type: ItemType.TRANSPORT,
                title: "American Airlines 5",
                location: "Dallas/Fort Worth (DFW)",
                endLocation: "Honolulu (HNL)",
                // Using Local Wall Clock time (Floating Dates) to avoid browser timezone conversions
                startDate: new Date("2026-02-23T11:35:00"), 
                endDate: new Date("2026-02-23T16:04:00"),
                details: "Seat: --, -- | Class: Basic Economy",
                cost: 350.60,
                durationMinutes: 509 // 8h 29m
            },
            {
                type: ItemType.TRANSPORT,
                title: "American Airlines 102",
                location: "Honolulu (HNL)",
                endLocation: "Dallas/Fort Worth (DFW)",
                startDate: new Date("2026-03-04T19:50:00"),
                endDate: new Date("2026-03-05T07:06:00"),
                details: "Seat: --, -- | Class: Basic Economy",
                cost: 350.60,
                durationMinutes: 436 // 7h 16m
            }
        ];
        onScannedItem(mockItems);
        setIsScanning(false);
    }, 1500);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsScanning(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
           const base64String = reader.result as string;
           // Remove data:image/...;base64, prefix for API
           const base64Content = base64String.split(',')[1];
           
           // Pass the file type (e.g., application/pdf or image/png)
           // Pass tripStartDate to assist with Year Inference
           const items = await analyzeReceipt(base64Content, file.type, tripStartDate);
           if (items && items.length > 0) {
             onScannedItem(items);
           } else {
             alert('Could not extract intelligence from this document.');
           }
           setIsScanning(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Scan error", error);
        setIsScanning(false);
        alert('Scan failed.');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-tactical-bg p-6 animate-fade-in relative">
      {/* Loading Overlay */}
      {isScanning && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
           <ScanIcon className="w-16 h-16 text-tactical-accent animate-pulse mb-4" />
           <div className="font-display text-xl font-bold text-white uppercase tracking-widest">Processing Intel...</div>
           <div className="text-sm text-gray-400 mt-2">Analyzing tactical data</div>
        </div>
      )}

      <header className="flex items-center justify-between mb-8">
        <button onClick={onClose} className="text-gray-400">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <span className="font-bold text-sm text-gray-500 uppercase tracking-widest">Add Checkpoint</span>
        <button onClick={onClose} className="text-xs font-bold text-gray-500 uppercase">Close</button>
      </header>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-tactical-accent uppercase leading-none mb-2">
          New Mission<br />Objective
        </h1>
        <p className="text-gray-400 text-sm">Select your next tactical advantage.</p>
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
              <h3 className="font-display font-bold text-tactical-accent uppercase text-lg">Scan Intel / Receipt</h3>
              <p className="text-gray-400 text-sm">AI-Analysis from Camera or File</p>
           </div>
           <div className="text-tactical-accent">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
           </div>
        </button>

        {/* Action Grid for Larger Screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OptionCard 
              icon={<BedIcon className="w-6 h-6" />}
              title="Book a Bed"
              desc="Secure safehouse"
              onClick={() => onSelectType(ItemType.STAY)}
            />
            <OptionCard 
              icon={<TrainIcon className="w-6 h-6" />}
              title="Catch a Ride"
              desc="Transport to next sector"
              onClick={() => onSelectType(ItemType.TRANSPORT)}
            />
            <OptionCard 
              icon={<CameraIcon className="w-6 h-6" />}
              title="Hunt for Views"
              desc="Reconnaissance"
              onClick={() => onSelectType(ItemType.ACTIVITY)}
            />
            <OptionCard 
              icon={<UtensilsIcon className="w-6 h-6" />}
              title="Refuel"
              desc="Replenish supplies"
              onClick={() => onSelectType(ItemType.FOOD)}
            />
        </div>
      </div>

      {/* Latest Intel Panel & Debug */}
      <div className="mt-8 border border-tactical-muted/20 rounded-xl p-4 bg-tactical-card/30 relative overflow-hidden">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Latest Intel</div>
        <div className="font-mono text-xs text-tactical-accent animate-pulse">
          CHECKPOST TOKYO: SECURED BY BEATRIX
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        
        <button 
          onClick={handleTestRun}
          className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest border border-dashed border-gray-700 rounded transition-colors"
        >
          [Run Diagnostic: Cross-Timezone Flight]
        </button>
      </div>
    </div>
  );
};

export default AddItem;
