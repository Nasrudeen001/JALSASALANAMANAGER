import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import QRCode from "qrcode"
import ExcelJS from "exceljs"

// Helper to add a unified Excel header matching the PDF header design
async function addUnifiedExcelHeader(worksheet: any, headerCols: string[], eventTitle?: string, eventSettings?: EventSettings, recordLabel?: string, filtersText?: string, logoUrl: string = LOGO_URL) {
  const lastCol = headerCols[headerCols.length - 1];
  let currentRow = 1;

  // Helper to detect table column labels that shouldn't be used as titles
  const tableColumnLabels = [
    'S/N', 'Full Name', 'Tanzeem', 'Region', 'Jamaat', 'Name', 'Day', 'Meal Type', 'Current Status', 'Last Updated'
  ];
  const isColumnLabel = (s?: string) => {
    if (!s) return false;
    const lower = s.toLowerCase();
    return tableColumnLabels.some(lbl => lbl.toLowerCase() === lower || lower.includes(lbl.toLowerCase()));
  };

  // Main title - Always "JALSA SALANA KENYA - [Current Year]"
  const currentYear = new Date().getFullYear();
  const mainTitle = `JALSA SALANA KENYA - ${currentYear}`;
  worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = mainTitle;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { name: 'Georgia', size: 18, bold: true };
  currentRow++;

  // Event name as subtitle (if available)
  const safeEventName = eventSettings?.eventName || (!isColumnLabel(eventTitle) && eventTitle);
  if (safeEventName) {
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const subtitleCell = worksheet.getCell(`A${currentRow}`);
    subtitleCell.value = safeEventName;
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subtitleCell.font = { name: 'Georgia', size: 16, bold: true };
    currentRow++;
  }
  
  // Theme and date
  if (eventSettings) {
    const startDate = new Date(eventSettings.startingDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (eventSettings.duration - 1));
  const themeText = eventSettings.theme || '';
    const dateText = `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} - ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
  const themeCell = worksheet.getCell(`A${currentRow}`);
  themeCell.value = themeText;
  themeCell.alignment = { horizontal: 'center' };
  // Render event theme in italics
  themeCell.font = { name: 'Georgia', size: 12, italic: true };
  currentRow++;
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = dateText;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { name: 'Georgia', size: 12 };
    currentRow++;
  }
  // Record label - only show if it's not a simple table column label
  // and not a duplicate of the event name we already printed as subtitle.
  const shouldShowRecordLabel = recordLabel && !isColumnLabel(recordLabel) && recordLabel.trim() !== (safeEventName || '').trim();
  if (shouldShowRecordLabel) {
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const rl = worksheet.getCell(`A${currentRow}`);
    rl.value = recordLabel;
    rl.alignment = { horizontal: 'center' };
    rl.font = { name: 'Georgia', size: 13, bold: true };
    currentRow++;
  }
  // Filters text
  if (filtersText) {
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const ft = worksheet.getCell(`A${currentRow}`);
    ft.value = filtersText;
    ft.alignment = { horizontal: 'center' };
    ft.font = { name: 'Georgia', italic: true, size: 11 };
    currentRow++;
  }
  // Blank row before table headers
  currentRow++;
  return currentRow;
}
import type { TajneedMember, AttendanceRecord, EventSettings, CateringRecord } from "./types"

const LOGO_URL = "/minarat.png" // Used for ID cards (registered, surplus, individual)
const DEFAULT_LOGO_URL = "/logo.png" // Used for other PDFs (Attendance, Tajneed, Security, Catering)
const SYSTEM_TITLE = "Jalsa Salana Management System"

// Ensure Georgia and Playfair fonts are available in jsPDF when provided.
// NOTE: fetching TTF files directly from the browser can cause 404s if the
// files are not present in `public/`. To avoid noisy 404s we register fonts
// only when a base64 string is injected into the page at runtime. This keeps
// sensible fallbacks when the font files aren't available.
const ensureGeorgiaFont = async (doc: jsPDF) => {
  try {
    if (typeof window === 'undefined') return
    const anyWin = window as any
    const georgiaBase64 = anyWin.GEORGIA_TTF_BASE64 as string | undefined
    const playfairBase64 = anyWin.PLAYFAIR_TTF_BASE64 as string | undefined
    const aptosNarrowBase64 = anyWin.APTOS_NARROW_TTF_BASE64 as string | undefined
    const gillSansMTBase64 = anyWin.GILL_SANS_MT_TTF_BASE64 as string | undefined

    if (georgiaBase64) {
      try {
        doc.addFileToVFS('Georgia.ttf', georgiaBase64)
        doc.addFont('Georgia.ttf', 'Georgia', 'normal')
        doc.addFont('Georgia.ttf', 'Georgia', 'bold')
      } catch (e) {
        // ignore if addFileToVFS / addFont not available
      }
    }

    if (playfairBase64) {
      try {
        // Register Playfair Display Black weight if provided by the page
        doc.addFileToVFS('PlayfairDisplay-Black.ttf', playfairBase64)
        doc.addFont('PlayfairDisplay-Black.ttf', 'PlayfairDisplay', 'black')
      } catch (e) {
        // ignore if addFileToVFS / addFont not available
      }
    }

    if (aptosNarrowBase64) {
      try {
        // Register Aptos Narrow font for member details
        doc.addFileToVFS('AptosNarrow.ttf', aptosNarrowBase64)
        doc.addFont('AptosNarrow.ttf', 'AptosNarrow', 'normal')
        doc.addFont('AptosNarrow.ttf', 'AptosNarrow', 'bold')
      } catch (e) {
        // ignore if addFileToVFS / addFont not available
      }
    }

    if (gillSansMTBase64) {
      try {
        // Register Gill Sans MT Condensed font for ID card header
        doc.addFileToVFS('GillSansMT.ttf', gillSansMTBase64)
        doc.addFont('GillSansMT.ttf', 'GillSansMT', 'normal')
        doc.addFont('GillSansMT.ttf', 'GillSansMT', 'bold')
      } catch (e) {
        // ignore if addFileToVFS / addFont not available
      }
    }
  } catch (e) {
    // ignore and fall back to built-in fonts
  }
}

// Helper to draw a centered header with logo, title, theme and date.
const drawCenteredPDFHeader = async (doc: jsPDF, eventTitle?: string, eventSettings?: EventSettings, recordLabel?: string, filtersText?: string, logoUrl: string = DEFAULT_LOGO_URL) => {
  await ensureGeorgiaFont(doc)
  const pageWidth = doc.internal.pageSize.getWidth()
  const startY = 12
  const logoSize = 25 // Increased logo size
  const leftMargin = 15 // Left margin for logo
  
  try {
    doc.addImage(logoUrl, 'PNG', leftMargin, startY, logoSize, logoSize)
  } catch (e) {
    // ignore image errors
  }

  // Title settings: use Playfair Display Black at 12pt if available
  const titleFontSize = 12
  doc.setFontSize(titleFontSize)
  try { doc.setFont('PlayfairDisplay', 'black') } catch {
    // Fall back to Georgia/times if Playfair isn't registered
    try { doc.setFont('Georgia', 'bold') } catch { doc.setFont('times', 'bold') }
  }
  doc.setTextColor(0, 0, 0)
  const title = eventTitle || SYSTEM_TITLE
  // Center title in the entire page width
  // small helper to convert points -> mm (1pt = 0.352778 mm)
  const ptsToMm = (pt: number) => pt * 0.352778

  // Title already set above; render it centered. Keep single-line behavior.
  doc.text(title, pageWidth / 2, startY + 4, { align: 'center' })

  // Start Y positioned at the title baseline
  let currentY = startY + 4

  if (eventSettings) {
    const startDate = new Date(eventSettings.startingDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + (eventSettings.duration - 1))
    const themeText = eventSettings.theme || ''
    const dateText = `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} - ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`

    const themeFontSize = 12
    const dateFontSize = 12

    // Theme: render in italics and use 1.5 line spacing between title, theme and date
    doc.setFontSize(themeFontSize)
    try { doc.setFont('Georgia', 'italic') } catch { doc.setFont('times', 'italic') }
    doc.setTextColor(80, 80, 80)
    const themeY = currentY + ptsToMm(themeFontSize) * 1.5
    doc.text(themeText, pageWidth / 2, themeY, { align: 'center' })

    // Date - normal font, 1.5 line spacing below theme
    doc.setFontSize(dateFontSize)
    try { doc.setFont('Georgia', 'normal') } catch { doc.setFont('times', 'normal') }
    const dateY = themeY + ptsToMm(dateFontSize) * 1.5
    doc.text(dateText, pageWidth / 2, dateY, { align: 'center' })
    currentY = dateY
  }

  // Draw record label (e.g., "All Attendance Records" or "Attendance (Tanzeem-Region-Jamaat)")
  if (recordLabel) {
    doc.setFontSize(13)
    try { doc.setFont('Georgia', 'bold') } catch { doc.setFont('times', 'bold') }
    doc.setTextColor(30, 30, 30)
    doc.text(recordLabel, pageWidth / 2, currentY + 6, { align: 'center' })
    currentY += 10
  }

  // Draw filters text if provided (smaller, muted)
  if (filtersText) {
    doc.setFontSize(11)
    try { doc.setFont('Georgia', 'normal') } catch { doc.setFont('times', 'normal') }
    doc.setTextColor(100, 100, 100)
    doc.text(filtersText, pageWidth / 2, currentY + 6, { align: 'center' })
    currentY += 8
  }

  // return y coordinate where table should start
  return currentY + 8
}

// Shared function to generate ID card content for all types (Attendance, Tajneed, Surplus)
const generateCommonIDCardContent = async (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  eventTitle: string | undefined,
  qrCodeDataURL: string | undefined,
  eventSettings: EventSettings | undefined,
  details: {
    name: string,
    tanzeem: string,
    region: string,
    jamaat: string
  }
) => {
  // Add a bold off-white border (inset slightly so the stroke sits inside the card)
  const borderColor = 0xF5; // Very light gray (almost white)
  doc.setDrawColor(borderColor, borderColor, borderColor);
  // Thicker border for stronger frame appearance
  doc.setLineWidth(2.2);
  // Draw the rect inset by 0.5mm so the stroke sits inside the card edges
  doc.rect(x + 0.5, y + 0.5, width - 1, height - 1);

  const padding = 2 // Small padding for content inside border
  const contentWidth = width - (padding * 2)
  const contentHeight = height - (padding * 2)
  const contentX = x + padding
  const contentY = y + padding

  // ========== HEADER SECTION (Logo and title on same level) ==========
  // Black header background with height 25mm to cover logo and content
  const headerHeight = 28 // Fixed 28mm height
  const headerY = contentY
  const headerBottomY = headerY + headerHeight

  // Logo positioned at left border with dimensions 9mm x 30mm (moved 1mm closer to left)
  const logoWidth = 9
  const logoHeight = 30
  const logoX = contentX // 0mm from left border (moved 2mm left total: 1mm - 1mm adjustment)
  const logoY = headerY + (headerHeight - logoHeight) / 2 // Vertically centered in header

  // Add black background to header section (25mm height)
  doc.setFillColor(0, 0, 0) // Black background
  doc.rect(contentX, headerY, contentWidth, headerHeight, 'F') // Fill the header area

  try {
    doc.addImage(LOGO_URL, "PNG", logoX, logoY, logoWidth, logoHeight)
  } catch (e) {
    // Logo might not load, continue without it
  }

  // Title area starts at logo width (no gap, moved closer to left border)
  const rightX = logoX + logoWidth // No spacing gap (moved 2mm left from previous 2mm offset)
  const rightWidth = contentX + contentWidth - rightX - 4 // Added right margin
  
  // Title - single line with truncation if needed
  // Use Gill Sans MT Condensed at 13pt for card title (reduced by 1pt), WHITE text
  const titleFontSize = 13
  doc.setFontSize(titleFontSize)
  try { doc.setFont("GillSansMT", "bold") } catch {
    try { doc.setFont("Georgia", "bold") } catch { doc.setFont("times", "bold") }
  }
  doc.setTextColor(255, 255, 255) // WHITE text
  const title = eventTitle || SYSTEM_TITLE
  // Truncate to keep the title to a single line within card bounds
  const truncatedTitle = title.length > 50 ? title.substring(0, 47) + "..." : title
  // Event details (theme + dates)
  const detailLines: string[] = []
  if (eventSettings) {
    const startDate = new Date(eventSettings.startingDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + (eventSettings.duration - 1))

    const themeText = eventSettings.theme.length > 45 ? eventSettings.theme.substring(0, 42) + "..." : eventSettings.theme

    // Helper to produce ordinal suffix (1ST, 2ND, 3RD, 4TH...)
    const ordinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"]
      const v = n % 100
      return n + (s[(v - 20) % 10] || s[v] || s[0]).toUpperCase()
    }

    const formatMonthYear = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase() + ' ' + d.getFullYear()

    let dateText = ''
    // If same month and year: format as "6TH-7TH DECEMBER 2025"
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      const startOrd = ordinal(startDate.getDate())
      const endOrd = ordinal(endDate.getDate())
      dateText = `${startOrd}-${endOrd} ${formatMonthYear(startDate)}`
    } else {
      // Different month/year: fall back to per-date ordinal with month/year each side
      const startOrd = ordinal(startDate.getDate())
      const endOrd = ordinal(endDate.getDate())
      dateText = `${startOrd} ${startDate.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()} ${startDate.getFullYear()} - ${endOrd} ${endDate.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()} ${endDate.getFullYear()}`
    }

    detailLines.push(themeText)
    detailLines.push(dateText)
  }

  // Calculate positions for centered alignment and use 1.5 line spacing
  const ptsToMm = (pt: number) => pt * 0.352778
  let startY = headerY + 5 // Start 5mm from top of header background (moved 2mm closer to top)

  // Render single-line title (titleFontSize defined above)
  const detailFontSize = 10
  doc.setFontSize(titleFontSize)
  doc.text(truncatedTitle, rightX + rightWidth / 2, startY, { align: "center" })
  // Move down by 2 * title font size (converted to mm) for 2 line spacing
  startY += ptsToMm(titleFontSize) * 2

  // Render event details in the order: Date (normal) then Theme (italic), separated by 2 line spacing, WHITE text
  // We constructed `detailLines` earlier as [themeText, dateText] originally; use the explicit variables if available
  try {
  // Use detailLines array: index 1 is date (if present), index 0 is theme
  const dateLine = detailLines[1] || ''
  const themeLine = detailLines[0] || ''

    if (dateLine) {
      // Date: white color, use Georgia (normal) to preserve condensed font for Title only
      try { doc.setFont("Georgia", "normal") } catch { doc.setFont("times", "normal") }
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(11) // reduced by 1pt
      doc.text(dateLine, rightX + rightWidth / 2, startY, { align: "center" })
      startY += ptsToMm(11) * 2
    }

    if (themeLine) {
      // Theme: white color, render in italic using Georgia (keep condensed font reserved for Title)
      try { doc.setFont("Georgia", "italic") } catch { doc.setFont("times", "italic") }
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(12)
      doc.text(themeLine, rightX + rightWidth / 2, startY, { align: "center" })
      startY += ptsToMm(12) * 2
    }
  } catch (e) {
    // Fallback: render any lines present in detailLines in order
    for (let i = 0; i < detailLines.length; i++) {
      try { doc.setFont("GillSansMT", "normal") } catch { try { doc.setFont("Georgia", "normal") } catch { doc.setFont("times", "normal") } }
      doc.setTextColor(255,255,255)
      doc.setFontSize(12)
      doc.text(detailLines[i], rightX + rightWidth / 2, startY, { align: "center" })
      startY += ptsToMm(12) * 1.5
    }
  }

  // Separator line removed as per design update

  // ========== MEMBER DETAILS SECTION ==========
  // Spacing between header and member details: 1 line spacing
  const headerToMemberSpacing = ptsToMm(14 * 1) // 1 line spacing using label font size (14pt)
  const memberDetailsStartY = headerBottomY + headerToMemberSpacing
  const memberDetailsHeight = contentHeight - headerHeight - headerToMemberSpacing - 2 // Adjusted for new spacing
  const memberDetailsY = memberDetailsStartY

  // QR code area dimensions - increased size
  const qrAreaWidth = Math.min(contentWidth * 0.42, 42) // Increased from 0.36/36
  const detailsWidth = contentWidth - qrAreaWidth - 4 // Reduced padding
  const leftMargin = contentX + 4
  let currentY = memberDetailsStartY + 2

  // Text styles for ID card details
  // Use Aptos Narrow 14pt for member details, labels unbold
  const labelFontSize = 14
  const valueFontSize = 14
  // New spacing requirements:
  // - label-to-value: 2 line spacing
  // - detail-to-detail: 3 line spacing
  const lineSpacing = 2 // label-to-value spacing multiplier
  const detailSpacing = 3 // spacing between member detail groups

  // Convert line spacing values to mm (1pt line spacing ≈ 0.352778mm)
  const ptsToMmSpacing = (pt: number) => pt * 0.352778
  const labelToValueSpacing = ptsToMmSpacing(labelFontSize * lineSpacing) - 1 // Reduced by 1mm
  const detailToDetailSpacing = ptsToMmSpacing(labelFontSize * detailSpacing) - 1 // Reduced by 1mm

  // Function to draw dashed line
  const drawDashedLine = (x: number, y: number, width: number) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    
    const dashLength = 3;
    const gapLength = 2;
    let currentX = x;
    
    while (currentX < x + width) {
      const endX = Math.min(currentX + dashLength, x + width);
      doc.line(currentX, y, endX, y);
      currentX += dashLength + gapLength;
    }
  };

  // Name
  try { doc.setFont("AptosNarrow", "normal") } catch { doc.setFont("Georgia", "normal") }
  doc.setFontSize(labelFontSize)
  doc.setTextColor(0, 0, 0) // Black label
  doc.text("Name", leftMargin, currentY)
  currentY += labelToValueSpacing
  if (details.name.startsWith("SURPLUS-")) {
    drawDashedLine(leftMargin, currentY, detailsWidth - 8)
  } else {
    try { doc.setFont("AptosNarrow", "normal") } catch { doc.setFont("Georgia", "normal") }
    doc.setFontSize(valueFontSize)
    doc.setTextColor(0, 100, 0) // Dark green value
    doc.text(details.name.length > 30 ? details.name.substring(0, 30) + "..." : details.name, leftMargin, currentY)
  }
  currentY += detailToDetailSpacing

  // Tanzeem removed from ID card details as per design update

  // Region
  try { doc.setFont("AptosNarrow", "normal") } catch { doc.setFont("Georgia", "normal") }
  doc.setFontSize(labelFontSize)
  doc.setTextColor(0, 0, 0) // Black label
  doc.text("Region", leftMargin, currentY)
  currentY += labelToValueSpacing
  if (details.name.startsWith("SURPLUS-")) {
    drawDashedLine(leftMargin, currentY, detailsWidth - 8)
  } else {
    try { doc.setFont("AptosNarrow", "normal") } catch { doc.setFont("Georgia", "normal") }
    doc.setFontSize(valueFontSize)
    doc.setTextColor(0, 100, 0) // Dark green value
    doc.text(details.region, leftMargin, currentY)
  }
  currentY += detailToDetailSpacing

  // Jamaat
  try { doc.setFont("AptosNarrow", "normal") } catch { doc.setFont("Georgia", "normal") }
  doc.setFontSize(labelFontSize)
  doc.setTextColor(0, 0, 0) // Black label
  doc.text("Jamaat", leftMargin, currentY)
  currentY += labelToValueSpacing
  if (details.name.startsWith("SURPLUS-")) {
    drawDashedLine(leftMargin, currentY, detailsWidth - 8)
  } else {
    try { doc.setFont("AptosNarrow", "normal") } catch { doc.setFont("Georgia", "normal") }
    doc.setFontSize(valueFontSize)
    doc.setTextColor(0, 100, 0) // Dark green value
    doc.text(details.jamaat, leftMargin, currentY)
  }

  // Prepare QR code position variables in outer scope so signature placement can reference them
  let qrSize = 0
  let qrX = 0
  let qrY = 0
  if (qrCodeDataURL) {
    qrSize = Math.min(qrAreaWidth - 2, memberDetailsHeight - 6, 63) // Reduced max size by 2mm (was 65)
    qrX = contentX + contentWidth - qrAreaWidth + 1 // Adjusted position
    // Position QR near bottom area close to signature:
    // signature top approximates to y + height - signatureImageHeightReduced - 6 (signatureImageHeightReduced = 6)
    // We want the QR bottom to sit ~1mm above the signature top.
    // Therefore: qrY + qrSize = y + height - signatureImageHeightReduced - 6 - 1
    // With signatureImageHeightReduced == 6 this simplifies to:
  qrY = y + height - qrSize - 18 // move QR 5mm further away from bottom
    try {
      doc.addImage(qrCodeDataURL, "PNG", qrX, qrY, qrSize, qrSize)
    } catch (e) {
      // QR code might fail, continue without it
      qrSize = 0
      qrX = 0
      qrY = 0
    }
  }

  // ========== AMJ IMAGE AND TEXT AT BOTTOM LEFT ==========
  // AMJ image: 9mm x 9mm size
  const amjImageSize = 9 // 9mm x 9mm size
  
  // Position AMJ uniformly: 6mm from bottom border (3mm + 3mm additional), 3mm from left border
  const amjImageY = y + height - amjImageSize - 6 // 6mm from bottom
  const amjImageX = x + 3 // 3mm from left border
  
  try {
    doc.addImage('/amj.png', 'PNG', amjImageX, amjImageY, amjImageSize, amjImageSize)
  } catch (e) {
    // AMJ image might fail, continue without it
  }

  // Add "AMJ" (bigger) above "KENYA" (smaller) below the image
  const amjTextX = amjImageX + amjImageSize / 2 // Center with image
  const amjTopFontSize = 8 // AMJ bigger
  const amjBottomFontSize = 5 // KENYA smaller
  const amjTextTopY = amjImageY + amjImageSize + 1.9 // moved AMJ 0.9mm towards KENYA (now 1.9mm below image)
  const amjTextBottomY = amjTextTopY + 1.6 // reduced gap so KENYA sits 1.6mm below AMJ

  try { doc.setFont("AptosNarrow", "bold") } catch { doc.setFont("Georgia", "bold") }
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(amjTopFontSize)
  doc.text("AMJ", amjTextX, amjTextTopY, { align: "center" })
  doc.setFontSize(amjBottomFontSize)
  doc.text("KENYA", amjTextX, amjTextBottomY, { align: "center" })

  // ========== SIGNATURE SECTION ==========
  // Position signature uniformly: 6mm from bottom border (3mm more), 1mm from right border
  const signatureImageHeightReduced = 6 // Reduced signature image height
  const signatureWidthReduced = 34 // Reduced signature image width
  
  // Position from bottom: 6mm gap (3mm + 3mm additional)
  const signatureImageY = y + height - signatureImageHeightReduced - 6
  
  // Position from right: 1mm from border
  const signatureX = x + width - signatureWidthReduced - 1 // 1mm from right border
  
  try {
    // Attempt to add the image from public/; if it fails (missing or cross-origin), ignore and fall back to text-only
    doc.addImage('/signature.png', 'PNG', signatureX, signatureImageY, signatureWidthReduced, signatureImageHeightReduced)
  } catch (e) {
    // ignore image errors
  }

  // Draw signature line (placed below the image, uniformly positioned)
  const signatureY = signatureImageY + signatureImageHeightReduced + 1
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(signatureX, signatureY, signatureX + signatureWidthReduced, signatureY)

  // Add signature text "AFSAR JALSA" uniformly positioned
  try { doc.setFont("Georgia", "normal") } catch { doc.setFont("times", "normal") }
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)
  doc.text("AFSAR JALSA", signatureX + signatureWidthReduced / 2, signatureY + 3, { align: "center" })
}

// Generate ID cards for attendance records (4 per A4 page)
export const generateAttendanceIDCards = async (
  records: AttendanceRecord[],
  filename: string,
  eventTitle?: string,
  eventSettings?: EventSettings,
) => {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    const margin = 8
    const bottomMargin = 6
    const spacing = 4
    const availableWidth = pageWidth - margin * 2
    const availableHeight = pageHeight - margin - bottomMargin
    const cols = 2
    const rows = 2
  const actualCardWidth = 75
    const actualCardHeight = 110

    const validRecords = records.filter((record) => record.member)

    for (let i = 0; i < validRecords.length; i++) {
      const record = validRecords[i]
      if (!record.member) continue

      const cardsPerPage = cols * rows
      const cardIndex = i % cardsPerPage
      const row = Math.floor(cardIndex / cols)
      const col = cardIndex % cols

      if (i > 0 && cardIndex === 0) {
        doc.addPage()
      }

      const x = margin + col * (actualCardWidth + spacing)
      const y = margin + row * (actualCardHeight + spacing)

      const qrData = JSON.stringify({
        id: record.id,
        memberId: record.member.id,
        name: record.member.fullName,
        region: record.member.region,
        jamaat: record.member.jamaat,
  tanzeem: record.member.tanzeem,
        recordedAt: record.recordedAt,
      })

      const qrCodeDataURL = await generateQRCodeDataURL(qrData)

      await generateCommonIDCardContent(
        doc,
        x,
        y,
        actualCardWidth,
        actualCardHeight,
        eventTitle,
        qrCodeDataURL,
        eventSettings,
        {
          name: record.member.fullName,
          tanzeem: record.member.tanzeem,
          region: record.member.region,
          jamaat: record.member.jamaat
        }
      )
    }

    doc.save(filename)
  } catch (error) {
    console.error("Error generating ID cards:", error)
    alert("Failed to generate ID cards. Please try again.")
  }
}

// Generate single attendance ID card
export const generateSingleAttendanceIDCard = async (
  record: AttendanceRecord,
  filename: string,
  eventTitle?: string,
  eventSettings?: EventSettings,
) => {
  try {
    if (!record.member) {
      alert("Member information not available")
      return
    }

    const qrData = JSON.stringify({
      id: record.id,
      memberId: record.member.id,
      name: record.member.fullName,
      region: record.member.region,
      jamaat: record.member.jamaat,
  tanzeem: record.member.tanzeem,
      recordedAt: record.recordedAt,
    })

    const qrCodeDataURL = await generateQRCodeDataURL(qrData)

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

  const cardWidth = 75
    const cardHeight = 110
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const x = (pageWidth - cardWidth) / 2
    const y = (pageHeight - cardHeight) / 2

    await generateCommonIDCardContent(
      doc,
      x,
      y,
      cardWidth,
      cardHeight,
      eventTitle,
      qrCodeDataURL,
      eventSettings,
      {
        name: record.member.fullName,
  tanzeem: record.member.tanzeem,
        region: record.member.region,
        jamaat: record.member.jamaat
      }
    )

    doc.save(filename)
  } catch (error) {
    console.error("Error generating ID card:", error)
    alert("Failed to generate ID card. Please try again.")
  }
}

// Export Attendance records to PDF
export async function exportAttendanceToPDF(
  records: AttendanceRecord[],
  filename: string,
  eventTitle?: string,
  eventSettings?: EventSettings,
  recordLabel?: string,
  filtersText?: string,
) {
  try {
    const doc = new jsPDF()
    const headers = [["S/N", "Full Name", "Tanzeem", "Region", "Jamaat"]]
    const validRecords = records.filter((r) => r.member)
    const data = validRecords.map((r, idx) => [
      (idx + 1).toString(),
      r.member!.fullName,
      r.member!.tanzeem,
      r.member!.region,
      r.member!.jamaat,
    ])

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // draw centered header (logo + title + optional theme/date)
  const tableStartY = await drawCenteredPDFHeader(doc, eventTitle, eventSettings, recordLabel, filtersText, DEFAULT_LOGO_URL)

    autoTable(doc, {
      head: [["S/N", "Full Name", "Tanzeem", "Region", "Jamaat"]],
      body: data,
      startY: tableStartY,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [102, 102, 102],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [10, 102, 204],
        lineWidth: 0.2,
        fontSize: 10,
        font: 'Georgia',
        cellPadding: 4
      },
      bodyStyles: {
        font: 'Georgia',
        lineColor: [102, 102, 102]
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249]
      },
      didDrawPage: (data) => {
        try {
          const total = validRecords.length
          let rowsOnPage = 0
          if (data.table && Array.isArray((data.table as any).body)) {
            rowsOnPage = (data.table as any).body.filter((r: any) => r.pageNumber === data.pageNumber).length
          }
          if (!rowsOnPage) {
            rowsOnPage = Math.min(total, data.table ? (data.table as any).rows && (data.table as any).rows.length ? (data.table as any).rows.length : total : total)
          }

          const footerY = pageHeight - 10
          doc.setFontSize(10)
          doc.setTextColor(0, 0, 0)
          doc.text(`${rowsOnPage} of ${total}`, 14, footerY)
        } catch (e) {
          // ignore footer errors
        }
      },
    })

    doc.save(filename)
  } catch (error) {
    console.error("Error exporting attendance to PDF:", error)
    alert("Failed to export attendance PDF. Please try again.")
  }
}

// Export Attendance records to Excel
export async function exportAttendanceToExcel(records: AttendanceRecord[], filename: string, eventTitle?: string, eventSettings?: EventSettings, recordLabel?: string, filtersText?: string) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance");
    
    // Add headers and get the current row
    const headerCols = ["A", "B", "C", "D", "E"];
    let currentRow = await addUnifiedExcelHeader(worksheet, headerCols, eventTitle, eventSettings, recordLabel, filtersText);
    
    // Set up columns with proper widths
    worksheet.columns = [
      { header: "S/N", key: "sn", width: 6 },
      { header: "Full Name", key: "fullName", width: 30 },
      { header: "Tanzeem", key: "tanzeem", width: 16 },
      { header: "Region", key: "region", width: 20 },
      { header: "Jamaat", key: "jamaat", width: 16 },
    ];

    // Insert and style the main header row
    const headers = ["S/N", "Full Name", "Tanzeem", "Region", "Jamaat"];
    worksheet.insertRow(currentRow, headers);
    const headerRowNumber = currentRow;
    currentRow++;

    // Add data rows
    const validRecords = records.filter((r) => r.member);
    validRecords.forEach((r, idx) => {
      const row = worksheet.addRow({
        sn: idx + 1,
        fullName: r.member!.fullName,
        tanzeem: r.member!.tanzeem,
        region: r.member!.region,
        jamaat: r.member!.jamaat
      });

      // Style each cell in the data row
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF666666' } },
          left: { style: 'thin', color: { argb: 'FF666666' } },
          bottom: { style: 'thin', color: { argb: 'FF666666' } },
          right: { style: 'thin', color: { argb: 'FF666666' } }
        };
        cell.font = { name: 'Georgia', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
    });
    // Add professional borders and styling
    // Style header row and add professional borders
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0A66CC' },
      };
      cell.font = { name: 'Georgia', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF666666' } },
        left: { style: 'thin', color: { argb: 'FF666666' } },
        bottom: { style: 'medium', color: { argb: 'FF666666' } },
        right: { style: 'thin', color: { argb: 'FF666666' } }
      };
    });
    // freeze panes to keep header visible (freeze above the first data row)
    worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting attendance to Excel:", error);
    alert("Failed to export attendance Excel. Please try again.");
  }
}

// Generate ID cards for Tajneed members (4 per A4 page)
export const generateTajneedIDCards = async (
  members: TajneedMember[],
  filename: string,
  eventTitle?: string,
  eventSettings?: EventSettings,
) => {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    const margin = 8
    const bottomMargin = 6
  const spacing = 30
    const availableWidth = pageWidth - margin * 2
    const availableHeight = pageHeight - margin - bottomMargin
    const cols = 2
    const rows = 2
  const actualCardWidth = 75
    const actualCardHeight = 110

    for (let i = 0; i < members.length; i++) {
      const member = members[i]

      const cardsPerPage = cols * rows
      const cardIndex = i % cardsPerPage
      const row = Math.floor(cardIndex / cols)
      const col = cardIndex % cols

      if (i > 0 && cardIndex === 0) {
        doc.addPage()
      }

      const x = margin + col * (actualCardWidth + spacing)
      const y = margin + row * (actualCardHeight + spacing)

      const qrData = member.id
      const qrCodeDataURL = await generateQRCodeDataURL(qrData)

      await generateCommonIDCardContent(
        doc,
        x,
        y,
        actualCardWidth,
        actualCardHeight,
        eventTitle,
        qrCodeDataURL,
        eventSettings,
        {
          name: member.fullName,
          tanzeem: member.tanzeem,
          region: member.region,
          jamaat: member.jamaat
        }
      )
    }

    doc.save(filename)
  } catch (error) {
    console.error("Error generating ID cards:", error)
    alert("Failed to generate ID cards. Please try again.")
  }
}

// Generate single Tajneed ID card
export const generateSingleTajneedIDCard = async (
  member: TajneedMember,
  filename: string,
  eventTitle?: string,
  eventSettings?: EventSettings,
) => {
  try {
    const qrData = member.id
    const qrCodeDataURL = await generateQRCodeDataURL(qrData)

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

  const cardWidth = 75
    const cardHeight = 110
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const x = (pageWidth - cardWidth) / 2
    const y = (pageHeight - cardHeight) / 2

    await generateCommonIDCardContent(
      doc,
      x,
      y,
      cardWidth,
      cardHeight,
      eventTitle,
      qrCodeDataURL,
      eventSettings,
      {
        name: member.fullName,
        tanzeem: member.tanzeem,
        region: member.region,
        jamaat: member.jamaat
      }
    )

    doc.save(filename)
  } catch (error) {
    console.error("Error generating ID card:", error)
    alert("Failed to generate ID card. Please try again.")
  }
}

// Generate 100 surplus ID cards with QR codes and empty fields
export const generateSurplusIDCards = async (eventTitle?: string, eventSettings?: EventSettings) => {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    const margin = 8
    const bottomMargin = 6
  const spacing = 30
    const availableWidth = pageWidth - margin * 2
    const availableHeight = pageHeight - margin - bottomMargin
    const cols = 2
    const rows = 2
  const actualCardWidth = 75
  const actualCardHeight = 110

    const totalCards = 100
    const baseTimestamp = Date.now()

    // Generate all card IDs and their QR codes first
    const cardData = await Promise.all(
      Array.from({ length: totalCards }, async (_, i) => {
        const cardId = `SURPLUS-${baseTimestamp}-${String(i).padStart(3, '0')}`
        const qrCodeDataURL = await generateQRCodeDataURL(cardId)
        return { cardId, qrCodeDataURL }
      })
    )

    // Now create the cards with the pre-generated QR codes
    // Process in batches to prevent UI from freezing
    const batchSize = 10
    for (let i = 0; i < cardData.length; i++) {
      const { cardId, qrCodeDataURL } = cardData[i]
      
      const cardsPerPage = cols * rows
      const cardIndex = i % cardsPerPage
      const row = Math.floor(cardIndex / cols)
      const col = cardIndex % cols

      if (i > 0 && cardIndex === 0) {
        doc.addPage()
      }

      const x = margin + col * (actualCardWidth + spacing)
      const y = margin + row * (actualCardHeight + spacing)

      // Call without await - this is a synchronous operation
      generateCommonIDCardContent(
        doc,
        x,
        y,
        actualCardWidth,
        actualCardHeight,
        eventTitle,
        qrCodeDataURL,
        eventSettings,
        {
          name: cardId,
          tanzeem: "",
          region: "",
          jamaat: ""
        }
      )

      // Yield to the browser every batchSize cards to prevent "not responding" errors
      if ((i + 1) % batchSize === 0) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    doc.save(`surplus-id-cards-${Date.now()}.pdf`)
  } catch (error) {
    console.error("Error generating surplus ID cards:", error)
    alert("Failed to generate surplus ID cards. Please try again.")
  }
}

// Generate QR code data URL
const generateQRCodeDataURL = async (data: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
  } catch (error) {
    console.error("Error generating QR code:", error)
    return ""
  }
}

// Export Tajneed members to Excel
async function exportTajneedToExcel(
  members: TajneedMember[],
  filename: string,
  eventTitle?: string,
  eventSettings?: EventSettings,
  recordLabel?: string,
  filtersText?: string,
) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tajneed Members");
    const headerCols = ["A", "B", "C", "D", "E"];
    let currentRow = await addUnifiedExcelHeader(worksheet, headerCols, eventTitle, eventSettings, recordLabel, filtersText);
    worksheet.columns = [
      { header: "S/N", key: "sn", width: 10 },
      { header: "Full Name", key: "fullName", width: 30 },
      { header: "Tanzeem", key: "tanzeem", width: 15 },
      { header: "Region", key: "region", width: 20 },
      { header: "Jamaat", key: "jamaat", width: 20 },
    ];
    // insert header row
    const headers = ["S/N", "Full Name", "Tanzeem", "Region", "Jamaat"];
    worksheet.insertRow(currentRow, headers);
    const headerRowNumber = currentRow;
    currentRow++;
    members.forEach((member, index) => {
      worksheet.addRow({
        sn: index + 1,
        fullName: member.fullName,
        tanzeem: member.tanzeem,
        region: member.region,
        jamaat: member.jamaat,
      });
    });
    // style header row
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A66CC' } };
      cell.font = { name: 'Georgia', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });
    worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    // For browser: use workbook.xlsx.writeBuffer()
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting Tajneed to Excel:", error);
    alert("Failed to export Tajneed to Excel. Please try again.");
  }
}


// Export Tajneed members to PDF
async function exportTajneedToPDF(
  members: TajneedMember[],
  filename: string,
  eventTitle?: string,
  eventSettings?: EventSettings,
  recordLabel?: string,
  filtersText?: string,
) {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Prepare table data (no ID / Created At)
    const data = members.map((member, index) => [
      index + 1,
      member.fullName,
      member.tanzeem,
      member.region,
      member.jamaat,
    ]);

    // draw centered header
  const tableStartY = await drawCenteredPDFHeader(doc, eventTitle || 'Tajneed Members List', eventSettings, recordLabel, filtersText, DEFAULT_LOGO_URL)

    // Add table
    doc.setFontSize(11);
    autoTable(doc, {
      head: [["S/N", "Full Name", "Tanzeem", "Region", "Jamaat"]],
      body: data,
      startY: tableStartY,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [102, 102, 102],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [10, 102, 204],
        lineWidth: 0.2,
        fontSize: 10,
        font: 'Georgia',
        cellPadding: 4
      },
      bodyStyles: {
        font: 'Georgia',
        lineColor: [102, 102, 102]
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249]
      },
      columnStyles: {
        0: { cellWidth: 15 }, // S/N (increased for better fit)
        1: { cellWidth: 57 }, // Full Name (slightly reduced to accommodate wider S/N)
        2: { cellWidth: 30 }, // Tanzeem
        3: { cellWidth: 40 }, // Region
        4: { cellWidth: 30 }, // Jamaat
      },
      didDrawPage: (data) => {
        try {
          const total = members.length
          let rowsOnPage = 0
          if (data.table && Array.isArray((data.table as any).body)) {
            rowsOnPage = (data.table as any).body.filter((r: any) => r.pageNumber === data.pageNumber).length
          }
          if (!rowsOnPage) rowsOnPage = Math.min(total, (data.table as any).rows ? (data.table as any).rows.length : total)
          const footerY = doc.internal.pageSize.getHeight() - 10
          doc.setFontSize(10)
          doc.setTextColor(0, 0, 0)
          doc.text(`${rowsOnPage} of ${total}`, 14, footerY)
        } catch (e) { }
      }
    });

    doc.save(filename);
  } catch (error) {
    console.error("Error exporting Tajneed to PDF:", error);
    alert("Failed to export Tajneed to PDF. Please try again.");
  }
}


// Export Security Records to Excel
export const exportSecurityToExcel = async (records: AttendanceRecord[], statusMap: Record<string, string>, filename?: string, eventTitle?: string, eventSettings?: EventSettings, recordLabel?: string, filtersText?: string) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Security Records');
    const headerCols = ["A", "B", "C", "D", "E", "F", "G"];
    let currentRow = await addUnifiedExcelHeader(worksheet, headerCols, eventTitle, eventSettings, recordLabel, filtersText);
    worksheet.columns = [
      { header: 'S/N', key: 'sn', width: 6 },
      { header: 'Name', key: 'name', width: 35 },
      { header: 'Tanzeem', key: 'tanzeem', width: 20 },
      { header: 'Region', key: 'region', width: 25 },
      { header: 'Jamaat', key: 'jamaat', width: 20 },
      { header: 'Current Status', key: 'status', width: 18 },
      { header: 'Last Updated', key: 'updated', width: 22 },
    ];
    // insert header row
    const headers = ['S/N','Name','Tanzeem','Region','Jamaat','Current Status','Last Updated'];
    worksheet.insertRow(currentRow, headers);
    const headerRowNumber = currentRow;
    currentRow++;
    // add data
    const filtered = records.filter(r => r.member);
    filtered.forEach((record, index) => {
      worksheet.addRow({
        sn: index + 1,
        name: record.member!.fullName,
        tanzeem: record.member!.tanzeem,
        region: record.member!.region,
        jamaat: record.member!.jamaat,
        status: statusMap[record.id] || 'In',
        updated: new Date().toLocaleString()
      });
    });
    // style header row
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A66CC' } };
      cell.font = { name: 'Georgia', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });
    worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `security-records-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting Security to Excel:', error);
    throw new Error('Failed to export Security to Excel');
  }
}

// Export Security Records to PDF
export const exportSecurityToPDF = async (records: AttendanceRecord[], statusMap: Record<string, string>, eventTitle?: string, eventSettings?: EventSettings, recordLabel?: string, filtersText?: string) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // prepare data
    const filtered = records.filter(record => record.member)
    const data = filtered.map((record, index) => [
      index + 1,
      record.member!.fullName,
      record.member!.tanzeem,
      record.member!.region,
      record.member!.jamaat,
      statusMap[record.id] || 'In',
      new Date().toLocaleString()
    ])

  // draw centered header
  const tableStartY = await drawCenteredPDFHeader(doc, eventTitle || 'Security Movement Records', eventSettings, recordLabel, filtersText, DEFAULT_LOGO_URL)

    autoTable(doc, {
      head: [['S/N', 'Name', 'Tanzeem', 'Region', 'Jamaat', 'Current Status', 'Last Updated']],
      body: data,
      startY: tableStartY,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [102, 102, 102],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [10, 102, 204],
        lineWidth: 0.2,
        fontSize: 10,
        font: 'Georgia',
        cellPadding: 4
      },
      bodyStyles: {
        font: 'Georgia',
        lineColor: [102, 102, 102]
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249]
      },
      columnStyles: {
        0: { cellWidth: 15 }, // S/N (increased for better fit)
        1: { cellWidth: 47 }, // Name (slightly reduced)
        2: { cellWidth: 30 }, // Tanzeem
        3: { cellWidth: 35 }, // Region
        4: { cellWidth: 30 }, // Jamaat
        5: { cellWidth: 30 }, // Status
        6: { cellWidth: 35 }, // Last Updated
      },
      didDrawPage: (data) => {
        try {
          const total = filtered.length
          let rowsOnPage = 0
          if (data.table && Array.isArray((data.table as any).body)) {
            rowsOnPage = (data.table as any).body.filter((r: any) => r.pageNumber === data.pageNumber).length
          }
          if (!rowsOnPage) rowsOnPage = Math.min(total, (data.table as any).rows ? (data.table as any).rows.length : total)
          const footerY = doc.internal.pageSize.getHeight() - 10
          doc.setFontSize(10)
          doc.setTextColor(0, 0, 0)
          doc.text(`${rowsOnPage} of ${total}`, 14, footerY)
        } catch (e) { }
      }
    })

    doc.save(`security-records-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error exporting Security to PDF:', error);
    throw new Error('Failed to export Security to PDF');
  }
};

// Export Catering Records to Excel
export const exportCateringToExcel = async (records: CateringRecord[], filename?: string, eventTitle?: string, eventSettings?: EventSettings, recordLabel?: string, filtersText?: string) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Catering Records');
    const headerCols = ["A", "B", "C", "D", "E", "F", "G"];
    let currentRow = await addUnifiedExcelHeader(worksheet, headerCols, eventTitle, eventSettings, recordLabel, filtersText);
    worksheet.columns = [
      { header: 'S/N', key: 'sn', width: 6 },
      { header: 'Name', key: 'name', width: 35 },
      { header: 'Tanzeem', key: 'tanzeem', width: 20 },
      { header: 'Region', key: 'region', width: 25 },
      { header: 'Jamaat', key: 'jamaat', width: 20 },
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Meal Type', key: 'mealType', width: 18 },
    ];
    // insert header row
    const headers = ['S/N','Name','Tanzeem','Region','Jamaat','Day','Meal Type'];
    worksheet.insertRow(currentRow, headers);
    const headerRowNumber = currentRow;
    currentRow++;
    // Add data
    records.forEach((record, index) => {
      if (!record.attendanceRecord?.member) return;
      worksheet.addRow({
        sn: index + 1,
        name: record.attendanceRecord.member.fullName,
        tanzeem: record.attendanceRecord.member.tanzeem,
        region: record.attendanceRecord.member.region,
        jamaat: record.attendanceRecord.member.jamaat,
        day: record.day,
        mealType: record.mealType
      });
    });
    // style header row
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A66CC' } };
      cell.font = { name: 'Georgia', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });
    worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `catering-records-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting Catering to Excel:', error);
    throw new Error('Failed to export Catering to Excel');
  }
}

// Export Catering Records to PDF
export const exportCateringToPDF = async (records: CateringRecord[], eventTitle?: string, eventSettings?: EventSettings, recordLabel?: string, filtersText?: string) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    const filtered = records.filter(record => record.attendanceRecord?.member)
    const data = filtered.map((record, index) => [
      index + 1,
      record.attendanceRecord!.member!.fullName,
      record.attendanceRecord!.member!.tanzeem,
      record.attendanceRecord!.member!.region,
      record.attendanceRecord!.member!.jamaat,
      record.day,
      record.mealType
    ])

    // draw centered header
  const tableStartY = await drawCenteredPDFHeader(doc, eventTitle || 'Catering Records', eventSettings, recordLabel, filtersText, DEFAULT_LOGO_URL)

    // Add table
    autoTable(doc, {
      head: [['S/N', 'Name', 'Tanzeem', 'Region', 'Jamaat', 'Day', 'Meal Type']],
      body: data,
      startY: tableStartY,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [10, 102, 204] },
      columnStyles: {
        0: { cellWidth: 15 }, // S/N (increased for better fit)
        1: { cellWidth: 47 }, // Name (slightly reduced)
        2: { cellWidth: 25 }, // Tanzeem
        3: { cellWidth: 35 }, // Region
        4: { cellWidth: 30 }, // Jamaat
        5: { cellWidth: 20 }, // Day
        6: { cellWidth: 25 }, // Meal Type
      },
      didDrawPage: (data) => {
        try {
          const total = filtered.length
          let rowsOnPage = 0
          if (data.table && Array.isArray((data.table as any).body)) {
            rowsOnPage = (data.table as any).body.filter((r: any) => r.pageNumber === data.pageNumber).length
          }
          if (!rowsOnPage) rowsOnPage = Math.min(total, (data.table as any).rows ? (data.table as any).rows.length : total)
          const footerY = doc.internal.pageSize.getHeight() - 10
          doc.setFontSize(10)
          doc.setTextColor(0, 0, 0)
          doc.text(`${rowsOnPage} of ${total}`, 14, footerY)
        } catch (e) { }
      }
    })

    doc.save(`catering-records-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error exporting Catering to PDF:', error);
    throw new Error('Failed to export Catering to PDF');
  }
};

// Export main functions
export {
  generateAttendanceIDCards as generateIDCards,
  generateSingleAttendanceIDCard as generateSingleIDCard,
  exportTajneedToExcel,
  exportTajneedToPDF
}
