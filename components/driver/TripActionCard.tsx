'use client';

import React, { useState } from 'react';
import { MapPin, Navigation, CheckCircle, Phone } from 'lucide-react';

export default function TripActionCard() {
  const [tripStatus, setTripStatus] = useState<'Assigned' | 'Picked Up' | 'Completed'>('Assigned');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex justify-between items-start border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">BK-1001</span>
          <h3 className="text-lg font-bold text-slate-900 mt-2">Alexander Wright</h3>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
            <Phone className="w-3.5 h-3.5" /> +44 7700 900077
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-slate-400">FAIR AMOUNT</span>
          <p className="text-lg font-extrabold text-slate-900">LKR 28,500</p>
        </div>
      </div>

      {/* Route Details */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl mt-1"><MapPin className="w-5 h-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Pickup Location</p>
            <p className="font-bold text-slate-800">Bandaranaike International Airport (CMB)</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl mt-1"><Navigation className="w-5 h-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Dropoff Destination</p>
            <p className="font-bold text-slate-800">Mirissa Coastal Villa & Resort</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 border-t border-slate-100">
        {tripStatus === 'Assigned' && (
          <button
            onClick={() => setTripStatus('Picked Up')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" /> Start Pickup / On The Way
          </button>
        )}

        {tripStatus === 'Picked Up' && (
          <button
            onClick={() => setTripStatus('Completed')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" /> Complete Trip & Arrived
          </button>
        )}

        {tripStatus === 'Completed' && (
          <div className="w-full bg-emerald-50 text-emerald-700 font-bold py-3 rounded-xl text-center text-sm border border-emerald-200">
            ✓ Trip Successfully Completed
          </div>
        )}
      </div>
    </div>
  );
}