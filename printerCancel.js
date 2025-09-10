import { exec } from "child_process";
import ipp from "ipp";
import os from "os";

class PrinterCancel {
  // Cancel a job from system printers (Windows / Linux / macOS)
  static async cancelSystemJob(jobId, printerName = "") {
    const platform = os.platform();
    console.log(platform);
    if (platform.startsWith("win")) {
      return PrinterCancel.cancelWindowsJob(jobId, printerName);
    } else if (platform === "linux" || platform === "darwin") {
      return PrinterCancel.cancelCUPSJob(jobId);
    } else {
      throw new Error("Unsupported platform for cancelling jobs");
    }
  }

  // Windows cancel job using PowerShell
  static cancelWindowsJob(jobId, printerName) {
    return new Promise((resolve, reject) => {
      const cmd = printerName
        ? `PowerShell -Command "Get-PrintJob -PrinterName '${printerName}' -ID ${jobId} | Remove-PrintJob"`
        : `PowerShell -Command "Get-PrintJob -ID ${jobId} | Remove-PrintJob"`;

      exec(cmd, (err) => {
        if (err) return reject(err);
        resolve({ success: true, jobId });
      });
    });
  }

  // Linux/macOS cancel job using `cancel`
  static cancelCUPSJob(jobId) {
    return new Promise((resolve, reject) => {
      exec(`cancel ${jobId}`, (err) => {
        if (err) return reject(err);
        resolve({ success: true, jobId });
      });
    });
  }

  //  Cancel job from IPP printer
  static cancelIPPJob(printerUrl, jobId) {
    return new Promise((resolve, reject) => {
      const printer = ipp.Printer(printerUrl);
      const msg = {
        "operation-attributes-tag": {
          "printer-uri": printerUrl,
          "job-id": parseInt(jobId, 10),
        },
      };

      printer.execute("Cancel-Job", msg, (err) => {
        if (err) return reject(err);
        resolve({ success: true, jobId });
      });
    });
  }
}

export default PrinterCancel;
