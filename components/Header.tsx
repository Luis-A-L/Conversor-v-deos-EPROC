import React from 'react';
import { ShieldCheck } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 text-white py-6 shadow-md">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">JFPR | Compressor de Vídeo E-PROC</h1>
            <p className="text-slate-400 text-xs uppercase tracking-wider">Apenas Uso Interno</p>
          </div>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-sm text-slate-300">Ambiente Seguro</p>
          <p className="text-xs text-slate-500">v2.1.0 (Estável)</p>
        </div>
      </div>
    </header>
  );
};

export default Header;