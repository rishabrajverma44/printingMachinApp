import express from "express";
import { discoverAllPrinters } from "./printerDiscovery.js";
import { printManager } from "./PrintManager.js";
import PrinterQueue from "./printerQueue.js";
import PrinterCancel from "./printerCancel.js";

const app = express();
app.use(express.json());

// Get all printers
app.get("/printers", async (req, res) => {
  try {
    const printers = await discoverAllPrinters();
    res.json(printers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch printers" });
  }
});

// Add a PDF print job
app.post("/print/pdf", async (req, res) => {
  let { pdfUrl, printer } = req.body;

  if (req.body === undefined || !pdfUrl || !printer)
    return res.status(400).json({ error: "pdfUrl & printer required" });

  if (typeof printer === "string") {
    printer = { type: "OS", name: printer };
  }

  try {
    const jobId = await printManager.addJob(pdfUrl, printer);
    res.json({ success: true, jobId, message: "PDF added to print queue" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Print failed" });
  }
});

//get queue process from syatem
app.get("/printer/queue", async (req, res) => {
  try {
    const { type, name, url } = req.query;

    let jobs = {};

    if (!type) {
      // If no type specified return both
      jobs.OS = await PrinterQueue.getSystemQueue(name).catch(() => []);
      if (url) {
        jobs.IPP = await PrinterQueue.getIPPQueue(url).catch(() => []);
      }
    } else if (type === "OS") {
      jobs = await PrinterQueue.getSystemQueue(name);
    } else if (type === "IPP") {
      jobs = await PrinterQueue.getIPPQueue(url);
    }

    res.json({ status: "ok", jobs });
  } catch (err) {
    console.error("Queue error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Cancel job
app.post("/printer/cancel", async (req, res) => {
  try {
    const { type = "OS", jobId, name, url } = req.body;
    let result;
    if (type === "OS") {
      result = await PrinterCancel.cancelSystemJob(jobId, name);
    } else if (type === "IPP") {
      result = await PrinterCancel.cancelIPPJob(url, jobId);
    } else {
      return res.status(400).json({ status: "error", message: "Invalid type" });
    }

    res.json({ status: "ok", result });
  } catch (err) {
    console.error("Cancel error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.listen(3300, () => console.log("🖨️ Printer API running on port 3300"));
