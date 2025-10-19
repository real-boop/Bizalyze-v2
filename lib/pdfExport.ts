import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Exports dashboard tabs to a PDF file.
 * @param headerElement HTMLElement containing the business header (name, price, location)
 * @param tabElements Array of HTMLElements, each representing a tab's content
 * @param tabNames Array of tab names (e.g., ['Score', 'Recommendation', ...])
 * @param fileName Name of the generated PDF file
 */
export async function exportDashboardToPDF({
  headerElement,
  tabElements,
  tabNames,
  fileName = 'dashboard.pdf',
}: {
  headerElement: HTMLElement,
  tabElements: HTMLElement[],
  tabNames: string[],
  fileName?: string,
}) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < tabElements.length; i++) {
    // Capture header as image
    const headerCanvas = await html2canvas(headerElement, { scale: 2 });
    const headerImgData = headerCanvas.toDataURL('image/png');
    const headerHeight = (headerCanvas.height / headerCanvas.width) * pageWidth;

    // Capture tab content as image
    const tabCanvas = await html2canvas(tabElements[i], { scale: 2 });
    const tabImgData = tabCanvas.toDataURL('image/png');
    const tabHeight = (tabCanvas.height / tabCanvas.width) * pageWidth;

    // Add header image
    pdf.addImage(headerImgData, 'PNG', 0, 0, pageWidth, headerHeight);
    // Add tab content image below header
    pdf.addImage(tabImgData, 'PNG', 0, headerHeight, pageWidth, pageHeight - headerHeight - 40);
    // Add tab name as footer
    pdf.setFontSize(12);
    pdf.text(tabNames[i], pageWidth / 2, pageHeight - 20, { align: 'center' });

    // Add new page if not last tab
    if (i < tabElements.length - 1) {
      pdf.addPage();
    }
  }

  pdf.save(fileName);
}

// Usage example (to be called from your dashboard page):
// import { exportDashboardToPDF } from '@/lib/pdfExport';
// exportDashboardToPDF({
//   headerElement: headerRef.current,
//   tabElements: [tab1Ref.current, tab2Ref.current, ...],
//   tabNames: ['Score', 'Recommendation', ...],
//   fileName: 'dashboard.pdf',
// }); 