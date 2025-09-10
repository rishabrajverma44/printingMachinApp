import { printPDF, printPDFIPP } from "./printerService.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

class PrintManager {
  async addJob(pdfUrl, printer) {
    const id = uuidv4();
    const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
    const pdfBuffer = response.data;

    try {
      if (printer.type === "OS") {
        await printPDF(pdfBuffer, printer.name);
      } else if (printer.type === "IPP") {
        await printPDFIPP(printer.url, pdfBuffer);
      }
      return { id, status: "success" };
    } catch (err) {
      console.error("Print job failed:", err);
      return { id, status: "failed", error: err.message };
    }
  }
}

export const printManager = new PrintManager();
