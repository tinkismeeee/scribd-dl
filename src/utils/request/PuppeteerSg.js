import path from "path";
import puppeteer from "puppeteer";
import { directoryIo } from "../io/DirectoryIo.js";

class PuppeteerSg {
	static buffer = 1500;

	constructor() {
		if (!PuppeteerSg.instance) {
			PuppeteerSg.instance = this;
			process.on("exit", () => {
				this.close();
			});
		}
		return PuppeteerSg.instance;
	}

	/**
	 * Launch a browser
	 */
	async launch() {
		const isCI = process.env.CI === "true"; // Detect if running in CI
		const args = [];
		if (isCI) {
			args.push("--no-sandbox", "--disable-setuid-sandbox");
		}
		this.browser = await puppeteer.launch({
			headless: "new",
			defaultViewport: null,
			args,
			timeout: 0,
			protocolTimeout: 1200000, // it works with 1200 pages
		});
	}

	/**
	 * New a page
	 */
	async getPage(url) {
		if (!this.browser) {
			await this.launch();
		}
		let page = await this.browser.newPage();
		await page.goto(url, {
			waitUntil: "domcontentloaded",
		});
		await this.injectHelperFunctions(page);
		await new Promise((resolve) => setTimeout(resolve, this.buffer));
		return page;
	}

	/**
	 * Generate PDF from the page
	 */
	async generatePDF(page, pdfPath, options = {}) {
		await directoryIo.create(path.dirname(pdfPath));
		await page.pdf({
			path: pdfPath,
			printBackground: true,
			timeout: 0,
			...options,
		});
	}

	/**
	 * Close the browser
	 */
	async close() {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}

	/**
	 * Inject helper functions into the page context
	 */
	async injectHelperFunctions(page) {
		const browserHelpers = `
      window.__helpers__ = {
        lazyLoad: async (selector = null, rendertime = 1400) => {
  await new Promise(resolve => {
    const container = selector ? document.querySelector(selector) : null;
    if (selector && !container) {
      return resolve();
    }

    let prevScroll = -1;

    const timer = setInterval(() => {
      if (container) {
        container.scrollTop += container.clientHeight;

        if (container.scrollTop === prevScroll) {
          clearInterval(timer);
          resolve();
          return;
        }

        prevScroll = container.scrollTop;
      } else {
        window.scrollBy(0, window.innerHeight * 0.8);

        const currentScroll = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

        if (currentScroll === prevScroll || currentScroll >= maxScroll) {
          clearInterval(timer);
          resolve();
          return;
        }

        prevScroll = currentScroll;
      }
    }, rendertime);
  });
},
        hideSelectorAll: (selector) => {
          document.querySelectorAll(selector).forEach(el => el.style.display = 'none');
        },
        showSelectorAll: (selector) => {
          document.querySelectorAll(selector).forEach(el => el.style.display = 'block');
        },
        removeSelectorAll: (selector) => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        },
        removeMarginSelectorAll: (selector) => {
          document.querySelectorAll(selector).forEach(el => el.style.margin = '0');
        },
        timeout: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
      };
    `;
		await page.evaluate(browserHelpers);
	}
}

export const puppeteerSg = new PuppeteerSg();
