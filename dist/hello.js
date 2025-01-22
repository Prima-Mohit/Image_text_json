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
        address: lines[1]?.split(' ').slice(0, 2).join(' ') || '',
        phone: (lines.find(line => line.includes('Phone')) || '').split(':')[1]?.replace(/\D/g, '') || '',
    };
    const customerIndex = lines.findIndex(line => line.includes('M/s'));
    const customer = {
        name: lines[customerIndex]?.split('M/s').pop()?.trim() || '',
        address: lines[customerIndex + 1]?.split(',')[2]?.trim() || '',
        phone: (lines.find(line => line.includes('Ph.No.')) || '').match(/Ph\.No\.\s*:\s*(\d+)/)?.[1] || '',
    };
    const products = [];
    const productStartIndex = lines.findIndex(line => line.includes('Sn.')) + 1;
    let serialNumber = 1;
    for (let i = productStartIndex; i < lines.length; i++) {
        const line = lines[i];
        console.log('Processing line:', line); // Debugging log
        if (!line.match(/\d/))
            continue; // Skip lines without digits
        // Clean up the line: remove unwanted special characters and extra spaces
        let cleanedLine = line.replace(/[^\w\s.\|,]/g, '').trim(); // Remove non-alphanumeric characters except space, dot, and comma
        cleanedLine = cleanedLine.replace(/(\d+[\/*]\d+)/g, ''); // Remove fractions like 1/4 or 1*3
        console.log('Cleaned Line:', cleanedLine); // Debugging log for cleaned line
        // Split the cleaned line into parts
        const parts = cleanedLine.split(/[\s|,]+/);
        console.log('Parts:', parts); // Debugging log for split parts
        // Serial Number
        const currentSerialNumber = serialNumber++;
        // Quantity (always second value)
        const quantity = parseInt(parts[1]) || 0;
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
        let pack = '';
        if (/(\d+)(GM|ML)/i.test(productName)) {
            pack = productName.match(/(\d+)(GM|ML)/i)?.[0] || '';
            productName = productName.replace(/(\d+)(GM|ML)/i, '').trim(); // Remove pack value from product name
        }
        // Rate (next numeric value)
        const rate = parseFloat(parts[idx] || '0');
        idx++;
        // HSN (starts with '3' and > 3000)
        let hsn = '';
        if (idx < parts.length && /^3\d{3,}/.test(parts[idx]) && parseInt(parts[idx]) > 3000) {
            hsn = parts[idx];
            idx++;
        }
        // Batch (next value)
        const batch = parts[idx] || '';
        idx++;
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
    return {
        organization,
        customer,
        products,
    };
}
(async () => {
    const imagePath = './bill.png';
    console.log('Extracting text from image...');
    const extractedText = await extractTextFromImage(imagePath);
    console.log('Extracted Text:', extractedText);
    console.log('Parsing text into structured JSON...');
    const invoiceJSON = parseInvoiceData(extractedText);
    console.log('Structured JSON:', JSON.stringify(invoiceJSON, null, 2));
})();
