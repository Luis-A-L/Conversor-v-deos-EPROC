export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING', // Gemini checking file metadata
  READY = 'READY',
  COMPRESSING = 'COMPRESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface VideoFile {
  file: File;
  previewUrl?: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface ComplianceReport {
  isCompliant: boolean;
  message: string;
  suggestedAction: string;
}
