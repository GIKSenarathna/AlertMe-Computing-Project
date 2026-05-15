import React from 'react';

export default function AlertMeLogo({ size = 48, color = "white", className = "" }) {
    return (
        <svg 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <mask id="check-mask">
                    <rect width="24" height="24" fill="white" />
                    <path 
                        d="M9 12l2.5 2.5 5-5" 
                        stroke="black" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        fill="none" 
                    />
                </mask>
            </defs>
            <path 
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" 
                fill={color} 
                mask="url(#check-mask)"
            />
        </svg>
    );
}
