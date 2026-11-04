'use client';

import React from 'react';
import { DollarSign, Car, Clock, Users } from 'lucide-react';

export default function AdminStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Revenue</p>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1">LKR 84,500</h3>
        </div>
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign className="w-6 h-6" /></div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Active Trips</p>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1">1 On-Going</h3>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Car className="w-6 h-6" /></div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Pending Assign</p>
          <h3 className="text-xl font-extrabold text-amber-600 mt-1">1 Unassigned</h3>
        </div>
        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Clock className="w-6 h-6" /></div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Available Fleet</p>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1">8 / 10 Drivers</h3>
        </div>
        <div className="p-3 bg-slate-100 text-slate-700 rounded-xl"><Users className="w-6 h-6" /></div>
      </div>
    </div>
  );
}