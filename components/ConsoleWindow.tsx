import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal } from 'lucide-react';

interface ConsoleWindowProps {
  logs: LogEntry[];
  isOpen: boolean;
}

const ConsoleWindow: React.FC<ConsoleWindowProps> = ({ logs, isOpen }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mt-6 bg-black rounded-lg shadow-2xl overflow-hidden font-mono text-sm border border-gray-700">
      <div className="bg-gray-800 px-4 py-2 flex items-center gap-2 border-b border-gray-700">
        <Terminal size={16} className="text-gray-400" />
        <span className="text-gray-200 text-xs">Windows PowerShell - Script de Compressão E-PROC</span>
      </div>
      <div className="p-4 h-64 overflow-y-auto space-y-1">
        {logs.map((log, index) => (
          <div key={index} className="flex gap-2">
            <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
            <span className={`${
              log.type === 'error' ? 'text-red-500' :
              log.type === 'success' ? 'text-green-400' :
              log.type === 'warning' ? 'text-yellow-400' :
              'text-gray-300'
            }`}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={endRef} />
        <div className="animate-pulse text-green-500">_</div>
      </div>
    </div>
  );
};

export default ConsoleWindow;