'use client';

import React, { useState } from 'react';
import { X, UserCheck } from 'lucide-react';

interface AssignDriverModalProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
  onAssign: (driverName: string) => void;
}

export default function AssignDriverModal({ bookingId, isOpen, onClose, onAssign }: AssignDriverModalProps) {
  const [selectedDriver, setSelectedDriver] = useState('Nimal Perera');
  
  if (!isOpen) return null;

  const drivers = ['Nimal Perera', 'Sunil Shantha', 'Kumara Silva', 'Roshan Wickrama'];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-6 shadow-xl border border-slate-200">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <UserCheck className="w-5 h-5 text-blue-600" /> Assign Driver for {bookingId}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase">Select Available Driver</label>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {drivers.map((d) => (
              <option key={d} value={d}>{d} (KDH Van / Luxury SUV)</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onAssign(selectedDriver);
              onClose();
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all"
          >
            Confirm & Dispatch
          </button>
        </div>

      </div>
    </div>
  );
}