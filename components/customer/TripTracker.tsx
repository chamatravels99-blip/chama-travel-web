'use client';

import React from 'react';
import { CheckCircle2, Navigation } from 'lucide-react';

interface TripTrackerProps {
  status: 'Assigned' | 'Picked Up' | 'Completed';
}

export default function TripTracker({ status }: TripTrackerProps) {
  const steps = [
    { id: 1, title: 'Booking Confirmed', desc: 'Vehicle & driver allocated' },
    { id: 2, title: 'Driver On The Way', desc: 'Heading to pickup point' },
    { id: 3, title: 'Trip In Progress', desc: 'Enjoying your tour in Sri Lanka' },
    { id: 4, title: 'Completed', desc: 'Arrived safely at destination' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-600" /> Live Trip Status Tracker
        </h3>
        <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
          BK-1001 {status}
        </span>
      </div>

      {/* Progress Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
        {steps.map((step) => (
          <div key={step.id} className="relative flex flex-col space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600">STEP 0{step.id}</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">{step.title}</h4>
            <p className="text-xs text-slate-500">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}