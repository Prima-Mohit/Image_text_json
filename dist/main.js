"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const Tesseract = __importStar(require("tesseract.js"));
async function extractTextFromImage(imagePath) {
    const result = await Tesseract.recognize(imagePath, 'eng');
    return result.data.text;
}
function parseInvoiceData(extractedText) {
    const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line);
    const organization = {
        name: lines[0]?.split(' ').slice(0, 2).join(' ') || '',
        address: lines.slice(1, 4).filter(line => !line.toLowerCase().includes('phone')).join(', ') || '',
        phone: (lines.find(line => line.includes('Phone')) || '').split(':')[1]?.replace(/\D/g, '') || '',
    };
    const customerIndex = lines.findIndex(line => line.includes('M/s'));
    const customer = {
        name: lines[customerIndex]?.match(/(?:M\/s|M\/r|Mr)\s*(.*)/)?.[1]?.trim() || '',
        address: lines[customerIndex + 1]?.split(',')[2]?.trim() || '',
        phone: (lines.find(line => line.includes('Ph.No.')) || '').match(/Ph\.No\.\s*:\s*(\d+)/)?.[1] || '',
    };
    const products = [];
    const productStartIndex = lines.findIndex(line => line.includes('Sn.')) + 1;
    let serialNumber = 1;
    for (let i = productStartIndex; i < lines.length; i++) {
        const line = lines[i];
        console.log('Processing line:', line); // Debugging log
        if (!line.match(/\d/) || !(line.length > 25))
            continue; // Skip lines without digits
        // Clean up the line: remove unwanted special characters and extra spaces
        let cleanedLine = line
            .replace(/[^\w\s.]/g, ' ') // Remove non-alphanumeric characters except periods and spaces
            .replace(/\b[a-zA-Z]\b/g, '') // Remove single characters
            .replace(/\b\d+[*/]\d+\b/g, '') // Remove words like x*y or x/y
            .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
            .trim();
        // Debugging log for cleaned line
        console.log('this is cleanline ', cleanedLine);
        // Split the cleaned line into parts
        const parts = cleanedLine.split(/[\s|,]+/);
        console.log('Parts:', parts); // Debugging log for split parts
        // Serial Number
        const currentSerialNumber = serialNumber++;
        // Quantity (always second value)
        const quantity = parseInt(parts[1]) || null;
        // MRP (always third value)
        const mrp = parseFloat(parts[2] || '0');
        // Product Name (extracted until numeric or HSN)
        let productName = '';
        let idx = 3;
        while (idx < parts.length && isNaN(parseFloat(parts[idx])) && !/^3\d{3,}/.test(parts[idx])) {
            productName += parts[idx] + ' ';
            idx++;
        }
        productName = productName.trim();
        // Remove fractions from product name (like 10.00)
        productName = productName.replace(/\d+\.\d{2}/g, '').trim();
        // Pack (if product contains GM or ML)
        // Pack: should be a two-letter code followed by a number (e.g., 25GM, 78KG)
        // Rate (next numeric value)
        const ratePattern = /^\d+\.\d{2}$/; // Regular expression to match numbers with two decimal points
        // Loop until a valid rate (number with two decimals) is found
        let rate = 0;
        while (idx < parts.length && !ratePattern.test(parts[idx])) {
            idx++; // Skip the current part
        }
        // If a valid rate is found, parse it
        if (idx < parts.length && ratePattern.test(parts[idx])) {
            rate = parseFloat(parts[idx]); // Parse the rate
            idx++; // Move to the next part after the rate
        }
        // HSN (starts with '3' and > 3000)
        let hsn = '';
        // Loop until an HSN code greater than or equal to 3000 is found
        while (idx < parts.length && (!/^3\d{3,}/.test(parts[idx]) || parseInt(parts[idx]) < 3000)) {
            idx++; // Skip the current part
        }
        // If a valid HSN code is found, assign it and move to the next part
        if (idx < parts.length && /^3\d{3,}/.test(parts[idx]) && parseInt(parts[idx]) >= 3000) {
            hsn = parts[idx]; // Assign the HSN code
            idx++; // Move to the next part after the HSN code
        }
        //pack
        let pack = null;
        while (idx < parts.length && !/(\d+)([A-Za-z]{2})/i.test(parts[idx])) {
            idx++; // Skip until we find the pack format
        }
        // If a valid pack is found, assign it
        if (idx < parts.length && /(\d+)([A-Za-z]{2})/i.test(parts[idx])) {
            pack = parts[idx]; // Assign the pack code (e.g., 25GM, 78KG)
            idx++; // Move to the next part after the pack code
        }
        // Batch (next value)
        let batch = null;
        while (idx < parts.length && !/^[A-Za-z]\d$/.test(parts[idx])) {
            idx++; // Skip until a valid batch format is found
        }
        // If a valid batch is found, assign it
        if (idx < parts.length && /^[A-Za-z]\d$/.test(parts[idx])) {
            batch = parts[idx]; // Assign the batch code
            idx++; // Move to the next part after the batch code
        }
        // Extract last four values as Discount, SGST, CGST, and Amount
        const discount = parseFloat(parts[parts.length - 4] || '0');
        const sgst = parseFloat(parts[parts.length - 3] || '0');
        const cgst = parseFloat(parts[parts.length - 2] || '0');
        const amount = parseFloat(parts[parts.length - 1] || '0');
        products.push({
            serialNumber: currentSerialNumber,
            quantity,
            mrp,
            productName,
            rate,
            hsn,
            pack,
            batch,
            discount,
            sgst,
            cgst,
            amount,
        });
    }
    const grandTotal = products.reduce((total, product) => total + product.amount, 0);
    return {
        organization,
        customer,
        products,
        grandTotal,
    };
}
(async () => {
    const imagePath = './billphoto2.png';
    console.log('Extracting text from image...');
    const extractedText = await extractTextFromImage(imagePath);
    console.log(extractedText);
    console.log('Parsing text into structured JSON...');
    const invoiceJSON = parseInvoiceData(extractedText);
    console.log('Structured JSON:', JSON.stringify(invoiceJSON, null, 2));
})();
