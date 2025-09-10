import { exec } from "child_process";
import ipp from "ipp";
import os from "os";

class PrinterQueue {
  // Get print queue for local OS printers
  static async getSystemQueue(printerName = "") {
    const platform = os.platform();
    console.log(platform);
    if (platform.startsWith("win")) {
      return PrinterQueue.getWindowsQueue(printerName);
    } else if (platform === "linux" || platform === "darwin") {
      return PrinterQueue.getCUPSQueue();
    } else {
      throw new Error("Unsupported platform for system queue");
    }
  }

  //Get Windows print queue using wmic
  static getWindowsQueue(printerName) {
    return new Promise((resolve, reject) => {
      const cmd = printerName
        ? `wmic printjob where "Name like '%${printerName}%'" get Document,JobId,Status /format:csv`
        : `wmic printjob get Document,JobId,Status /format:csv`;

      exec(cmd, (err, stdout) => {
        if (err) return reject(err);

        const lines = stdout
          .split("\n")
          .filter((l) => l.trim() && !l.includes("Node"));
        const jobs = lines.map((line) => {
          const parts = line.trim().split(",");
          // CSV format: Node,Document,JobId,Status
          return {
            document: parts[1],
            jobId: parts[2],
            status: parts[3],
          };
        });

        resolve(jobs);
      });
    });
  }

  //Get Linux/macOS queue using lpstat (CUPS)
  static getCUPSQueue() {
    return new Promise((resolve, reject) => {
      exec("lpstat -o", (err, stdout) => {
        if (err) return reject(err);
        const jobs = stdout
          .split("\n")
          .filter(Boolean)
          .map((line) => line.trim());
        resolve(jobs);
      });
    });
  }

  //Get queue from an IPP printer (network printer)
  static getIPPQueue(printerUrl) {
    return new Promise((resolve, reject) => {
      const printer = ipp.Printer(printerUrl);
      const msg = {
        "operation-attributes-tag": {
          "requested-attributes": ["job-id", "job-state", "job-name"],
        },
      };

      printer.execute("Get-Jobs", msg, (err, res) => {
        if (err) return reject(err);
        resolve(res["job-attributes-tag"]);
      });
    });
  }
}

export default PrinterQueue;
