import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, FileText, Printer, Loader2, AlertCircle, CheckCircle2, ChevronLeft, Download, Calendar, FileDown, Table, Image as ImageIcon, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { addBusinessDays, format, parseISO, isValid } from 'date-fns';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { extractOrderData, OrderData } from './services/geminiService';
import { OPPage } from './components/OPPage';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [manualDeliveryDate, setManualDeliveryDate] = useState<string>('');
  const [manualPrintDate, setManualPrintDate] = useState<string>('');
  const [projetista, setProjetista] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'upload' | 'preview'>('upload');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isProcessingDrawings, setIsProcessingDrawings] = useState(false);
  const [drawings, setDrawings] = useState<Record<string, string>>({});

  const calculateDefaultDeliveryDate = (days: number) => {
    const today = new Date();
    const deliveryDate = addBusinessDays(today, days);
    return format(deliveryDate, 'yyyy-MM-dd');
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const data = await extractOrderData(base64);
        if (data) {
          setOrderData(data);
          const defaultDate = calculateDefaultDeliveryDate(data.manufacturingDays || 25);
          setManualDeliveryDate(defaultDate);
          
          // Handle print date from PDF footer
          if (data.printDate) {
            const parts = data.printDate.split('/');
            if (parts.length === 3) {
              const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
              setManualPrintDate(isoDate);
            } else {
              setManualPrintDate(format(new Date(), 'yyyy-MM-dd'));
            }
          } else {
            setManualPrintDate(format(new Date(), 'yyyy-MM-dd'));
          }

          setView('preview');
        } else {
          setError('Não foi possível extrair os dados do pedido. No Vercel, verifique se a variável VITE_GEMINI_API_KEY está configurada corretamente.');
        }
        setIsExtracting(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao processar o arquivo.');
      setIsExtracting(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  } as any);

  const handleDownloadPDF = async () => {
    if (!orderData) return;
    
    setIsGeneratingPDF(true);
    const element = document.getElementById('op-container');
    
    if (!element) {
      console.error("Erro: Container de ordens não encontrado.");
      setError("Erro: Não foi possível encontrar o conteúdo para gerar o PDF.");
      setIsGeneratingPDF(false);
      return;
    }

    try {
      const html2pdfModule = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: 0,
        filename: `OP_Pedido_${orderData.orderNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.95 },
        html2canvas: { 
          scale: 2, // Higher scale for better quality
          useCORS: true, 
          logging: false,
          letterRendering: true,
          allowTaint: false,
          imageTimeout: 0, // Wait indefinitely for images to load
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
          onclone: (clonedDoc: Document) => {
            const container = clonedDoc.getElementById('op-container');
            if (container) {
              container.style.margin = '0';
              container.style.padding = '0';
              container.style.width = '210mm';
              
              const pages = container.querySelectorAll('.pdf-page');
              pages.forEach((page: any) => {
                page.style.marginBottom = '0';
                page.style.boxShadow = 'none';
                page.style.border = 'none';
                page.style.height = '296mm';
              });

              // Add a style tag to the cloned document to override modern colors globally in the clone
              const styleTag = clonedDoc.createElement('style');
              styleTag.innerHTML = `
                * {
                  color-scheme: light !important;
                }
                #op-container, #op-container * {
                  --color-emerald-600: #059669 !important;
                  --color-stone-100: #f5f5f4 !important;
                  --color-stone-200: #e7e5e4 !important;
                  --color-stone-500: #78716c !important;
                  --color-stone-600: #57534e !important;
                  --color-stone-900: #1c1917 !important;
                  border-color: currentColor !important;
                }
                /* Fix for legend and other potential black elements */
                .bg-white, [class*="bg-white/"] {
                  background-color: #ffffff !important;
                  color: #000000 !important;
                }
                .text-black {
                  color: #000000 !important;
                }
              `;
              clonedDoc.head.appendChild(styleTag);

              // Aggressively remove all oklab/oklch/color-mix references from all style tags
              const styleTags = clonedDoc.querySelectorAll('style');
              styleTags.forEach(tag => {
                try {
                  tag.innerHTML = tag.innerHTML
                    .replace(/oklch\([^)]+\)/g, '#000000')
                    .replace(/oklab\([^)]+\)/g, '#000000')
                    .replace(/color-mix\([^)]+\)/g, 'currentColor');
                } catch (e) {
                  console.warn("Could not clean style tag", e);
                }
              });

              // Clean up modern colors that html2canvas doesn't support (oklab, oklch)
              const allElements = container.querySelectorAll('*');
              allElements.forEach((el: any) => {
                try {
                  const style = window.getComputedStyle(el);
                  
                  // html2canvas fails on oklab/oklch. We force standard RGB values.
                  // Browsers usually return RGB in getComputedStyle even for oklch, 
                  // but some properties or variables might still leak it.
                  if (style.color.includes('okl') || style.color.includes('mix')) el.style.color = '#000000';
                  if (style.backgroundColor.includes('okl') || style.backgroundColor.includes('mix')) el.style.backgroundColor = '#ffffff';
                  if (style.borderColor.includes('okl') || style.borderColor.includes('mix')) el.style.borderColor = '#000000';
                  
                  // Check inline styles too
                  if (el.style.color.includes('okl') || el.style.color.includes('mix')) el.style.color = '#000000';
                  if (el.style.backgroundColor.includes('okl') || el.style.backgroundColor.includes('mix')) el.style.backgroundColor = '#ffffff';
                  if (el.style.borderColor.includes('okl') || el.style.borderColor.includes('mix')) el.style.borderColor = '#000000';

                  // Fix for transparency issues that might render as black
                  if (style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent') {
                    if (el.classList.contains('bg-white') || el.classList.contains('bg-stone-50')) {
                      el.style.backgroundColor = '#ffffff';
                    }
                  }

                  el.style.colorScheme = 'light';
                  
                  // Also handle SVG properties if any
                  if (el instanceof SVGElement) {
                    const fill = style.fill;
                    const stroke = style.stroke;
                    if (fill && (fill.includes('okl') || fill.includes('mix'))) el.style.fill = 'currentColor';
                    if (stroke && (stroke.includes('okl') || stroke.includes('mix'))) el.style.stroke = 'currentColor';
                  }
                } catch (e) {
                  // Ignore errors for individual elements
                }
              });
            }
          }
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const, compress: true },
        pagebreak: { mode: 'css' as any, after: '.print-break-after' }
      };

      // Use worker for better stability and ensure images are loaded
      const worker = html2pdfModule().set(opt).from(element);
      await worker.save();
    } catch (err: any) {
      console.error("Erro ao gerar PDF:", err);
      setError(`Erro ao gerar PDF: Verifique se há caracteres especiais ou tente usar 'Imprimir' e 'Salvar como PDF'.`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDrawingsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !orderData) return;

    setIsProcessingDrawings(true);
    const newDrawings: Record<string, string> = { ...drawings };
    
    const compressImage = (base64: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 2400; // Increased for better resolution
          const MAX_HEIGHT = 2400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.9 quality
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = base64;
      });
    };

    const processFile = async (file: File) => {
      if (!file.type.startsWith('image/')) return;

      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const result = event.target?.result as string;
          const compressed = await compressImage(result);
          
          const matchedItem = orderData.items.find(item => {
            const code = item.code.toLowerCase();
            const desc = item.description.toLowerCase();
            const nameWithoutExt = file.name.split('.')[0].toLowerCase();
            
            return nameWithoutExt === code || 
                   desc.includes(nameWithoutExt) || 
                   nameWithoutExt.includes(code);
          });

          if (matchedItem) {
            newDrawings[matchedItem.code] = compressed;
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    };

    // Process all files
    await Promise.all(Array.from(files).map((file: File) => processFile(file)));
    
    setDrawings(newDrawings);
    setIsProcessingDrawings(false);
  };

  const reset = () => {
    setOrderData(null);
    setView('upload');
    setError(null);
    setManualDeliveryDate('');
    setManualPrintDate('');
    setDrawings({});
  };

  const formattedDeliveryDate = manualDeliveryDate 
    ? format(parseISO(manualDeliveryDate), 'dd/MM/yyyy')
    : orderData?.deliveryDate || '';

  const formattedPrintDate = manualPrintDate
    ? format(parseISO(manualPrintDate), 'dd/MM/yyyy')
    : orderData?.printDate || format(new Date(), 'dd/MM/yyyy');

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1C1917] font-sans selection:bg-emerald-100">
      {/* Header - Hidden on Print */}
      <header className="bg-white border-b border-stone-200 py-4 px-6 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <FileText className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Gerador de OP</h1>
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Dimensão Iluminação</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {view === 'preview' && (
              <>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Novo Pedido
                </button>
                <div className="relative">
                  <input
                    type="file"
                    id="drawings-upload"
                    multiple
                    // @ts-ignore - webkitdirectory is non-standard but widely supported
                    webkitdirectory=""
                    directory=""
                    className="hidden"
                    onChange={handleDrawingsUpload}
                    accept="image/*"
                  />
                  <label
                    htmlFor="drawings-upload"
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-full transition-colors cursor-pointer",
                      isProcessingDrawings && "opacity-50 cursor-wait"
                    )}
                  >
                    {isProcessingDrawings ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FolderOpen className="w-4 h-4" />
                    )}
                    {isProcessingDrawings ? "Processando..." : "Carregar Pasta de Desenhos"}
                    {Object.keys(drawings).length > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {Object.keys(drawings).length}
                      </span>
                    )}
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors",
                    isGeneratingPDF && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  {isGeneratingPDF ? "Gerando..." : "Salvar PDF"}
                </button>
              </>
            )}
          </div>
        </div>
        {view === 'preview' && (
          <div className="max-w-7xl mx-auto px-6 mt-2 text-right print:hidden">
            <p className="text-[10px] text-stone-400 italic">
              Dica: Se o botão não funcionar, tente reduzir o número de desenhos ou recarregar a página.
            </p>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {view === 'upload' ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto mt-12"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl font-light text-stone-900 mb-4 italic serif">
                  Transforme Pedidos em Produção
                </h2>
                <p className="text-stone-500 max-w-md mx-auto">
                  Faça o upload do PDF do pedido e geraremos automaticamente as ordens de produção formatadas.
                </p>
              </div>

              <div
                {...getRootProps()}
                className={cn(
                  "relative group cursor-pointer rounded-[2rem] border-2 border-dashed transition-all duration-300 p-12 text-center",
                  isDragActive 
                    ? "border-emerald-500 bg-emerald-50/50" 
                    : "border-stone-300 bg-white hover:border-emerald-400 hover:bg-stone-50/50"
                )}
              >
                <input {...getInputProps()} />
                
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110",
                    isExtracting ? "bg-stone-100" : "bg-emerald-100"
                  )}>
                    {isExtracting ? (
                      <Loader2 className="w-10 h-10 text-stone-400 animate-spin" />
                    ) : (
                      <FileUp className="w-10 h-10 text-emerald-600" />
                    )}
                  </div>

                  {isExtracting ? (
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-stone-800">Analisando Pedido...</p>
                      <p className="text-sm text-stone-500">A inteligência artificial está extraindo os itens.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-stone-800">
                        {isDragActive ? "Solte o arquivo aqui" : "Arraste o pedido em PDF"}
                      </p>
                      <p className="text-sm text-stone-500">ou clique para selecionar do seu computador</p>
                    </div>
                  )}
                </div>

                {/* Decorative corners */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-stone-200 group-hover:border-emerald-200 transition-colors" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-stone-200 group-hover:border-emerald-200 transition-colors" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-stone-200 group-hover:border-emerald-200 transition-colors" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-stone-200 group-hover:border-emerald-200 transition-colors" />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <div className="mt-12 grid grid-cols-3 gap-6">
                {[
                  { icon: CheckCircle2, title: "Automático", desc: "Extração via IA" },
                  { icon: FileText, title: "Formatado", desc: "Layout oficial OP" },
                  { icon: Printer, title: "Pronto", desc: "Impressão em um clique" },
                ].map((feature, i) => (
                  <div key={i} className="text-center p-4">
                    <feature.icon className="w-6 h-6 text-stone-400 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-stone-800">{feature.title}</h3>
                    <p className="text-xs text-stone-500">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center"
            >
              {/* Summary Bar - Hidden on Print */}
              <div className="w-full max-w-4xl bg-white rounded-2xl border border-stone-200 p-6 mb-8 flex flex-wrap gap-8 print:hidden">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Cliente</p>
                  <p className="font-bold text-stone-800">{orderData?.clientName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Pedido Nº</p>
                  <p className="font-bold text-stone-800">#{orderData?.orderNumber}</p>
                </div>
                <div className="min-w-[180px]">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data Pedida
                  </p>
                  <input
                    type="date"
                    value={manualPrintDate}
                    onChange={(e) => setManualPrintDate(e.target.value)}
                    className="font-bold text-stone-800 bg-stone-50 border border-stone-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="min-w-[180px]">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data de Entrega
                  </p>
                  <input
                    type="date"
                    value={manualDeliveryDate}
                    onChange={(e) => setManualDeliveryDate(e.target.value)}
                    className="font-bold text-stone-800 bg-stone-50 border border-stone-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <p className="text-[10px] text-stone-400 mt-1 italic">
                    Padrão: {orderData?.manufacturingDays} dias úteis
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Vendedor</p>
                  <p className="font-bold text-stone-800">{orderData?.seller}</p>
                </div>
                <div className="min-w-[150px]">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Projetista</p>
                  <input
                    type="text"
                    placeholder="Nome do Projetista"
                    value={projetista}
                    onChange={(e) => setProjetista(e.target.value)}
                    className="w-full font-bold text-stone-800 bg-stone-50 border border-stone-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* OP Pages */}
              <div id="op-container" className="flex flex-col">
                {orderData?.items.map((item, index) => (
                  <OPPage
                    key={index}
                    order={{
                      ...orderData,
                      deliveryDate: formattedDeliveryDate,
                      printDate: formattedPrintDate
                    }}
                    item={item}
                    projetista={projetista}
                    pageNumber={index + 1}
                    totalPages={orderData.items.length}
                    drawingUrl={drawings[item.code] || null}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
