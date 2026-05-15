import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, Mic, MicOff, Send, ShieldCheck, User, PhoneCall, PhoneOff } from 'lucide-react';
import './SecureCommsModal.css';

export default function SecureCommsModal({ isOpen, onClose, incidentId, reporterPhone, incomingAction }) {
    const [messages, setMessages] = useState([
        { id: 1, sender: 'system', text: `Secure 256-bit encrypted line established with ${reporterPhone || 'Reporter'}.` }
    ]);
    const [inputText, setInputText] = useState('');
    const [callState, setCallState] = useState('idle'); // idle, calling, connected
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const chatEndRef = useRef(null);

    // Initialize state based on incoming simulation action from mobile
    useEffect(() => {
        if (isOpen && incomingAction === 'call') {
            setCallState('calling');
            setTimeout(() => setCallState('connected'), 2500);
        } else if (isOpen && incomingAction === 'chat') {
            setCallState('idle');
            // Simulate incoming chat message
            setTimeout(() => {
                setMessages(prev => [...prev, { id: Date.now(), sender: 'reporter', text: 'I need help, can you hear me?' }]);
            }, 1000);
        } else if (!isOpen) {
            setCallState('idle');
            setCallDuration(0);
        }
    }, [isOpen, incomingAction]);

    // Scroll to bottom when messages change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Timer for active call
    useEffect(() => {
        let interval;
        if (callState === 'connected') {
            interval = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(interval);
    }, [callState]);

    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        // Add dispatcher message
        const newMsg = { id: Date.now(), sender: 'dispatcher', text: inputText };
        setMessages(prev => [...prev, newMsg]);
        setInputText('');

        // Simulate reporter "typing" and replying
        setTimeout(() => {
            setMessages(prev => [...prev, { id: Date.now(), sender: 'reporter', text: 'Please hurry! Is the ambulance close by?' }]);
        }, 3000);
    };

    const handleCallToggle = () => {
        if (callState === 'idle') {
            setCallState('calling');
            setTimeout(() => {
                setCallState('connected');
            }, 2500); // Simulate 2.5s ring time
        } else {
            setCallState('idle');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="comms-modal-overlay">
            <div className="comms-modal-container">
                {/* Header */}
                <div className="comms-header">
                    <div className="comms-header-info">
                        <ShieldCheck size={20} className="text-success" />
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h2>Secure Comms Link</h2>
                                <span style={{ fontSize: '10px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Simulation Mode</span>
                            </div>
                            <span className="comms-incident-id">Incident #{incidentId}</span>
                        </div>
                    </div>
                    <button className="comms-close-btn" onClick={() => { setCallState('idle'); onClose(); }}>
                        <X size={20} />
                    </button>
                </div>

                <div className="comms-body">
                    {/* Active Call Panel (Only shows when calling or connected) */}
                    {callState !== 'idle' && (
                        <div className={`active-call-panel ${callState}`}>
                            <div className="call-status-indicator">
                                <div className={`call-pulse ${callState}`}></div>
                                {callState === 'calling' ? (
                                    <span>Establishing Secure Voice Link...</span>
                                ) : (
                                    <span>Live Voice Connected — {formatDuration(callDuration)}</span>
                                )}
                            </div>
                            <div className="call-controls">
                                <button 
                                    className={`call-btn mute-btn ${isMuted ? 'muted' : ''}`}
                                    onClick={() => setIsMuted(!isMuted)}
                                    disabled={callState === 'calling'}
                                >
                                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                                </button>
                                <button className="call-btn end-call-btn" onClick={handleCallToggle}>
                                    <PhoneOff size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Chat Area */}
                    <div className="comms-chat-window">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`chat-message ${msg.sender}`}>
                                {msg.sender === 'system' ? (
                                    <div className="sys-msg">
                                        <Lock size={12} /> {msg.text}
                                    </div>
                                ) : (
                                    <div className="msg-bubble-wrapper">
                                        {msg.sender === 'reporter' && <div className="msg-avatar"><User size={14}/></div>}
                                        <div className="msg-bubble">
                                            {msg.text}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="comms-footer">
                    <button 
                        className={`initiate-call-btn ${callState !== 'idle' ? 'hidden' : ''}`} 
                        onClick={handleCallToggle}
                        title="Start Voice Call"
                    >
                        <PhoneCall size={20} />
                    </button>
                    
                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <input 
                            type="text" 
                            placeholder="Type a secure message..." 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                        <button type="submit" disabled={!inputText.trim()} className="send-msg-btn">
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

// Need to import Lock for the system message
import { Lock } from 'lucide-react';
