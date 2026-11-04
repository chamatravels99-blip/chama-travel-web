'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface BookingTableProps {
  onAssignClick: (bookingId: string) => void;
}

export default function BookingTable({ onAssignClick }: BookingTableProps) {
  const [search, setSearch] = useState('');
  const [bookings] = useState([
    { id: 'BK-1001', customer: 'Alexander Wright', pickup: 'CMB Airport', dropoff: 'Mirissa Coastal Villa', date: 'Today, 2:30 PM', vehicle: 'Luxury SUV', driver: 'Nimal Perera', status: 'Picked Up', amount: 'LKR 28,500' },
    { id: 'BK-1002', customer: 'Sophia Martinez', pickup: 'Colombo 07', dropoff: 'Kandy Heritage Hotel', date: 'Today, 4:00 PM', vehicle: 'VIP Van', driver: 'Unassigned', status: 'Pending', amount: 'LKR 34,000' },
    { id: 'BK-1003', customer: 'Lars Thorne', pickup: 'Galle Fort', dropoff: 'CMB Airport', date: 'Tomorrow, 8:00 AM', vehicle: 'Luxury Sedan', driver: 'Sunil Shantha', status: 'Assigned', amount: 'LKR 22,000' },
  ]);

  const filteredBookings = bookings.filter(
    (b) => b.id.toLowerCase().includes(search.toLowerCase()) || b.customer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="font-bold text-slate-900">Live Reservations & Dispatch</h3>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search booking ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-4">BOOKING ID</th>
              <th className="p-4">CUSTOMER</th>
              <th className="p-4">ROUTE</th>
              <th className="p-4">VEHICLE</th>
              <th className="p-4">DRIVER</th>
              <th className="p-4">STATUS</th>
              <th className="p-4">FAIR</th>
              <th className="p-4 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBookings.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/80 transition-all">
                <td className="p-4 font-bold text-slate-900">{b.id}</td>
                <td className="p-4 font-medium text-slate-800">{b.customer}</td>
                <td className="p-4">
                  <div>{b.pickup} <span className="text-blue-600 font-bold">→</span> {b.dropoff}</div>
                  <span className="text-[10px] text-slate-400">{b.date}</span>
                </td>
                <td className="p-4">{b.vehicle}</td>
                <td className="p-4">
                  {b.driver === 'Unassigned' ? (
                    <span className="text-amber-600 bg-amber-50 font-bold px-2.5 py-1 rounded-lg border border-amber-200">
                      Unassigned
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-700">{b.driver}</span>
                  )}
                </td>
                <td className="p-4">
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                      b.status === 'Picked Up'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : b.status === 'Pending'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="p-4 font-bold text-slate-900">{b.amount}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => {
                      if (b.driver === 'Unassigned') {
                        onAssignClick(b.id);
                      }
                    }}
                    className={`font-semibold px-3 py-1.5 rounded-lg text-[11px] transition-all ${
                      b.driver === 'Unassigned'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {b.driver === 'Unassigned' ? 'Assign Driver' : 'Manage'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}