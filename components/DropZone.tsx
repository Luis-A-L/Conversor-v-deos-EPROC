import React, { useCallback } from 'react';
import { Upload, FileVideo, AlertCircle } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, disabled }) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('video/')) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect, disabled]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect, disabled]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`
        relative group cursor-pointer
        border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300
        ${disabled 
          ? 'border-gray-300 bg-gray-50 opacity-50 cursor-not-allowed' 
          : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50 bg-white'
        }
      `}
    >
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        onChange={handleChange}
        accept="video/*"
        disabled={disabled}
      />
      
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className={`p-4 rounded-full ${disabled ? 'bg-gray-200' : 'bg-blue-100 text-blue-600 group-hover:scale-110 transition-transform'}`}>
          {disabled ? <FileVideo size={32} className="text-gray-400" /> : <Upload size={32} />}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-700">
            {disabled ? 'Processando...' : 'Arraste e solte o vídeo original aqui'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            ou clique para procurar (.mp4, .mov, .avi)
          </p>
        </div>
        {!disabled && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            <AlertCircle size={12} />
            <span>Arquivos processados com segurança</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DropZone;