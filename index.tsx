import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { FileVideo, ArrowRight, Download, CheckCircle2, RotateCcw, AlertTriangle, Cpu, Loader2, MonitorDown } from 'lucide-react';
// @ts-ignore
import { FFmpeg } from '@ffmpeg/ffmpeg';
// @ts-ignore
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// --- DEFINIÇÕES LOCAIS (Para evitar erros de importação sem bundler) ---

const AppState = {
  IDLE: 'IDLE',
  ANALYZING: 'ANALYZING',
  READY: 'READY',
  COMPRESSING: 'COMPRESSING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR'
};

// Mock do serviço se não estiver disponível
const analyzeFileCompliance = async (name, size, type) => {
  // Simulação simples
  return { isCompliant: true, message: "Arquivo analisado (Modo Simplificado)" };
};

// Componentes Simplificados (Substituem os imports externos)
const Header = () => (
  <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 mb-6">
    <div className="flex items-center gap-2 text-blue-700">
      <FileVideo />
      <h1 className="text-xl font-bold">TJPR Compressor EPROC</h1>
    </div>
  </header>
);

const DropZone = ({ onFileSelect, disabled }) => (
  <div 
    onClick={() => !disabled && document.getElementById('file-upload')?.click()}
    className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-blue-300 hover:bg-blue-50 hover:border-blue-500'}`}
  >
    <input 
      type="file" 
      id="file-upload" 
      className="hidden" 
      accept="video/*" 
      onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} 
      disabled={disabled}
    />
    <Download className="mx-auto text-blue-500 mb-4" size={48} />
    <p className="text-lg text-gray-700 font-medium">Clique para selecionar um vídeo</p>
    <p className="text-sm text-gray-500 mt-2">MP4, MOV, AVI</p>
  </div>
);

const ConsoleWindow = ({ logs, isOpen }) => {
  if (!isOpen) return null;
  return (
    <div className="mt-8 bg-gray-900 rounded-lg p-4 font-mono text-xs text-gray-300 h-48 overflow-y-auto shadow-inner">
      {logs.map((log, i) => (
        <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">
          <span className="opacity-50 mr-2">[{log.timestamp}]</span>
          <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : ''}>
            {log.message}
          </span>
        </div>
      ))}
    </div>
  );
};

// --- CÓDIGO DO APP PRINCIPAL ---

const App = () => {
  const [appState, setAppState] = useState(AppState.IDLE);
  const [file, setFile] = useState(null);
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [complianceReport, setComplianceReport] = useState(null);
  const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);
  const [isElectron] = useState(() => navigator.userAgent.toLowerCase().indexOf(' electron/') > -1);
  const ffmpegRef = useRef(null);

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  // Carregar FFmpeg ao iniciar
  useEffect(() => {
    const loadFfmpeg = async () => {
      if (isElectron) {
        setIsFfmpegLoaded(true);
        addLog('Ambiente Desktop detectado. Motor nativo ativado.', 'success');
        return;
      }

      try {
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;

        ffmpeg.on('log', ({ message }) => {
          // console.log(message);
        });

        ffmpeg.on('progress', ({ progress }) => {
          setProgress(Math.round(progress * 100));
        });

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        const ffmpegURL = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm';

        addLog(`Iniciando motor v2.1 (${isElectron ? 'Desktop Nativo' : 'Web Seguro'})...`, 'info');

        // --- MANTER LÓGICA DE BLOB ---
        const workerResponse = await fetch(`${ffmpegURL}/worker.js`);
        if (!workerResponse.ok) throw new Error("Falha de conexão com biblioteca de compressão");
        let workerScript = await workerResponse.text();

        workerScript = workerScript.replace(
          /from\s+['"]\.\/([^'"]+)['"]/g, 
          `from "${ffmpegURL}/$1"`
        );

        const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
        const workerBlobURL = URL.createObjectURL(workerBlob);

        // Pré-carrega os blobs do core para garantir que a URL seja válida
        const coreBlobURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
        const wasmBlobURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');

        await ffmpeg.load({
          coreURL: coreBlobURL,
          wasmURL: wasmBlobURL,
          workerURL: workerBlobURL, 
        });

        setIsFfmpegLoaded(true);
        addLog('Motor de compressão carregado e pronto.', 'success');
        if(isElectron) addLog('Aceleração de hardware habilitada (Ambiente Desktop).', 'success');

      } catch (error) {
        console.error(error);
        addLog(`Erro de inicialização: ${error.message}`, 'error');
        if (!isElectron && error.message.includes("SharedArrayBuffer")) {
             addLog("Atenção: A versão Web tem limitações de performance. A versão Desktop é recomendada.", 'warning');
        }
      }
    };

    loadFfmpeg();
  }, [addLog, isElectron]);

  const handleFileSelect = async (selectedFile) => {
    setFile({ file: selectedFile });
    setCompressedBlob(null);
    setAppState(AppState.ANALYZING);
    setLogs([]); 
    
    addLog(`Arquivo selecionado: ${selectedFile.name}`, 'info');
    
    setTimeout(async () => {
      try {
        const report = await analyzeFileCompliance(selectedFile.name, selectedFile.size, selectedFile.type);
        setComplianceReport(report);
        addLog(`Análise: ${report.message}`, report.isCompliant ? 'success' : 'warning');
      } catch (e) {
        addLog('Erro na análise preliminar.', 'error');
      }
      setAppState(AppState.READY);
    }, 800);
  };

  const startCompression = useCallback(async () => {
    if (isElectron) {
      if (!file) return;
      setAppState(AppState.COMPRESSING);
      setProgress(0);
      addLog('Iniciando compressão nativa Multi-Thread (Máxima Performance)...', 'info');

      try {
        const ffmpegStatic = window.require('ffmpeg-static');
        const fluentFfmpeg = window.require('fluent-ffmpeg');
        const path = window.require('path');
        const fs = window.require('fs');
        const os = window.require('os');

        let ffmpegPath = ffmpegStatic;
        if (ffmpegPath.includes('app.asar')) {
            ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
        }
        fluentFfmpeg.setFfmpegPath(ffmpegPath);

        const inputPath = file.file.path;
        const outputPath = path.join(os.tmpdir(), `eproc_${Date.now()}.mp4`);

        fluentFfmpeg(inputPath)
          .output(outputPath)
          .videoCodec('libx264')
          .addOption('-crf', '28')
          .addOption('-preset', 'ultrafast')
          .addOption('-threads', '0')
          .fps(24)
          .audioCodec('aac')
          .audioBitrate('96k')
          .size('1280x720')
          .on('progress', (p) => {
             if(p.percent) setProgress(Math.round(p.percent));
          })
          .on('end', () => {
             const data = fs.readFileSync(outputPath);
             const newBlob = new Blob([data], { type: 'video/mp4' });
             setCompressedBlob(newBlob);
             try { fs.unlinkSync(outputPath); } catch(e){}
             setProgress(100);
             setAppState(AppState.COMPLETED);
             const oldSize = (file.file.size / (1024 * 1024)).toFixed(2);
             const newSize = (newBlob.size / (1024 * 1024)).toFixed(2);
             addLog(`Sucesso: ${oldSize}MB -> ${newSize}MB`, 'success');
          })
          .on('error', (err) => {
             addLog(`Erro: ${err.message}`, 'error');
             setAppState(AppState.ERROR);
          })
          .run();
        return;
      } catch (e) {
        addLog(`Erro nativo: ${e.message}`, 'error');
        setAppState(AppState.ERROR);
        return;
      }
    }

    if (!file || !ffmpegRef.current || !isFfmpegLoaded) {
      addLog('Erro: O motor não está pronto.', 'error');
      return;
    }

    setAppState(AppState.COMPRESSING);
    setProgress(0);
    addLog('Iniciando compressão E-PROC...', 'info');

    try {
      const ffmpeg = ffmpegRef.current;
      const inputFileName = 'input.mp4';
      const outputFileName = 'output.mp4';

      await ffmpeg.writeFile(inputFileName, await fetchFile(file.file));

      // Configuração: 720p, CRF 28 (documentos), Ultrafast
      addLog('Executando script de otimização (H.264/AAC)...', 'warning');
      
      await ffmpeg.exec([
        '-i', inputFileName,
        '-vcodec', 'libx264',
        '-crf', '28', 
        '-preset', 'ultrafast',
        '-r', '24', // Reduz framerate para economizar espaço
        '-acodec', 'aac', 
        '-b:a', '96k', // Audio mono/stéreo básico é suficiente para voz
        '-s', '1280x720',
        outputFileName
      ]);

      addLog('Codificação finalizada.', 'info');
      const data = await ffmpeg.readFile(outputFileName);
      const newBlob = new Blob([data.buffer], { type: 'video/mp4' });
      setCompressedBlob(newBlob);

      try {
        await ffmpeg.deleteFile(inputFileName);
        await ffmpeg.deleteFile(outputFileName);
      } catch (e) {}

      setProgress(100);
      setAppState(AppState.COMPLETED);
      
      const oldSize = (file.file.size / (1024 * 1024)).toFixed(2);
      const newSize = (newBlob.size / (1024 * 1024)).toFixed(2);
      addLog(`Sucesso: ${oldSize}MB -> ${newSize}MB`, 'success');

    } catch (error) {
      console.error(error);
      addLog(`Falha na compressão: ${error.message}`, 'error');
      setAppState(AppState.ERROR);
    }
  }, [file, isFfmpegLoaded, addLog]);

  const handleDownload = () => {
    if (!compressedBlob || !file) return;
    const url = URL.createObjectURL(compressedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EPROC_${file.file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog('Arquivo salvo na pasta de Downloads.', 'success');
  };

  const resetApp = () => {
    setFile(null);
    setCompressedBlob(null);
    setAppState(AppState.IDLE);
    setLogs([]);
    setProgress(0);
    setComplianceReport(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium text-gray-800">TJPR Compressor EPROC</h2>
                {isElectron && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                        <MonitorDown size={10} /> Desktop App
                    </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${
                    appState === AppState.IDLE ? 'bg-gray-400' : 
                    appState === AppState.ERROR ? 'bg-red-500' :
                    'bg-green-500 animate-pulse'
                }`}></span>
                <span className="text-sm text-gray-500 font-mono uppercase">
                   {appState === AppState.COMPRESSING ? 'PROCESSANDO' : appState}
                </span>
              </div>
            </div>

            <div className="p-8">
              {appState === AppState.IDLE && (
                <div className="space-y-4">
                    <DropZone onFileSelect={handleFileSelect} disabled={!isFfmpegLoaded} />
                    {!isFfmpegLoaded && (
                        <div className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin" size={16} />
                            Inicializando ambiente seguro...
                        </div>
                    )}
                </div>
              )}

              {(appState === AppState.ANALYZING || appState === AppState.READY) && file && (
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <FileVideo className="text-blue-600 shrink-0" size={32} />
                    <div className="flex-grow">
                      <h3 className="font-semibold text-blue-900">{file.file.name}</h3>
                      <p className="text-sm text-blue-700">{(file.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      {complianceReport && (
                        <p className="text-sm mt-1 text-gray-600">Status: {complianceReport.message}</p>
                      )}
                    </div>
                  </div>

                  {appState === AppState.READY && (
                    <div className="flex justify-center pt-4">
                       <button
                        onClick={startCompression}
                        disabled={!isFfmpegLoaded}
                        className="group relative inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-white transition-all duration-200 bg-blue-600 rounded-full hover:bg-blue-700 shadow-lg disabled:opacity-50"
                      >
                        Iniciar Compressão
                        <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {appState === AppState.COMPRESSING && (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm font-medium text-gray-600">
                    <span>Processando vídeo...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div className="bg-blue-600 h-4 rounded-full transition-all duration-200" style={{ width: `${progress}%` }}></div>
                  </div>
                  <p className="text-center text-xs text-gray-400">
                    Mantenha o aplicativo aberto. O processamento é local.
                  </p>
                </div>
              )}

              {appState === AppState.COMPLETED && (
                <div className="text-center space-y-6 py-4">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={40} className="text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">Pronto para o E-PROC!</h3>
                  <div className="flex gap-4 justify-center">
                    <button onClick={handleDownload} className="flex items-center gap-2 py-3 px-6 bg-gray-800 text-white rounded-lg hover:bg-gray-900">
                      <Download size={18} /> Salvar Arquivo
                    </button>
                    <button onClick={resetApp} className="flex items-center gap-2 py-3 px-6 border rounded-lg hover:bg-gray-50">
                      <RotateCcw size={18} /> Novo Vídeo
                    </button>
                  </div>
                </div>
              )}
              
              {appState === AppState.ERROR && (
                <div className="text-center py-4">
                    <p className="text-red-600 font-bold">Ocorreu um erro no processamento.</p>
                    <button onClick={resetApp} className="mt-4 text-blue-600 hover:underline">Tentar novamente</button>
                </div>
              )}
            </div>
          </div>
          <ConsoleWindow logs={logs} isOpen={logs.length > 0} />
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto text-center text-sm text-gray-400">
        <p>© {new Date().getFullYear()} TJPR | Ferramenta Interna</p>
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
