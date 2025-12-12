import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import DropZone from './components/DropZone';
import ConsoleWindow from './components/ConsoleWindow';
import { AppState, VideoFile, LogEntry, ComplianceReport } from './types';
import { analyzeFileCompliance } from './services/geminiService';
import { FileVideo, ArrowRight, Download, CheckCircle2, RotateCcw, AlertTriangle, Cpu, Loader2, MonitorDown } from 'lucide-react';
// @ts-ignore
import { FFmpeg } from '@ffmpeg/ffmpeg';
// @ts-ignore
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [file, setFile] = useState<VideoFile | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const ffmpegRef = useRef<any>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  // Detecta ambiente Electron
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf(' electron/') > -1) {
      setIsElectron(true);
    }
  }, []);

  // Carregar FFmpeg ao iniciar
  useEffect(() => {
    const loadFfmpeg = async () => {
      try {
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;

        ffmpeg.on('log', ({ message }: { message: string }) => {
          // console.log(message);
        });

        ffmpeg.on('progress', ({ progress }: { progress: number }) => {
          setProgress(Math.round(progress * 100));
        });

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        const ffmpegURL = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm';

        addLog(`Iniciando motor v2.1 (${isElectron ? 'Desktop Nativo' : 'Web Seguro'})...`, 'info');

        // --- MANTER LÓGICA DE BLOB ---
        // Mesmo no Electron, usar Blob para o worker evita problemas de protocolo file://
        // e garante compatibilidade com o carregamento via CDN.
        
        const workerResponse = await fetch(`${ffmpegURL}/worker.js`);
        if (!workerResponse.ok) throw new Error("Falha de conexão com biblioteca de compressão");
        let workerScript = await workerResponse.text();

        workerScript = workerScript.replace(
          /from\s+['"]\.\/([^'"]+)['"]/g, 
          `from "${ffmpegURL}/$1"`
        );

        const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
        const workerBlobURL = URL.createObjectURL(workerBlob);

        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          workerURL: workerBlobURL, 
        });

        setIsFfmpegLoaded(true);
        addLog('Motor de compressão carregado e pronto.', 'success');
        if(isElectron) addLog('Aceleração de hardware habilitada (Ambiente Desktop).', 'success');

      } catch (error: any) {
        console.error(error);
        addLog(`Erro de inicialização: ${error.message}`, 'error');
        if (!isElectron && error.message.includes("SharedArrayBuffer")) {
             addLog("Atenção: A versão Web tem limitações de performance. A versão Desktop é recomendada.", 'warning');
        }
      }
    };

    loadFfmpeg();
  }, [addLog, isElectron]);

  const handleFileSelect = async (selectedFile: File) => {
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

    } catch (error: any) {
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
                <h2 className="text-lg font-medium text-gray-800">Compressor E-PROC</h2>
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
        <p>© {new Date().getFullYear()} JFPR | Ferramenta Interna</p>
      </footer>
    </div>
  );
};

export default App;