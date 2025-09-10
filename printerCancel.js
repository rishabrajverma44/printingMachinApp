import { exec } from "child_process";
import ipp from "ipp";
import os from "os";

class PrinterCancel {
  // ---------------- Cancel a single system job by ID ----------------
  static cancelSystemJob(jobId, printerName) {
    const platform = os.platform();

    if (!jobId) return Promise.reject(new Error("Job ID is required"));
    const id = parseInt(jobId, 10);

    if (!printerName && platform.startsWith("win")) {
      return Promise.reject(
        new Error("Windows requires a printerName to cancel a job")
      );
    }

    if (platform.startsWith("win")) {
      return new Promise((resolve, reject) => {
        const cmdCheck = `PowerShell -Command "Get-PrintJob -PrinterName '${printerName}' | Where-Object { $_.ID -eq ${id} }"`;

        exec(cmdCheck, (err, stdout) => {
          if (err) return reject(err);
          if (!stdout.trim())
            return reject(
              new Error(`Job ${jobId} not found or already processed`)
            );

          const cmdCancel = `PowerShell -Command "Get-PrintJob -PrinterName '${printerName}' | Where-Object { $_.ID -eq ${id} } | Remove-PrintJob"`;

          exec(cmdCancel, (err2) => {
            if (err2) return reject(err2);
            resolve({ success: true, jobId });
          });
        });
      });
    }

    // Linux/macOS
    if (platform === "linux" || platform === "darwin") {
      return new Promise((resolve, reject) => {
        exec(`cancel ${jobId}`, (err) => {
          if (err) return reject(err);
          resolve({ success: true, jobId });
        });
      });
    }

    return Promise.reject(new Error("Unsupported platform for canceling jobs"));
  }

  // ---------------- Cancel all system jobs ----------------
  static cancelAllSystemJobs() {
    const platform = os.platform();

    if (!platform.startsWith("win")) {
      return new Promise((resolve, reject) => {
        exec(`cancel -a`, (err) => {
          if (err) return reject(err);
          resolve({ success: true, message: "All system jobs canceled" });
        });
      });
    }

    // Windows: cancel jobs per printer safely
    return new Promise((resolve) => {
      const listPrintersCmd = `PowerShell -Command "Get-Printer | Select-Object -ExpandProperty Name"`;
      exec(listPrintersCmd, (err, stdout) => {
        if (err)
          return resolve({ success: false, message: "Cannot list printers" });

        const printers = stdout
          .split(/\r?\n/)
          .map((p) => p.trim())
          .filter(Boolean);

        if (printers.length === 0)
          return resolve({ success: true, message: "No printers found" });

        let completed = 0;
        printers.forEach((printer) => {
          const cmd = `PowerShell -Command "Get-PrintJob -PrinterName '${printer}' | Remove-PrintJob"`;
          exec(cmd, { timeout: 5000 }, (err2) => {
            completed++;
            if (completed === printers.length) {
              resolve({
                success: true,
                message: `All jobs attempted for ${printers.length} printers`,
              });
            }
          });
        });
      });
    });
  }

  // ---------------- Cancel a single IPP job ----------------
  static cancelIPPJob(printerUrl, jobId) {
    if (!printerUrl || !jobId)
      return Promise.reject(new Error("Printer URL and Job ID are required"));

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

  // ---------------- Cancel all IPP jobs ----------------
  static async cancelAllIPPJobs(ippUrls = [], timeoutMs = 5000) {
    let totalCanceled = 0;

    for (const url of ippUrls) {
      await new Promise((resolve) => {
        const printer = ipp.Printer(url);
        const msg = {
          "operation-attributes-tag": { "requested-attributes": ["job-id"] },
        };

        // wrap in timeout
        const timer = setTimeout(() => {
          console.warn(`IPP printer ${url} timed out`);
          resolve();
        }, timeoutMs);

        printer.execute("Get-Jobs", msg, (err, res) => {
          clearTimeout(timer);

          if (err) return resolve(); // skip unreachable printers

          const jobs = res["job-attributes-tag"] || [];
          if (jobs.length === 0) return resolve();

          let canceledCount = 0;
          jobs.forEach((job) => {
            const cancelMsg = {
              "operation-attributes-tag": {
                "printer-uri": url,
                "job-id": job["job-id"],
              },
            };

            printer.execute("Cancel-Job", cancelMsg, (err2) => {
              canceledCount++;
              if (canceledCount === jobs.length) {
                totalCanceled += canceledCount;
                resolve();
              }
            });
          });
        });
      });
    }

    return { success: true, message: `${totalCanceled} IPP jobs canceled` };
  }

  // ---------------- Universal cancel all (system + IPP) ----------------
  static async cancelAll(ippUrls = []) {
    const systemResult = await PrinterCancel.cancelAllSystemJobs();
    const ippResult = await PrinterCancel.cancelAllIPPJobs(ippUrls);
    return { system: systemResult, ipp: ippResult };
  }
}

export default PrinterCancel;
