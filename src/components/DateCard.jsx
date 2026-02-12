import React from 'react';
import { motion } from 'framer-motion';
// Icons
import { Clock, MapPin, Building, ArrowUpDown } from 'lucide-react';

export default function DateCard({ date, visits, isToday, onSelectVisit, onAddVisit }) {
    // visits is array of { store, timeIn, timeOut, client, ... }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`date-card ${isToday ? 'is-today' : ''}`}
        >

            <div className="date-header">
                <div className="date-day">{date.split('/')[0]}</div>
                <div className="date-info">
                    <span className="date-weekday">{(visits[0]?.weekday || '').replace(/[^a-zA-ZçÇáÁéÉíÍóÓúÚãÃõÕâÂêÊ\-\s]/g, '').toUpperCase()}</span>
                    <span className="date-full">{date}</span>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isToday && <span className="today-badge">HOJE</span>}
                    <button
                        className="add-visit-header-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddVisit(date);
                        }}
                    >
                        + Nova
                    </button>
                </div>
            </div>

            <div className="visits-list">
                {visits.map((visit, index) => (
                    <div
                        key={index}
                        className="visit-item"
                        onClick={() => onSelectVisit(visit)}
                    >
                        {visit.hasPending && <div className="visit-dot" />}

                        {/* Logic for swapped store */}
                        {visit.pendingChange && visit.pendingChange.newStore ? (
                            <div className="visit-swapped-container">
                                <div className="swap-indicator-wrapper">
                                    <ArrowUpDown size={20} className="swap-icon" />
                                </div>
                                <div className="swapped-details">
                                    {/* Original Store & Time */}
                                    <div className="swapped-row original-row">
                                        <div className="visit-time dimmed-time">
                                            <Clock size={14} />
                                            <span>{visit.checkIn} - {visit.checkOut}</span>
                                        </div>
                                        <div className="visit-store original-store-dimmed">
                                            <Building size={14} className="icon-inline" />
                                            {visit.store}
                                        </div>
                                    </div>

                                    {/* New Store & Time */}
                                    <div className="swapped-row new-row">
                                        <div className="visit-time new-time-highlight">
                                            <Clock size={14} />
                                            <span>
                                                {visit.pendingChange.newTime ? (() => {
                                                    // Try to calculate end time based on duration
                                                    try {
                                                        const [origStartH, origStartM] = visit.checkIn.split(':').map(Number);
                                                        const [origEndH, origEndM] = visit.checkOut.split(':').map(Number);
                                                        const durationMinutes = (origEndH * 60 + origEndM) - (origStartH * 60 + origStartM);

                                                        const [newStartH, newStartM] = visit.pendingChange.newTime.split(':').map(Number);
                                                        const newEndTotal = (newStartH * 60 + newStartM) + durationMinutes;
                                                        const newEndH = Math.floor(newEndTotal / 60) % 24;
                                                        const newEndM = newEndTotal % 60;

                                                        const newEndStr = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;
                                                        return `${visit.pendingChange.newTime} - ${newEndStr}`;
                                                    } catch (e) {
                                                        return visit.pendingChange.newTime;
                                                    }
                                                })() : `${visit.checkIn} - ${visit.checkOut}`}
                                            </span>
                                        </div>
                                        <div className="visit-store new-store-highlight">
                                            <Building size={14} className="icon-inline" />
                                            {visit.pendingChange.newStore}
                                        </div>
                                    </div>

                                    {(visit.pendingChange.newClient || visit.client) && (
                                        <p className="visit-client" style={{ marginTop: '8px', paddingLeft: '0' }}>
                                            <MapPin size={12} className="icon-inline" />
                                            {visit.pendingChange.newClient || visit.client}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            // PROFOUND: Standard Layout
                            <>
                                <div className="visit-time">
                                    <Clock size={14} />
                                    <span>{visit.checkIn} - {visit.checkOut}</span>
                                </div>
                                <div className="visit-details">
                                    <h3 className="visit-store">
                                        <Building size={14} className="icon-inline" />
                                        {visit.store}
                                    </h3>
                                    {visit.client && (
                                        <p className="visit-client">
                                            <MapPin size={12} className="icon-inline" />
                                            {visit.client}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </motion.div >
    );
}
