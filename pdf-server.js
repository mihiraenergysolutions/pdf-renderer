import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";

const app = express();

/* =========================================================
   CONFIG
   ========================================================= */

const PORT = 5052;
const HEADER_HEIGHT = 80;

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
    let browser;

    try {
        const { url, proposalCode, clientName } = req.body;

        if (!url) {
            return res.status(400).json({ error: "URL required" });
        }

        console.log("Generating PDF for:", url);

        /* ===============================
           Launch Browser (Render Safe)
        =============================== */

        browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        });

        const page = await browser.newPage();

        /* ===============================
           Load Page
        =============================== */

        await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 60000,
        });

        // wait for fonts/images
        await new Promise((resolve) => setTimeout(resolve, 2000));

        /* ===============================
           Generate PDF
        =============================== */

        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,

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

        /* ===============================
           Send PDF
        =============================== */

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=proposal.pdf"
        );

        res.send(pdf);
    } catch (err) {
        console.error("PDF generation error:", err);
        res.status(500).json({ error: "PDF generation failed" });
    } finally {
        if (browser) await browser.close();
    }
});

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, () => {
    console.log(`PDF server running → http://localhost:${PORT}`);
});