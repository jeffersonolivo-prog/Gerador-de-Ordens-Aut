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
          setError('Não foi possível extrair os dados do pedido. Verifique se o PDF é válido.');
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

  const handlePrint = () => {
    const element = document.getElementById("op-container");

    if (!element) {
      alert("Erro: conteúdo de impressão não encontrado.");
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está ativado.");
      return;
    }

    const styles = `
      <style>
        body {
          margin: 0;
          padding: 0;
          background: white;
          font-family: Arial, sans-serif;
        }

        .page {
          width: 210mm;
          height: 297mm;
          margin: 0 auto;
          page-break-after: always;
          box-sizing: border-box;
          position: relative;
        }

        @page {
          size: A4;
          margin: 0;
        }

        /* Import Tailwind styles for the cloned content */
        @import url('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');
        
        /* Custom styles to match the app's look */
        .border-black { border-color: #000 !important; }
        .border-x { border-left-width: 1px !important; border-right-width: 1px !important; }
        .border-b { border-bottom-width: 1px !important; }
        .border-r { border-right-width: 1px !important; }
        .font-bold { font-weight: bold !important; }
        .text-center { text-align: center !important; }
        .flex { display: flex !important; }
        .grid { display: grid !important; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        
        /* Ensure stamp rotation in print */
        .absolute { position: absolute !important; }
        .rotate-\[-15deg\] { transform: rotate(-15deg) !important; }
      </style>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Impressão OP - Pedido ${orderData?.orderNumber}</title>
          ${styles}
        </head>
        <body>
          ${element.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

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
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          letterRendering: true,
          allowTaint: false,
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
              
              // Ensure all pages are visible for capture
              const pages = container.querySelectorAll('.pdf-page');
              pages.forEach((page: any) => {
                page.style.marginBottom = '0';
                page.style.boxShadow = 'none';
                page.style.border = 'none';
                page.style.height = '296.5mm'; // Slightly less than 297mm to avoid overflow
              });
            }
          }
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: 'css' as any, after: '.print-break-after' }
      };

      await html2pdfModule().set(opt).from(element).save();
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
    
    const processFile = async (file: File) => {
      // Only accept images for speed and stability
      if (!file.type.startsWith('image/')) return;

      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          const fileName = file.name.toLowerCase();
          
          // Match by code or description
          const matchedItem = orderData.items.find(item => {
            const code = item.code.toLowerCase();
            const desc = item.description.toLowerCase();
            const nameWithoutExt = file.name.split('.')[0].toLowerCase();
            
            return nameWithoutExt === code || 
                   desc.includes(nameWithoutExt) || 
                   nameWithoutExt.includes(code);
          });

          if (matchedItem) {
            newDrawings[matchedItem.code] = result;
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

  const handleDownloadExcel = () => {
    if (!orderData) {
      setError("Nenhum dado de pedido carregado.");
      return;
    }

    const items = orderData.items || [];
    if (items.length === 0) {
      setError("Não foram encontrados itens no pedido para exportar.");
      return;
    }

    console.log("Exportando itens para Excel:", items);

    const data = items.map(item => ({
      'Pedido': String(orderData.orderNumber || ''),
      'Cliente': String(orderData.clientName || ''),
      'Vendedor': String(orderData.seller || ''),
      'Data Entrega': manualDeliveryDate ? format(parseISO(manualDeliveryDate), 'dd/MM/yyyy') : String(orderData.deliveryDate || ''),
      'Código': String(item.code || ''),
      'Descrição': String(item.description || ''),
      'Quantidade': String(item.quantity || ''),
      'Unidade': String(item.unit || '')
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Itens do Pedido");
    
    XLSX.writeFile(workbook, `Pedido_${orderData.orderNumber || 'Export'}.xlsx`);
  };

  const reset = () => {
    setOrderData(null);
    setView('upload');
    setError(null);
    setManualDeliveryDate('');
    setManualPrintDate('');
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
                <button
                  onClick={handleDownloadExcel}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 rounded-full transition-colors"
                >
                  <Table className="w-4 h-4" />
                  Baixar Excel
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
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-full hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
              </>
            )}
          </div>
        </div>
        {view === 'preview' && (
          <div className="max-w-7xl mx-auto px-6 mt-2 text-right print:hidden">
            <p className="text-[10px] text-stone-400 italic">
              Dica: Se os botões não abrirem o diálogo, use <span className="font-bold">Ctrl + P</span> no teclado.
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
