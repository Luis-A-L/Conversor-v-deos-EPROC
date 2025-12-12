import { ComplianceReport } from "../types";

// Static rules engine for E-PROC compliance
// Replaces previous AI implementation with deterministic code logic

const EPROC_LIMITS = {
  SOFT_LIMIT_BYTES: 50 * 1024 * 1024, // 50MB
  HARD_LIMIT_BYTES: 200 * 1024 * 1024, // 200MB
  PREFERRED_TYPE: 'video/mp4'
};

export const analyzeFileCompliance = async (fileName: string, fileSizeBytes: number, mimeType: string): Promise<ComplianceReport> => {
  // Simulate analysis delay for UX consistency
  await new Promise(resolve => setTimeout(resolve, 800));

  const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
  const isMp4 = mimeType === EPROC_LIMITS.PREFERRED_TYPE;
  const isUnderSoftLimit = fileSizeBytes <= EPROC_LIMITS.SOFT_LIMIT_BYTES;
  const isUnderHardLimit = fileSizeBytes <= EPROC_LIMITS.HARD_LIMIT_BYTES;

  let isCompliant = false;
  let message = "";
  let suggestedAction = "";

  if (isUnderSoftLimit && isMp4) {
    isCompliant = true;
    message = "O arquivo está dentro dos limites do E-PROC e formato correto.";
    suggestedAction = "Carregar Diretamente";
  } else if (!isMp4) {
    isCompliant = false;
    message = `Formato inválido (${mimeType}). O E-PROC requer MP4.`;
    suggestedAction = "Converter e Compactar";
  } else if (!isUnderSoftLimit) {
    isCompliant = false;
    message = `Tamanho (${fileSizeMB} MB) excede a preferência de 50MB.`;
    suggestedAction = isUnderHardLimit ? "Compressão Recomendada" : "Compressão Obrigatória";
  }

  return {
    isCompliant,
    message,
    suggestedAction
  };
};