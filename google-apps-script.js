/**
 * =====================================================================
 * NewAge I.T. - Google Apps Script Database Integration
 * =====================================================================
 * This script turns your Google Sheet into a real-time REST API for:
 * 1. Tracking Repairs (Reads from "Repairs" sheet)
 * 2. Saving Contact Form Inquiries (Appends to "Inquiries" sheet)
 *
 * HOW TO SET UP (Takes 2 minutes):
 * 1. Go to https://sheets.new to create a new Google Sheet.
 * 2. Name your Google Sheet: "NewAge IT Database"
 * 3. In the top menu, click Extensions -> Apps Script.
 * 4. Delete any code in the editor, paste this entire script, and click Save (Floppy icon).
 * 5. Run the function "setupSheets" once by selecting it from the dropdown and clicking "Run".
 *    (Review and grant Google permissions when prompted. This creates the tabs and headers automatically!)
 * 6. Click "Deploy" (top right) -> "New deployment".
 * 7. Select type: "Web app".
 * 8. Set:
 *    - Description: "NewAge IT API"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (CRITICAL: Must be "Anyone" so your website can query/submit!)
 * 9. Click "Deploy" and copy the Web App URL (e.g. https://script.google.com/macros/s/.../exec).
 * 10. Paste this URL into your website's database setting or script.js GOOGLE_SHEET_API_URL!
 * =====================================================================
 */

// 1. One-click initialization function
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Setup Inquiries sheet
  let inqSheet = ss.getSheetByName('Inquiries');
  if (!inqSheet) {
    inqSheet = ss.insertSheet('Inquiries');
  }
  const inqHeaders = ['Timestamp', 'Ticket ID', 'Name', 'Phone', 'Email', 'Service', 'Message', 'Status'];
  inqSheet.getRange(1, 1, 1, inqHeaders.length).setValues([inqHeaders]);
  inqSheet.getRange(1, 1, 1, inqHeaders.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');

  // Setup Repairs sheet
  let repSheet = ss.getSheetByName('Repairs');
  if (!repSheet) {
    repSheet = ss.insertSheet('Repairs');
  }
  const repHeaders = [
    'Ticket ID', 
    'Customer Name', 
    'Phone', 
    'Device & Model', 
    'Reported Issue', 
    'Status Stage (1-8)', 
    'Status Label', 
    'Date Received', 
    'Estimated Delivery', 
    'Estimated Cost', 
    'Technician Notes'
  ];
  repSheet.getRange(1, 1, 1, repHeaders.length).setValues([repHeaders]);
  repSheet.getRange(1, 1, 1, repHeaders.length).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');

  // Seed sample repair rows matching the System Summary PDF lifecycle
  if (repSheet.getLastRow() <= 1) {
    const sampleRepairs = [
      [
        'NA-1001',
        'Bikash Sharma',
        '9841301930',
        'Dell Inspiron 15 Gaming Laptop',
        'Power on failure / Motherboard short circuit',
        5,
        'Repairing',
        '2026-09-06',
        '2026-09-10',
        'NPR 3,500',
        'Replacing power management IC and charging capacitors. Cleaned cooling fans and applied Arctic MX-4 thermal paste.'
      ],
      [
        'NA-1002',
        'Pooja Shrestha',
        '9801234567',
        'Apple MacBook Air M1',
        'Cracked display / Screen lines',
        7,
        'Ready for Pickup',
        '2026-09-05',
        '2026-09-08',
        'NPR 18,000',
        'Original Retina display replaced and tested. Ready for collection with warranty slip.'
      ],
      [
        'NA-1003',
        'Aayush Thapa',
        '9812345678',
        'HP LaserJet Pro MFP Printer',
        'Paper jam error & faded printout',
        2,
        'Diagnosis',
        '2026-09-07',
        '2026-09-11',
        'NPR 1,800',
        'Inspecting pickup roller and laser scanner unit. Cleaning optical sensors.'
      ],
      [
        'NA-1004',
        'Suman Adhikari',
        '9841000000',
        'Sony Bravia 55" 4K Smart TV',
        'Sound working but no display / black screen',
        3,
        'Quotation',
        '2026-09-08',
        '2026-09-12',
        'NPR 4,200',
        'LED backlight strip open-circuit. Quotation prepared for customer approval.'
      ]
    ];
    repSheet.getRange(2, 1, sampleRepairs.length, repHeaders.length).setValues(sampleRepairs);
  }

  Logger.log('Sheets initialized successfully with headers and sample records!');
}

// 2. Handle GET Requests (Read / Track Repairs)
function doGet(e) {
  const query = (e.parameter.query || e.parameter.ticket || '').trim().toUpperCase();
  const phone = (e.parameter.phone || '').trim();
  const action = e.parameter.action || 'track';

  if (action === 'track' && (query || phone)) {
    const record = findRepairRecord(query, phone);
    if (record) {
      return jsonResponse({ success: true, found: true, data: record });
    } else {
      return jsonResponse({ success: true, found: false, message: 'No repair ticket matching this ID or phone number was found.' });
    }
  }

  // Default health check response
  return jsonResponse({
    success: true,
    message: 'NewAge I.T. Google Sheets API is online and operational.',
    version: '1.0'
  });
}

// 3. Handle POST Requests (Create Inquiries or Repairs)
function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else {
      payload = e.parameter || {};
    }

    const action = payload.action || 'inquiry';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'inquiry') {
      let inqSheet = ss.getSheetByName('Inquiries');
      if (!inqSheet) {
        setupSheets();
        inqSheet = ss.getSheetByName('Inquiries');
      }

      const ticketId = payload.ticketId || ('NA-' + Math.floor(1000 + Math.random() * 9000));
      const rowData = [
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }),
        ticketId,
        payload.name || payload.senderName || '',
        payload.phone || payload.senderPhone || '',
        payload.email || payload.senderEmail || '',
        payload.service || payload.serviceType || '',
        payload.message || payload.messageText || '',
        'New'
      ];

      inqSheet.appendRow(rowData);

      return jsonResponse({
        success: true,
        message: 'Inquiry received and recorded in Google Sheet.',
        ticketId: ticketId
      });
    }

    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// Helper: Find repair record by Ticket ID or Phone
function findRepairRecord(query, phone) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const repSheet = ss.getSheetByName('Repairs');
  if (!repSheet) return null;

  const data = repSheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const ticketId = String(row[0]).trim().toUpperCase();
    const customerPhone = String(row[2]).trim().replace(/\D/g, '');
    const cleanQuery = query.replace(/\D/g, '');

    // Match by Ticket ID or Phone Number
    const ticketMatch = query && ticketId === query;
    const phoneMatch = cleanQuery.length >= 7 && customerPhone.includes(cleanQuery);

    if (ticketMatch || phoneMatch) {
      return {
        ticketId: row[0],
        customerName: row[1],
        phone: row[2],
        device: row[3],
        issue: row[4],
        stage: Number(row[5]) || 1, // 1: Received, 2: Diagnosing, 3: In Repair, 4: Quality Testing, 5: Ready for Pickup
        statusLabel: row[6] || 'In Progress',
        dateReceived: row[7],
        estimatedDelivery: row[8],
        cost: row[9],
        technicianNotes: row[10]
      };
    }
  }

  return null;
}

// Helper: JSON CORS response
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
