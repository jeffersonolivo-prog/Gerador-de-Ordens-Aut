import React from 'react';
import { OrderData, OrderItem } from '../services/geminiService';

interface OPPageProps {
  order: OrderData;
  item: OrderItem;
  projetista: string;
  pageNumber: number;
  totalPages: number;
  drawingUrl?: string | null;
}

export const OPPage: React.FC<OPPageProps> = ({ order, item, projetista, pageNumber, totalPages, drawingUrl }) => {
  const integerQuantity = Math.floor(Number(item.quantity));
  
  const formatQuantity = (qty: number, unit: string) => {
    const formattedQty = qty < 10 ? `0${qty}` : `${qty}`;
    const isPlural = qty > 1;
    const unitDisplay = unit.toUpperCase() === 'PÇ' || unit.toUpperCase() === 'PEÇA' || unit.toUpperCase() === 'PC'
      ? (isPlural ? 'PÇS' : 'PÇ') 
      : unit;
    return `${formattedQty} ${unitDisplay}`;
  };

  const itemQtyDisplay = formatQuantity(integerQuantity, item.unit);

  return (
    <div className="flex flex-col">
      <div className="bg-white w-[210mm] h-[296mm] p-[10mm] mx-auto shadow-lg border border-gray-200 mb-8 print:mb-0 print:shadow-none print:border-none flex flex-col font-sans text-[10pt] text-black overflow-hidden box-border print-break-after pdf-page page">
        {/* Header */}
        <div className="border border-black p-2 text-center font-bold text-lg mb-0 uppercase tracking-wider">
          DIMENSÃO ILUMINAÇÃO
        </div>

        <div className="flex border-x border-b border-black min-h-[280px]">
          <div className="w-[15%] border-r border-black p-4 flex items-center justify-center font-bold text-lg">
            {itemQtyDisplay}
          </div>
          <div className="w-[85%] p-4 relative">
            <div className="font-bold mb-6 text-[11pt] leading-tight pr-24">
              {itemQtyDisplay} – {item.code} - {item.description.toUpperCase()}
            </div>
            
            <div className="space-y-0.5 mb-6 font-bold">
              <p>Janela de Inspeção – Sim ( ) Não (X)</p>
              <p>Pintura – Sim ( ) Não (X) – Cor: _________________</p>
              <p>Coleta ( ) - Entrega ( ) - Cliente Retira (X)</p>
            </div>

            <div className="text-center font-bold mb-6 text-[11pt]">CONFORME DESENHO ANEXO.</div>

            <div className="font-bold mb-2">DESCRIÇÃO DE TODOS OS MATERIAIS:</div>
            <div className="space-y-1 text-[10pt] font-bold">
              {order.items.map((it, idx) => (
                <div key={idx}>
                  {formatQuantity(Math.floor(Number(it.quantity)), it.unit)} – {it.code} - {it.description.toUpperCase()}
                </div>
              ))}
              {/* Blank space equivalent to two lines below the last item */}
              <div className="h-10"></div>
            </div>

            {/* Space for manual entry */}
            <div className="mt-8">
              <div className="h-20"></div>
            </div>

            {/* "Copia Controlada" Stamp */}
            <div 
              className="absolute top-6 right-6 border-[3px] border-gray-300 text-gray-300 px-4 py-1 font-bold text-xl tracking-tighter rounded-sm pointer-events-none"
              style={{ transform: 'rotate(-15deg)', zIndex: 10 }}
            >
              <div className="border border-gray-300 px-2 py-0.5 uppercase">
                Copia Controlada
              </div>
            </div>
          </div>
        </div>

        <div className="border-x border-b border-black p-2 text-center font-bold text-[11pt]">
          VENDIDO POR: {order.seller}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 border-x border-b border-black">
          <div className="p-2 border-r border-black flex gap-2">
            <span className="font-bold">CLIENTE:</span> 
            <span className="uppercase">{order.clientName}</span>
          </div>
          <div className="p-2 flex gap-2">
            <span className="font-bold">DATA PEDIDA:</span> {order.printDate}
          </div>
        </div>
        <div className="grid grid-cols-2 border-x border-b border-black">
          <div className="p-2 border-r border-black flex gap-2">
            <span className="font-bold">PEDIDO:</span> {order.orderNumber}
          </div>
          <div className="p-2 flex gap-2">
            <span className="font-bold">DATA ENTREGA:</span> {order.deliveryDate}
          </div>
        </div>

        {/* Workflow Grid */}
        <div className="grid grid-cols-3 border-x border-b border-black h-[100px]">
          <div className="p-2 border-r border-black flex flex-col">
            <div className="font-bold text-[11pt]">PROJETO: <span className="ml-4 font-normal">____/____/____</span></div>
            <div className="mt-auto pb-1 text-[10pt]">
              <span className="font-bold">Ass:</span> __________________________
            </div>
          </div>
          <div className="p-2 border-r border-black flex flex-col">
            <div className="font-bold text-[11pt]">CONFERENCIA: <span className="ml-4 font-normal">____/____/____</span></div>
            <div className="mt-auto pb-1 text-[10pt]">
              <span className="font-bold">Ass:</span> __________________________
            </div>
          </div>
          <div className="p-2 flex flex-col">
            <div className="font-bold text-[11pt]">PRODUÇÃO: <span className="ml-4 font-normal">____/____/____</span></div>
            <div className="mt-auto pb-1 text-[10pt]">
              <span className="font-bold">Ass:</span> ________________________
            </div>
          </div>
        </div>

        {/* Process Steps */}
        <div className="grid grid-cols-3 border-x border-b border-black h-[180px]">
          {/* Corte */}
          <div className="border-r border-black p-2 flex flex-col">
            <div className="font-bold text-[11pt] mb-2">CORTE</div>
            <div className="text-[10pt] space-y-4 flex-grow">
              <div className="flex items-end gap-1">
                <span className="font-bold">Data Inicío Ordem:</span> <span className="font-normal">____/____/____</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-bold">Data Final Prod.</span> <span className="ml-auto font-normal">____/____/____</span>
              </div>
              <div className="mt-auto pb-1">
                <span className="font-bold">Ass:</span> __________________________
              </div>
            </div>
          </div>
          {/* Montagem */}
          <div className="border-r border-black p-2 flex flex-col">
            <div className="font-bold text-[11pt] mb-2 text-center">MONTAGEM</div>
            <div className="text-[10pt] space-y-4 flex-grow">
              <div className="flex items-end gap-1">
                <span className="font-bold">Data Rec. Ordem:</span> <span className="ml-auto font-normal">____/____/____</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-bold">Data Final Prod.</span> <span className="ml-auto font-normal">____/____/____</span>
              </div>
              <div className="mt-auto pb-1">
                <span className="font-bold">Ass:</span> __________________________
              </div>
            </div>
          </div>
          {/* Solda */}
          <div className="p-2 flex flex-col">
            <div className="font-bold text-[11pt] mb-2 text-center">SOLDA</div>
            <div className="text-[10pt] space-y-4 flex-grow">
              <div className="flex items-end gap-1">
                <span className="font-bold">Data Rec. Ordem:</span> <span className="ml-auto font-normal">____/____/____</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-bold">Data Final Prod.</span> <span className="ml-auto font-normal">____/____/____</span>
              </div>
              <div className="mt-auto pb-1">
                <span className="font-bold">Ass:</span> ________________________
              </div>
            </div>
          </div>
        </div>

        {/* Finishing Steps */}
        <div className="grid grid-cols-3 border-x border-b border-black h-[220px]">
          {/* Galvanização */}
          <div className="border-r border-black p-2 flex flex-col">
            <div className="font-bold text-[11pt] mb-2">GALVANIZAÇÃO / ______________</div>
            <div className="text-[9pt] space-y-4 flex-grow mt-2">
              <div>Data de conferência ida: <span className="font-normal">____/____/____</span></div>
              <div><span className="font-bold">Nome:</span> __________________________</div>
              <div>Data de conferência retorno: <span className="font-normal">____/____/____</span></div>
              <div><span className="font-bold">Nome:</span> __________________________</div>
            </div>
          </div>
          {/* Pintura */}
          <div className="border-r border-black p-2 flex flex-col">
            <div className="font-bold text-[11pt] mb-2">PINTURA / _____________________</div>
            <div className="text-[9pt] space-y-4 flex-grow mt-2">
              <div>Data de conferência ida: <span className="font-normal">____/____/____</span></div>
              <div><span className="font-bold">Nome:</span> __________________________</div>
              <div>Data de conferência retorno: <span className="font-normal">____/____/____</span></div>
              <div><span className="font-bold">Nome:</span> __________________________</div>
            </div>
          </div>
          {/* Finalização */}
          <div className="p-2 flex flex-col">
            <div className="font-bold text-[11pt] mb-2 text-center uppercase">Finalização</div>
            <div className="text-[10pt] space-y-8 flex-grow flex flex-col justify-start mt-4">
              <div className="flex items-end gap-1">
                <span className="font-bold">Produto finalizado:</span> <span className="ml-auto font-normal">____/____/____</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-bold">Faturamento:</span> <span className="ml-auto font-normal">____/____/____</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-bold">Entrega:</span> <span className="ml-auto font-normal">____/____/____</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-auto pt-2 text-[9pt]">
          <div>F07- ORDEM DE SERVIÇO – REV06 – 16/01/2025</div>
          <div className="font-bold uppercase">PG: {pageNumber}/{totalPages}</div>
        </div>
      </div>

      {/* Drawing Page */}
      {drawingUrl && (
        <div className="bg-white w-[210mm] h-[296mm] p-[10mm] mx-auto shadow-lg border border-gray-200 mb-8 print:mb-0 print:shadow-none print:border-none flex flex-col font-sans overflow-hidden box-border print-break-after pdf-page page">
          <div className="flex-grow flex items-center justify-center border-2 border-stone-100 rounded-lg overflow-hidden relative">
            <img 
              src={drawingUrl} 
              alt={`Desenho para ${item.code}`} 
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
            
            {/* Drawing Info Overlay (Legend) */}
            <div className="absolute bottom-4 right-4 bg-white/90 border border-black p-3 text-[9pt] font-mono leading-tight shadow-sm min-w-[250px] z-20">
              <div className="mb-1">
                <span className="font-bold">ORDEM DE FABRICAÇÃO:</span> {order.orderNumber}
              </div>
              <div className="mb-1">
                <span className="font-bold">CLIENTE:</span> {order.clientName.toUpperCase()}
              </div>
              <div className="flex justify-between mb-1">
                <div><span className="font-bold">VENDEDOR:</span> {order.seller.toUpperCase()}</div>
                <div><span className="font-bold">DATA:</span> {order.printDate}</div>
              </div>
              <div className="mb-2">
                <span className="font-bold">PROJETISTA:</span> {projetista.toUpperCase() || '____________________'}
              </div>
              <div className="text-[12pt] font-bold border-t border-black pt-1 mt-1">
                QUANTIDADE = {formatQuantity(Math.floor(Number(item.quantity)), item.unit)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center text-[9pt] text-stone-500 border-t pt-2">
            <div className="font-bold uppercase">Desenho Técnico: {item.code}</div>
            <div className="font-bold uppercase italic">Anexo à OP: {order.orderNumber}</div>
          </div>
        </div>
      )}
    </div>
  );
};
