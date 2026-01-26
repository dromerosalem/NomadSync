
import React, { useState, useRef, useEffect } from 'react';
import { ItemType, ItineraryItem, Member, ReceiptItem } from '../types';
import { ChevronLeftIcon, ChevronDownIcon, UtensilsIcon, BedIcon, TrainIcon, CameraIcon, ScanIcon, WalletIcon, PlusIcon, EyeIcon, EyeOffIcon, ListCheckIcon, BanknoteIcon, SweatingEmojiIcon } from './Icons';
import AtmosphericAvatar from './AtmosphericAvatar';
import { scanOrchestrator } from '../services/ScanOrchestrator';
import { currencyService } from '../services/CurrencyService';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { Money } from '../utils/money';
import CurrencySelector from './CurrencySelector';
import { compressImage } from '../utils/imageCompression';
import { UploadSecurityService } from '../services/UploadSecurityService';
import { TacticalAlert } from './TacticalAlert';

interface LogExpenseProps {
    onClose: () => void;
    onSave: (item: Partial<ItineraryItem>) => void;
    onDelete?: (itemId: string) => void;
    tripStartDate: Date;
    currentUserId: string;
    members: Member[];
    initialItem?: ItineraryItem;
    baseCurrency: string;
}

const LogExpense: React.FC<LogExpenseProps> = ({ onClose, onSave, onDelete, tripStartDate, currentUserId, members, initialItem, baseCurrency }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [alertState, setAlertState] = useState<{ title: string; message: string; type: 'error' | 'success' | 'warning' } | null>(null);

    // Date Formatting Helper
    const formatDateForInput = (date: Date) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    // Form State Initialization
    // We prioritize originalAmount if it exists, otherwise fallback to cost (legacy or base currency entry)
    // If editing an old item without originalAmount, assume it was entered in Base Currency.
    const [originalAmount, setOriginalAmount] = useState(
        initialItem?.originalAmount?.toString() || initialItem?.cost?.toString() || ''
    );

    const [currencyCode, setCurrencyCode] = useState(initialItem?.currencyCode || baseCurrency);
    const [exchangeRate, setExchangeRate] = useState<number>(initialItem?.exchangeRate || 1);
    const [convertedCost, setConvertedCost] = useState<number>(initialItem?.cost || 0);

    const [title, setTitle] = useState(initialItem?.title || '');
    const [type, setType] = useState<ItemType>(initialItem?.type || ItemType.ESSENTIALS);
    const [date, setDate] = useState(
        initialItem?.startDate
            ? formatDateForInput(initialItem.startDate)
            : new Date().toISOString().slice(0, 16)
    );

    // Visibility State
    const [showInTimeline, setShowInTimeline] = useState(initialItem?.showInTimeline !== false);

    useEffect(() => {
        if (initialItem) {
            setShowInTimeline(initialItem.showInTimeline !== false);
        } else {
            setShowInTimeline(false);
        }
    }, [initialItem]);

    const [isPrivate, setIsPrivate] = useState(initialItem?.isPrivate || false);

    // Split State
    const activeMembers = members.filter(m => m.status === 'ACTIVE' || !m.status);

    const [paidBy, setPaidBy] = useState(initialItem?.paidBy || currentUserId);
    const [splitWith, setSplitWith] = useState<string[]>(initialItem?.splitWith || activeMembers.map(m => m.id));

    const [splitMode, setSplitMode] = useState<'EQUAL' | 'CUSTOM' | 'ITEMIZED'>('EQUAL');
    const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
    const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>(initialItem?.receiptItems || []);

    const [isScanning, setIsScanning] = useState(false);
    const [isLoadingRate, setIsLoadingRate] = useState(false);
    const [expandedSharedItems, setExpandedSharedItems] = useState<Set<string>>(new Set());

    // Dynamic Scanning Phrases
    const [scanningMessage, setScanningMessage] = useState('Analyzing Receipt...');
    const [isPremiumScan, setIsPremiumScan] = useState(false);

    useEffect(() => {
        if (!isScanning || isPremiumScan) return;

        const phrases = [
            "Decrypting cafe latte scribbles...",
            "Analyzing spending habits...",
            "Converting pixels to pennies...",
            "Consulting the financial oracles...",
            "Asking the chef for clarification...",
            "Doing the math so you don't have to...",
            "Scanning for hidden tacos...",
            "Deciphering ancient receipt runes..."
        ];

        let index = 0;
        const interval = setInterval(() => {
            setScanningMessage(phrases[index]);
            index = (index + 1) % phrases.length;
        }, 2200);

        return () => clearInterval(interval);
    }, [isScanning, isPremiumScan]);

    // Settlement Check
    const isSettlement = initialItem?.type === ItemType.SETTLEMENT;

    // --- Currency Logic ---

    // Fetch Rate when Currency or Date changes
    useEffect(() => {
        if (isSettlement) return; // Settlements are usually direct base currency transfers? Or do we allow currency settlements? Let's assume Base for now to simplify.

        const fetchRate = async () => {
            if (currencyCode === baseCurrency) {
                setExchangeRate(1);
                return;
            }

            setIsLoadingRate(true);
            try {
                // If we have an initial item with a locked rate, maybe we should keep it unless date changes?
                // For now, let's always fetch fresh on edit to be "accurate" to the date selected.
                // But if user wants to keep old rate? Stick to prompt: "app uses the exchange rate from the date of the expense"
                const rate = await currencyService.getRate(currencyCode, baseCurrency, date);
                setExchangeRate(rate);
            } catch (err) {
                console.error("Failed to fetch rate", err);
                // Fallback? Keep 1 or previous?
            } finally {
                setIsLoadingRate(false);
            }
        };

        fetchRate();
    }, [currencyCode, baseCurrency, date, isSettlement]);

    // Update converted cost
    useEffect(() => {
        const amount = parseFloat(originalAmount);
        if (!isNaN(amount)) {
            setConvertedCost(amount * exchangeRate);
        } else {
            setConvertedCost(0);
        }
    }, [originalAmount, exchangeRate]);


    // Initialize Split Mode and Custom Amounts if editing
    useEffect(() => {
        if (initialItem?.receiptItems && initialItem.receiptItems.length > 0) {
            setSplitMode('ITEMIZED');
            setReceiptItems(initialItem.receiptItems);
        } else if (initialItem?.splitDetails && Object.keys(initialItem.splitDetails).length > 0) {
            setSplitMode('CUSTOM');
            const stringAmounts: Record<string, string> = {};
            Object.entries(initialItem.splitDetails).forEach(([id, amt]) => {
                stringAmounts[id] = amt.toString();
            });
            setCustomAmounts(stringAmounts);
        }
    }, [initialItem]);

    // Initialize custom amounts when cost changes or switching to custom
    useEffect(() => {
        if (splitMode === 'CUSTOM' && convertedCost && splitWith.length > 0 && Object.keys(customAmounts).length === 0) {
            const total = new Money(convertedCost);
            if (total.greaterThan(0)) {
                const shares = total.allocate(splitWith.length);
                const newAmounts: Record<string, string> = {};
                splitWith.forEach((id, index) => {
                    newAmounts[id] = shares[index].toFixed(2);
                });
                setCustomAmounts(newAmounts);
            }
        } else if (splitMode === 'ITEMIZED') {
            // We don't auto-calculate custom amounts here, we derive them from items on render/submit
        }
    }, [convertedCost, splitMode, splitWith.length]);

    // Helper to toggle split members
    const toggleSplitMember = (memberId: string) => {
        setSplitWith(prev => {
            const newSplit = prev.includes(memberId)
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId];

            // If in custom mode, remove or add entry
            if (splitMode === 'CUSTOM') {
                const newAmounts = { ...customAmounts };
                if (newSplit.includes(memberId)) {
                    newAmounts[memberId] = '0';
                } else {
                    delete newAmounts[memberId];
                }
                setCustomAmounts(newAmounts);
            }
            return newSplit;
        });
    };

    const handleCustomAmountChange = (memberId: string, amount: string) => {
        setCustomAmounts(prev => ({ ...prev, [memberId]: amount }));
    };

    const handleSelectAll = () => {
        setSplitWith(activeMembers.map(m => m.id));
        if (splitMode === 'CUSTOM') {
            const total = new Money(convertedCost);
            const shares = total.allocate(activeMembers.length);
            const newAmounts: Record<string, string> = {};
            activeMembers.forEach((m, index) => {
                newAmounts[m.id] = shares[index].toFixed(2);
            });
            setCustomAmounts(newAmounts);
        }
    };

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
                    const base64Content = (reader.result as string).split(',')[1];

                    // 3. PDF Deep Security Check
                    if (file.type === 'application/pdf') {
                        const { analyzePdfSecurity } = await import('../services/PdfService');
                        const pdfCheck = await analyzePdfSecurity(base64Content);

                        if (!pdfCheck.isSafe) {
                            setIsScanning(false);
                            setAlertState({ title: 'Security Alert', message: pdfCheck.error || 'PDF rejected.', type: 'error' });
                            return;
                        }

                        // Log density for debugging
                        console.log(`[LogExpense] PDF Security Pass. Pages: ${pdfCheck.pageCount}, Density: ${pdfCheck.textDensity}`);
                    }

                    const items = await scanOrchestrator.scanReceipt(base64Content, processedFile.type, tripStartDate, (status) => {
                        if (status === 'PREMIUM_FALLBACK') {
                            setIsPremiumScan(true);
                            setScanningMessage("This receipt is tougher than expected... calling in the heavy artillery! 😅");
                        }
                    });

                    if (items && items.length > 0) {
                        // LogExpense is single item mode, so we just take the first one
                        const item = items[0];

                        if (items.length > 1) {
                            setAlertState({ title: 'Multiple Items Found', message: `Found ${items.length} items. Using the first one: ${item.title}`, type: 'warning' });
                        }

                        if (item.cost) setOriginalAmount(item.cost.toString());
                        if (item.currencyCode) setCurrencyCode(item.currencyCode);
                        if (item.title) setTitle(item.title);
                        if (item.type) setType(item.type);
                        if (item.startDate) setDate(new Date(item.startDate).toISOString().slice(0, 16));

                        if (item.receiptItems && item.receiptItems.length > 0) {
                            setReceiptItems(item.receiptItems);
                            setSplitMode('ITEMIZED');
                        }
                    } else {
                        setAlertState({ title: 'Scan Failed', message: 'Could not read receipt data.', type: 'error' });
                    }
                    setIsScanning(false);
                };
                reader.readAsDataURL(processedFile);
            } catch (error) {
                console.error("Scan/Compression error", error);
                setIsScanning(false);
            }
        }
    };

    const validate = () => {
        if (!title || !originalAmount) return false;
        const total = parseFloat(originalAmount);
        if (isNaN(total) || total <= 0) return false;

        const totalMoney = new Money(convertedCost);

        if (splitMode === 'CUSTOM') {
            // Check if custom amounts sum up to total (approx) - Note: Custom amounts are typically in BASE currency
            let sum = new Money(0);
            splitWith.forEach(id => {
                sum = sum.add(customAmounts[id] || '0');
            });
            // Allow 1 cent drift for manual entry, but ideally 0
            if (sum.subtract(totalMoney).abs().greaterThan(0.01)) return false;
        } else if (splitMode === 'ITEMIZED') {
            // Validate that all assignable items (not tax/tip/service) have at least one assignee
            if (receiptItems.length === 0) return false;

            const hasUnassignedItems = receiptItems.some(item => {
                if (['tax', 'tip', 'service', 'deposit', 'discount'].includes(item.type)) return false;
                return !item.assignedTo || item.assignedTo.length === 0;
            });

            if (hasUnassignedItems) return false;

            // Validate that assigned items total matches the top-level bill total (within tolerance)
            const billTotal = parseFloat(originalAmount);
            const itemizedAssignedTotal = receiptItems.reduce((sum, item) => {
                const lineTotal = item.price * item.quantity;
                if (['tax', 'tip', 'service', 'deposit', 'discount'].includes(item.type)) return sum + lineTotal;
                if (item.assignedTo && item.assignedTo.length > 0) return sum + lineTotal;
                return sum;
            }, 0);
            if (Math.abs(billTotal - itemizedAssignedTotal) > 0.01) return false;
        }

        if (splitWith.length === 0 && splitMode !== 'ITEMIZED') return false; // In itemized, splitWith is derived

        return true;
    };

    const handleSubmit = () => {
        if (!validate()) return;

        let splitDetails: Record<string, number> = {};
        const totalMoney = new Money(convertedCost);

        if (splitMode === 'CUSTOM') {
            splitWith.forEach(id => {
                splitDetails[id] = parseFloat(customAmounts[id] || '0');
            });
        } else if (splitMode === 'ITEMIZED') {
            // Calculate Itemized Splits
            const memberMap: Record<string, number> = {};
            let subtotal = 0;
            const memberSubtotals: Record<string, number> = {};

            // 1. Assign direct items
            receiptItems.forEach(item => {
                if (['tax', 'tip', 'service'].includes(item.type)) return;

                const lineTotal = item.price * item.quantity;
                subtotal += lineTotal;
                const assigned = item.assignedTo || [];
                if (assigned.length > 0) {
                    const splitPrice = lineTotal / assigned.length;
                    assigned.forEach(uid => {
                        memberSubtotals[uid] = (memberSubtotals[uid] || 0) + splitPrice;
                    });
                } else {
                    // Unassigned goes to Payer? Or remains unallocated? 
                    // Let's assign to Payer for now to avoid "money loss"
                    memberSubtotals[paidBy] = (memberSubtotals[paidBy] || 0) + lineTotal;
                }
            });

            // 2. Distribute Tax/Tip/Service proportionally based on subtotal
            receiptItems.forEach(item => {
                if (['tax', 'tip', 'service'].includes(item.type)) {
                    const lineTotal = item.price * item.quantity;
                    // If subtotal is 0 (everything is tax/tip?), split equally among all members who have assignments, or just payer
                    if (subtotal === 0) {
                        memberSubtotals[paidBy] = (memberSubtotals[paidBy] || 0) + lineTotal;
                    } else {
                        // Proportional split
                        Object.keys(memberSubtotals).forEach(uid => {
                            const share = (memberSubtotals[uid] / subtotal) * lineTotal;
                            memberSubtotals[uid] += share;
                        });
                    }
                }
            });

            // Convert to base currency and save
            Object.entries(memberSubtotals).forEach(([uid, amount]) => {
                splitDetails[uid] = amount * exchangeRate;
            });

            // Replace splitWith with those who have amounts
            const finalSplitWith = Object.keys(splitDetails);

            onSave({
                id: initialItem?.id,
                title,
                cost: totalMoney.toNumber(), // Store Base Currency Amount
                originalAmount: parseFloat(originalAmount),
                currencyCode,
                exchangeRate,
                type,
                startDate: new Date(date),
                location: initialItem?.location || 'Logged Expense',
                splitWith: finalSplitWith,
                splitDetails, // Always save explicit splits for integrity
                paidBy,
                isPrivate,
                showInTimeline,
                details: initialItem?.details || 'Expense logged via Budget Engine',
                receiptItems: splitMode === 'ITEMIZED' ? receiptItems : undefined
            });

        } else {
            // Even in EQUAL mode, we allocate explicitly to ensure no penny is lost (Remainder Allocation)
            // cost / 3 = 3.33, 3.33, 3.34
            const shares = totalMoney.allocate(splitWith.length);
            splitWith.forEach((id, index) => {
                splitDetails[id] = shares[index].toNumber();
            });

            onSave({
                id: initialItem?.id,
                title,
                cost: totalMoney.toNumber(), // Store Base Currency Amount
                originalAmount: parseFloat(originalAmount),
                currencyCode,
                exchangeRate,
                type,
                startDate: new Date(date),
                location: initialItem?.location || 'Logged Expense',
                splitWith,
                splitDetails, // Always save explicit splits for integrity
                paidBy,
                isPrivate,
                showInTimeline,
                details: initialItem?.details || 'Expense logged via Budget Engine',
                receiptItems: splitMode === 'ITEMIZED' ? receiptItems : undefined
            });
        }
    };

    const handleDeleteClick = () => {
        if (!isDeleting) {
            setIsDeleting(true);
            return;
        }
        if (initialItem?.id && onDelete) {
            onDelete(initialItem.id);
        }
    };

    const handleCancelDelete = () => {
        setIsDeleting(false);
    }

    const getTypeIcon = (t: ItemType) => {
        switch (t) {
            case ItemType.FOOD: return <UtensilsIcon className="w-5 h-5" />;
            case ItemType.STAY: return <BedIcon className="w-5 h-5" />;
            case ItemType.TRANSPORT: return <TrainIcon className="w-5 h-5" />;
            case ItemType.ACTIVITY: return <CameraIcon className="w-5 h-5" />;
            default: return <PlusIcon className="w-5 h-5" />;
        }
    };

    // UI Calculations
    const equalShare = splitWith.length > 0 ? (convertedCost / splitWith.length).toFixed(2) : '0.00';

    let currentCustomSum = 0;
    if (splitMode === 'CUSTOM') {
        splitWith.forEach(id => currentCustomSum += parseFloat(customAmounts[id] || '0'));
    }
    const remaining = convertedCost - currentCustomSum;

    // Itemized mode bill validation calculations
    const itemizedTotalScanned = receiptItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemizedAssigned = receiptItems.reduce((sum, item) => {
        const lineTotal = item.price * item.quantity;
        // Tax/tip/service/deposit/discount are auto-distributed, count as assigned
        if (['tax', 'tip', 'service', 'deposit', 'discount'].includes(item.type)) return sum + lineTotal;
        // Count as assigned if at least one member is assigned
        if (item.assignedTo && item.assignedTo.length > 0) return sum + lineTotal;
        return sum;
    }, 0);

    // We use the top-level originalAmount as the source of truth for the Total Bill
    const totalBillReference = parseFloat(originalAmount) || 0;
    const itemizedRemaining = totalBillReference - itemizedAssigned;

    // Check if any assignable items have no one assigned
    const hasUnassignedItems = receiptItems.some(item => {
        if (['tax', 'tip', 'service', 'deposit', 'discount'].includes(item.type)) return false;
        return !item.assignedTo || item.assignedTo.length === 0;
    });

    const sender = members.find(m => m.id === paidBy);
    const receiverId = splitWith[0];
    const receiver = members.find(m => m.id === receiverId);

    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in relative">
            {alertState && (
                <TacticalAlert
                    title={alertState.title}
                    message={alertState.message}
                    type={alertState.type}
                    onClose={() => setAlertState(null)}
                />
            )}
            {isScanning && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm px-8 text-center transition-all duration-500">
                    {isPremiumScan ? (
                        <SweatingEmojiIcon className="w-20 h-20 text-yellow-500 animate-bounce mb-6 filter drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                    ) : (
                        <ScanIcon className="w-16 h-16 text-tactical-accent animate-pulse mb-6" />
                    )}
                    <div className="font-display text-xl font-bold text-white uppercase tracking-widest leading-relaxed">
                        {scanningMessage}
                    </div>
                </div>
            )}

            <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-20 border-b border-tactical-muted/10 w-full max-w-2xl mx-auto">
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <div className="font-display font-bold text-lg text-white uppercase tracking-wider">
                    {isSettlement ? 'Settlement Record' : (initialItem ? 'Edit Expense' : 'Log Expense')}
                </div>
                {initialItem && !isSettlement && !isDeleting ? (
                    <button type="button" onClick={handleDeleteClick} className="text-red-500 hover:text-red-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                    </button>
                ) : (
                    <div className="w-6"></div>
                )}
            </header>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide pb-48 w-full max-w-2xl mx-auto">

                {/* 1. Cost Input */}
                <div className="flex flex-col items-center justify-center mb-8 mt-4">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Total Amount</div>
                    <div className="flex items-center gap-2 mb-2">
                        <CurrencySelector
                            variant="minimal"
                            value={currencyCode}
                            onChange={setCurrencyCode}
                            disabled={isSettlement}
                        />
                    </div>

                    <div className="flex items-baseline justify-center gap-1">
                        <span className={`text-4xl font-bold font-display ${isSettlement ? 'text-green-500' : 'text-white'}`}>
                            {getCurrencySymbol(currencyCode)}
                        </span>
                        <input
                            type="number"
                            value={originalAmount}
                            onChange={(e) => setOriginalAmount(e.target.value)}
                            placeholder="0"
                            disabled={isSettlement}
                            style={{ width: `${Math.max(1, originalAmount.length)}ch` }}
                            className={`bg-transparent text-6xl font-display font-bold text-white outline-none placeholder-gray-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] text-center min-w-[1ch] p-0 ${isSettlement ? 'cursor-not-allowed opacity-90' : ''}`}
                            autoFocus={!initialItem}
                        />
                    </div>

                    {currencyCode !== baseCurrency && (
                        <div className="mt-2 text-sm font-mono text-gray-400 flex items-center gap-2">
                            {isLoadingRate ? (
                                <span className="animate-pulse">Fetching Rate...</span>
                            ) : (
                                <>
                                    <span>≈ {getCurrencySymbol(baseCurrency)} {convertedCost.toFixed(2)}</span>
                                    <span className="text-[9px] text-gray-600">(@ {exchangeRate.toFixed(4)})</span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* 2. Scan Button */}
                {!initialItem && (
                    <div className="mb-8">
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={handleScanClick}
                            className="w-full py-3 bg-tactical-card hover:bg-tactical-highlight border border-tactical-muted/30 rounded-lg flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-tactical-accent transition-colors"
                        >
                            <ScanIcon className="w-4 h-4" /> Scan Receipt
                        </button>
                    </div>
                )}

                {/* 3. Details Form */}
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Description</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Grocery Run, Fuel, Supplies"
                            disabled={isSettlement}
                            className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 text-white placeholder-gray-600 focus:border-tactical-accent outline-none font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Category</label>
                        {isSettlement ? (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-green-500/30 bg-green-900/10 text-green-500 font-bold uppercase text-sm w-full">
                                <BanknoteIcon className="w-5 h-5" /> Debt Settlement
                            </div>
                        ) : (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {[ItemType.ESSENTIALS, ItemType.FOOD, ItemType.TRANSPORT, ItemType.STAY, ItemType.ACTIVITY].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setType(t)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase whitespace-nowrap transition-colors ${type === t
                                            ? 'bg-tactical-accent text-black border-tactical-accent'
                                            : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500'
                                            }`}
                                    >
                                        {getTypeIcon(t)} {t === ItemType.ESSENTIALS ? 'Essentials' : t}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Date</label>
                        <input
                            type="datetime-local"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            disabled={isSettlement}
                            className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-3 text-white focus:border-tactical-accent outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>

                <div className="h-px bg-tactical-muted/20 my-8"></div>

                {/* 4. Visibility Config */}
                {!isSettlement && (
                    <div className="mb-8">
                        <h3 className="font-display font-bold text-white uppercase text-lg mb-4">Visibility Config</h3>
                        <div className="space-y-3">
                            <div
                                onClick={() => setShowInTimeline(!showInTimeline)}
                                className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${showInTimeline ? 'bg-tactical-card border-tactical-muted/50' : 'bg-transparent border-tactical-muted/20'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${showInTimeline ? 'bg-tactical-accent text-black' : 'bg-black/20 text-gray-500'}`}>
                                        <ListCheckIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className={`font-bold uppercase text-sm ${showInTimeline ? 'text-white' : 'text-gray-400'}`}>Add to Timeline</div>
                                        <div className="text-[10px] text-gray-500">Show this expense on the trip timeline</div>
                                    </div>
                                </div>
                                <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${showInTimeline ? 'bg-tactical-accent' : 'bg-gray-700'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${showInTimeline ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>
                        <div className="h-px bg-tactical-muted/20 my-8"></div>
                    </div>
                )}

                {/* 5. Split Engine */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-bold text-white uppercase text-lg">
                            {isSettlement ? 'Transfer Details' : 'Split Engine'}
                        </h3>
                        {!isSettlement && (
                            <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700">
                                <button
                                    onClick={() => setSplitMode('EQUAL')}
                                    className={`text-[9px] font-bold uppercase px-3 py-1 rounded transition-colors ${splitMode === 'EQUAL' ? 'bg-tactical-accent text-black' : 'text-gray-500'}`}
                                >
                                    Equal
                                </button>
                                <button
                                    onClick={() => setSplitMode('CUSTOM')}
                                    className={`text-[9px] font-bold uppercase px-3 py-1 rounded transition-colors ${splitMode === 'CUSTOM' ? 'bg-tactical-accent text-black' : 'text-gray-500'}`}
                                >
                                    Custom
                                </button>
                                <button
                                    onClick={() => setSplitMode('ITEMIZED')}
                                    className={`text-[9px] font-bold uppercase px-3 py-1 rounded transition-colors ${splitMode === 'ITEMIZED' ? 'bg-tactical-accent text-black' : 'text-gray-500'}`}
                                >
                                    Itemized
                                </button>
                            </div>
                        )}
                    </div>

                    {isSettlement ? (
                        <div className="bg-black/20 rounded-xl border border-white/5 p-5">
                            {/* Settlement readonly view */}
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col items-center gap-3">
                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Sender</span>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-600 bg-tactical-card">
                                        <AtmosphericAvatar userId={paidBy} avatarUrl={sender?.avatarUrl} name={sender?.name || ''} size="xs" />
                                        <span className="text-xs font-bold text-white uppercase">{sender?.name.split(' ')[0]}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1 text-green-500 opacity-80">
                                    <div className="text-[9px] font-bold uppercase tracking-widest">Sent</div>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                </div>
                                <div className="flex flex-col items-center gap-3">
                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Receiver</span>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-600 bg-tactical-card">
                                        <AtmosphericAvatar userId={receiverId} avatarUrl={receiver?.avatarUrl} name={receiver?.name || ''} size="xs" />
                                        <span className="text-xs font-bold text-white uppercase">{receiver?.name.split(' ')[0]}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Paid By</label>
                                <div className="flex flex-wrap gap-2">
                                    {activeMembers.map(member => (
                                        <button
                                            key={member.id}
                                            onClick={() => setPaidBy(member.id)}
                                            className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase transition-colors flex items-center gap-2 ${paidBy === member.id
                                                ? 'bg-green-500 border-green-500 text-black'
                                                : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-500'
                                                }`}
                                        >
                                            <AtmosphericAvatar
                                                userId={member.id}
                                                avatarUrl={member.avatarUrl}
                                                name={member.name}
                                                size="xs"
                                            />
                                            {member.isCurrentUser ? 'Me' : member.name.split(' ')[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {splitMode === 'ITEMIZED' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Receipt Items</label>
                                        <div className="text-[10px] text-gray-400">
                                            Tap avatars to assign items
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {receiptItems.map((item) => {
                                            const isAssignable = !['tax', 'tip', 'service'].includes(item.type);
                                            const isUnassigned = isAssignable && (!item.assignedTo || item.assignedTo.length === 0);

                                            return (
                                                <div key={item.id} className={`bg-tactical-card/50 p-3 rounded-lg border ${isUnassigned ? 'border-red-500/50 shadow-[0_0_10px_rgba(255,0,0,0.1)]' : 'border-white/5'}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="font-bold text-white text-sm">{item.name}</div>
                                                            {(item.nameRomanized || item.nameEnglish) && (
                                                                <div className="text-[10px] text-gray-400 mt-0.5 space-x-1 italic">
                                                                    {item.nameRomanized && <span>{item.nameRomanized}</span>}
                                                                    {item.nameRomanized && item.nameEnglish && <span>•</span>}
                                                                    {item.nameEnglish && <span>{item.nameEnglish}</span>}
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] text-gray-500 flex gap-2">
                                                                <span>{item.quantity}x {item.quantity > 1 && `@ ${getCurrencySymbol(currencyCode)}${item.price.toFixed(2)}`}</span>
                                                                <span className="uppercase badge bg-gray-800 px-1 rounded text-[8px]">{item.type}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-mono font-bold text-tactical-accent">
                                                                {getCurrencySymbol(currencyCode)}{(item.price * item.quantity).toFixed(2)}
                                                            </div>
                                                            {item.quantity > 1 && (
                                                                <div className="text-[9px] text-gray-500 font-mono">
                                                                    {item.quantity} × {getCurrencySymbol(currencyCode)}{item.price.toFixed(2)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Assignment Avatars */}
                                                    <div className="flex gap-2">
                                                        {['tax', 'tip', 'service', 'deposit', 'discount'].includes(item.type) ? (
                                                            <div className="w-full">
                                                                {/* Shared Badge with expand/collapse */}
                                                                <button
                                                                    onClick={() => {
                                                                        setExpandedSharedItems(prev => {
                                                                            const next = new Set(prev);
                                                                            if (next.has(item.id)) {
                                                                                next.delete(item.id);
                                                                            } else {
                                                                                next.add(item.id);
                                                                            }
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className="flex items-center justify-between w-full text-[10px] font-bold text-yellow-500 uppercase border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 rounded hover:bg-yellow-500/20 transition-all"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span>Shared</span>
                                                                        {/* Avatar stack preview */}
                                                                        <div className="flex -space-x-2">
                                                                            {(item.assignedTo && item.assignedTo.length > 0 ? item.assignedTo : activeMembers.map(m => m.id)).slice(0, 3).map(memberId => {
                                                                                const member = activeMembers.find(m => m.id === memberId);
                                                                                if (!member) return null;
                                                                                return (
                                                                                    <div key={memberId} className="w-5 h-5 rounded-full border border-tactical-bg overflow-hidden">
                                                                                        <AtmosphericAvatar
                                                                                            userId={member.id}
                                                                                            avatarUrl={member.avatarUrl}
                                                                                            name={member.name}
                                                                                            size="xs"
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                            {(item.assignedTo?.length || activeMembers.length) > 3 && (
                                                                                <div className="w-5 h-5 rounded-full border border-tactical-bg bg-gray-700 flex items-center justify-center text-[8px] text-gray-300">
                                                                                    +{(item.assignedTo?.length || activeMembers.length) - 3}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-gray-400 normal-case">
                                                                            ({item.assignedTo?.length || activeMembers.length}/{activeMembers.length})
                                                                        </span>
                                                                    </div>
                                                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${expandedSharedItems.has(item.id) ? 'rotate-180' : ''}`} />
                                                                </button>

                                                                {/* Expanded participant selector */}
                                                                {expandedSharedItems.has(item.id) && (
                                                                    <div className="mt-2 p-2 bg-black/30 rounded-lg border border-white/5">
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {activeMembers.map(m => {
                                                                                // If no assignedTo yet, treat all as selected (default behavior)
                                                                                const isAssigned = item.assignedTo?.length
                                                                                    ? item.assignedTo.includes(m.id)
                                                                                    : true;
                                                                                return (
                                                                                    <button
                                                                                        key={m.id}
                                                                                        onClick={() => {
                                                                                            const newItems = receiptItems.map(ri => {
                                                                                                if (ri.id !== item.id) return ri;
                                                                                                // Initialize assignedTo with all members if not set
                                                                                                const currentAssigned = ri.assignedTo?.length
                                                                                                    ? ri.assignedTo
                                                                                                    : activeMembers.map(am => am.id);
                                                                                                const newAssigned = currentAssigned.includes(m.id)
                                                                                                    ? currentAssigned.filter(id => id !== m.id)
                                                                                                    : [...currentAssigned, m.id];
                                                                                                // Ensure at least one member remains
                                                                                                if (newAssigned.length === 0) return ri;
                                                                                                return { ...ri, assignedTo: newAssigned };
                                                                                            });
                                                                                            setReceiptItems(newItems);
                                                                                        }}
                                                                                        className={`transition-all ${isAssigned ? 'opacity-100 scale-110' : 'opacity-40 grayscale hover:opacity-70'}`}
                                                                                    >
                                                                                        <AtmosphericAvatar
                                                                                            userId={m.id}
                                                                                            avatarUrl={m.avatarUrl}
                                                                                            name={m.name}
                                                                                            size="sm"
                                                                                            isPathfinder={isAssigned}
                                                                                        />
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <div className="text-[9px] text-gray-500 mt-2 text-center">
                                                                            Tap to toggle who shares this charge
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            activeMembers.map(m => {
                                                                const isAssigned = item.assignedTo?.includes(m.id);
                                                                return (
                                                                    <button
                                                                        key={m.id}
                                                                        onClick={() => {
                                                                            const newItems = receiptItems.map(ri => {
                                                                                if (ri.id !== item.id) return ri;
                                                                                const assigned = ri.assignedTo || [];
                                                                                const newAssigned = assigned.includes(m.id)
                                                                                    ? assigned.filter(id => id !== m.id)
                                                                                    : [...assigned, m.id];
                                                                                return { ...ri, assignedTo: newAssigned };
                                                                            });
                                                                            setReceiptItems(newItems);
                                                                        }}
                                                                        className={`transition-all ${isAssigned ? 'opacity-100 scale-110' : 'opacity-40 grayscale hover:opacity-70'}`}
                                                                    >
                                                                        <AtmosphericAvatar
                                                                            userId={m.id}
                                                                            avatarUrl={m.avatarUrl}
                                                                            name={m.name}
                                                                            size="sm"
                                                                            isPathfinder={isAssigned}
                                                                        />
                                                                    </button>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {receiptItems.length === 0 && (
                                            <div className="text-center p-8 border border-dashed border-gray-700 rounded-xl text-gray-500 text-xs">
                                                No items scanned. Upload a receipt or add items manually (coming soon).
                                            </div>
                                        )}
                                    </div>

                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                            Split Among {splitMode === 'CUSTOM' && remaining !== 0 && (
                                                <span className={remaining < 0 ? "text-red-500" : "text-yellow-500"}>
                                                    ({remaining > 0 ? `Left: ${getCurrencySymbol(baseCurrency)} ${remaining.toFixed(2)}` : `Over: ${getCurrencySymbol(baseCurrency)} ${Math.abs(remaining).toFixed(2)}`})
                                                </span>
                                            )}
                                        </label>
                                        <button
                                            onClick={handleSelectAll}
                                            className="text-[9px] font-bold text-tactical-accent uppercase hover:underline"
                                        >
                                            Select All
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {activeMembers.map(member => {
                                            const isIncluded = splitWith.includes(member.id);
                                            return (
                                                <div
                                                    key={member.id}
                                                    onClick={() => {
                                                        if (splitMode === 'EQUAL') toggleSplitMember(member.id);
                                                    }}
                                                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isIncluded
                                                        ? 'bg-tactical-card border-tactical-muted/50'
                                                        : 'bg-transparent border-transparent opacity-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3 cursor-pointer" onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSplitMember(member.id);
                                                    }}>
                                                        <div className="relative">
                                                            <AtmosphericAvatar
                                                                userId={member.id}
                                                                avatarUrl={member.avatarUrl}
                                                                name={member.name}
                                                                size="md"
                                                                isPathfinder={isIncluded}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className={`font-bold uppercase text-sm ${isIncluded ? 'text-white' : 'text-gray-500'}`}>
                                                                {member.name}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Amount (Always in Base Currency) */}
                                                    {isIncluded && (
                                                        <div className="text-right">
                                                            {splitMode === 'EQUAL' ? (
                                                                <div className="text-sm font-mono text-tactical-accent font-bold">
                                                                    {getCurrencySymbol(baseCurrency)} {equalShare}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-tactical-accent text-sm font-bold">{getCurrencySymbol(baseCurrency)}</span>
                                                                    <input
                                                                        type="number"
                                                                        value={customAmounts[member.id] || ''}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={(e) => handleCustomAmountChange(member.id, e.target.value)}
                                                                        className="w-20 bg-black/30 border border-gray-700 rounded p-1 text-right text-white font-mono text-sm outline-none focus:border-tactical-accent"
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="p-6 sticky bottom-0 bg-tactical-bg border-t border-tactical-muted/10 z-20 w-full max-w-2xl mx-auto">
                {/* Bill Validation Summary (Itemized Mode Only) */}
                {splitMode === 'ITEMIZED' && receiptItems.length > 0 && !isSettlement && (
                    <div className="mb-4 pb-4 border-b border-tactical-muted/10">
                        <div className="flex items-center justify-between text-sm">
                            <div className="space-y-1">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bill Summary</div>
                                <div className="flex gap-4">
                                    <div className="text-gray-400 text-xs">
                                        Total Bill: <span className="font-mono font-bold text-white uppercase">{getCurrencySymbol(currencyCode)}{totalBillReference.toFixed(2)}</span>
                                    </div>
                                    <div className="text-gray-400 text-xs">
                                        Assigned: <span className="font-mono font-bold text-green-500 uppercase">{getCurrencySymbol(currencyCode)}{itemizedAssigned.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className={`px-4 py-2 rounded-lg font-bold font-mono text-sm ${(itemizedRemaining > 0.01 || hasUnassignedItems)
                                ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(255,0,0,0.1)]'
                                : 'bg-green-500/10 text-green-500 border border-green-500/20 shadow-[0_0_10px_rgba(0,255,0,0.1)]'
                                }`}>
                                {itemizedRemaining > 0.01
                                    ? `Remaining: ${getCurrencySymbol(currencyCode)}${Math.abs(itemizedRemaining).toFixed(2)}`
                                    : hasUnassignedItems
                                        ? 'Items Missing!'
                                        : 'All Set!'
                                }
                            </div>
                        </div>
                    </div>
                )}
                {isSettlement ? (
                    // Settlement Actions
                    <div className="space-y-3">
                        <div className="text-center text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                            Settlements are immutable.
                        </div>
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            className="w-full bg-red-900/80 hover:bg-red-800 text-red-100 font-display font-bold text-lg py-4 rounded-xl shadow-[0_0_15px_rgba(255,0,0,0.2)] transition-all flex items-center justify-center gap-2 border border-red-500/30"
                        >
                            REVERSE SETTLEMENT
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        {initialItem && isDeleting ? (
                            <>
                                <button
                                    onClick={handleCancelDelete}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold uppercase py-4 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteClick}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold uppercase py-4 rounded-xl shadow-[0_0_15px_rgba(255,0,0,0.3)]"
                                >
                                    Confirm Delete
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={!validate()}
                                className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-xl shadow-[0_0_15px_rgba(255,215,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                <WalletIcon className="w-5 h-5" />
                                {initialItem ? 'UPDATE EXPENSE' : 'LOG EXPENSE'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
};

export default LogExpense;
