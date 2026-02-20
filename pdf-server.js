import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";

const app = express();

/* =========================================================
   CONFIG
   ========================================================= */

const PORT = 5052;
const HEADER_HEIGHT = 80;

let browser; // reuse browser instance

/* =========================================================
   LAUNCH BROWSER ON START (faster + stable)
   ========================================================= */

(async () => {
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        });

        console.log("✅ Puppeteer browser launched");
    } catch (err) {
        console.error("❌ Failed to launch browser:", err);
    }
})();

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json());

app.get("/", (req, res) => {
    res.send("PDF server running (Puppeteer) ✅");
});

/* =========================================================
   PDF ROUTE
   ========================================================= */

app.post("/api/generate-pdf", async (req, res) => {
    let page;

    try {
        const { url, proposalCode, clientName } = req.body;

        if (!url) {
            return res.status(400).json({ error: "URL required" });
        }

        if (!browser) {
            return res.status(500).json({ error: "Browser not ready" });
        }

        console.log("Generating PDF for:", url);

        /* ===============================
           Create Page
        =============================== */

        page = await browser.newPage();

        /* ===============================
           Load Page
        =============================== */

        await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 60000,
        });

        // ensure page fully rendered
        await page.waitForSelector("body");
        await page.emulateMediaType("print");

        // wait for fonts/images
        await new Promise((resolve) => setTimeout(resolve, 2000));

        /* ===============================
           Generate PDF
        =============================== */

        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,

            /* ---------- HEADER ---------- */
            headerTemplate: `
        <div style="
          width:100%;
          height:${HEADER_HEIGHT}px;
          padding:20px;
          box-sizing:border-box;
          font-size:10px;
          font-family: Arial, sans-serif;
        ">
          <div style="font-size:14px; font-weight:bold;">
            Proposal code: ${proposalCode || ""} - ${clientName || ""}
          </div>
        </div>
      `,

            /* ---------- FOOTER ---------- */
            footerTemplate: `
        <div style="
          width:100%;
          font-size:8px;
          text-align:center;
          padding:5px;
        ">
          Page <span class="pageNumber"></span> of
          <span class="totalPages"></span>
        </div>
      `,

            margin: {
                top: `${HEADER_HEIGHT}px`,
                bottom: "20px",
                left: "20px",
                right: "20px",
            },
        });

        console.log("PDF size:", pdf.length);

        if (!pdf || pdf.length === 0) {
            throw new Error("Generated PDF is empty");
        }

        /* ===============================
           Send PDF (CORRECT WAY)
        =============================== */

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=proposal.pdf",
            "Content-Length": pdf.length,
        });

        res.end(pdf); // prevents corruption
    } catch (err) {
        console.error("PDF generation error:", err);
        res.status(500).json({ error: "PDF generation failed" });
    } finally {
        if (page) await page.close();
    }
});

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, () => {
    console.log(`PDF server running → http://localhost:${PORT}`);
});