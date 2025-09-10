import { writeFileSync, unlinkSync } from "fs";
import printer from "pdf-to-printer";
import ipp from "ipp";
import { execSync } from "child_process";
import os from "os";

//Print PDF via OS-installed printer
export async function printPDF(pdfBuffer, printerName) {
  const tempPath = `temp_${Date.now()}.pdf`;
  writeFileSync(tempPath, pdfBuffer);

  try {
    await printer.print(tempPath, { printer: printerName });
    console.log("✅ PDF printed:", tempPath);
  } catch (err) {
    console.error("PDF print error:", err);
    throw err;
  } finally {
    unlinkSync(tempPath);
  }
}

// Print PDF via IPP printer
export async function printPDFIPP(printerURL, pdfBuffer) {
  return new Promise((resolve, reject) => {
    const printerIpp = ipp.Printer(printerURL);
    const msg = {
      "operation-attributes-tag": {
        "requesting-user-name": "NodeJS",
        "job-name": "Print PDF",
      },
      data: pdfBuffer,
    };

    printerIpp.execute("Print-Job", msg, (err, res) => {
      if (err) {
        console.error("IPP print error:", err);
        return reject(err);
      }
      console.log("✅ IPP print job sent:", res);
      resolve(res);
    });
  });
}

//Get OS print queue jobs
export function getOSPrintQueue(printerName) {
  try {
    if (os.platform() === "win32") {
      const output = execSync(
        `powershell -Command "Get-PrintJob -PrinterName '${printerName}' | Select-Object JobStatus | ConvertTo-Json"`
      ).toString();
      const jobs = JSON.parse(output);
      return Array.isArray(jobs) ? jobs : jobs ? [jobs] : [];
    } else {
      const output = execSync(`lpstat -o "${printerName}"`).toString();
      return output.split("\n").filter(Boolean);
    }
  } catch (err) {
    return [];
  }
}

// Get IPP printer queue
export async function getIPPQueue(printerURL) {
  return new Promise((resolve, reject) => {
    const printerIpp = ipp.Printer(printerURL);
    printerIpp.execute(
      "Get-Jobs",
      { "requesting-user-name": "NodeJS" },
      (err, res) => {
        if (err) return reject(err);
        const jobs = res["job-attributes-tag"];
        resolve(jobs ? (Array.isArray(jobs) ? jobs : [jobs]) : []);
      }
    );
  });
}
