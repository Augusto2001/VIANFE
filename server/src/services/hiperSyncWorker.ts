import fs from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { integrationVaultService } from './integrationVaultService.js';
import { sefazService } from './sefazService.js';
import { db } from '../database/db.js';

function getChromeExecutablePath(): string {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  // Linux container
  if (fs.existsSync('/usr/bin/chromium')) {
    return '/usr/bin/chromium';
  }
  if (fs.existsSync('/usr/bin/google-chrome')) {
    return '/usr/bin/google-chrome';
  }
  // Windows host
  const winChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(winChrome)) {
    return winChrome;
  }
  const winChromeX86 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(winChromeX86)) {
    return winChromeX86;
  }
  throw new Error('Navegador Chromium / Chrome não encontrado para o robô headless.');
}

export class HiperSyncWorker {
  private portalUrl = 'https://contador.hiper.com.br';

  /**
   * Testa a autenticação do robô no portal Hiper Contador
   */
  public async testAuthentication(): Promise<{ success: boolean; message: string; clientsCount?: number }> {
    const cred = integrationVaultService.getCredential('hiper');
    if (!cred) {
      return { success: false, message: 'Nenhuma credencial do Hiper Contador configurada no cofre.' };
    }

    let browser: Browser | null = null;
    try {
      const execPath = getChromeExecutablePath();
      browser = await puppeteer.launch({
        executablePath: execPath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(this.portalUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Esperar inputs de login do Hiper SPA
      await page.waitForSelector('input[type="email"], input[type="text"], input[name="login"]', { timeout: 15000 });

      const emailSelector = 'input[type="email"], input[name="email"], input[type="text"]';
      const passSelector = 'input[type="password"]';

      await page.type(emailSelector, cred.username, { delay: 30 });
      await page.type(passSelector, cred.password, { delay: 30 });

      // Clicar no botão entrar
      const submitBtn = await page.$('button[type="submit"], button:has-text("Entrar")');
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      // Aguarda navegação ou resposta de erro
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || (await page.$('.error, .alert-danger, [role="alert"]'))) {
        const errorText = await page.evaluate(() => {
          const el = document.querySelector('.error, .alert-danger, [role="alert"]');
          return el ? el.textContent?.trim() : 'Falha na autenticação';
        });
        integrationVaultService.recordSyncResult(cred.id, false, errorText || 'Credenciais inválidas');
        return { success: false, message: `Erro ao logar no Hiper: ${errorText}` };
      }

      // Sucesso no login
      integrationVaultService.recordSyncResult(cred.id, true, 'Autenticação realizada com sucesso');
      return { success: true, message: 'Login no Hiper Contador autenticado com sucesso!' };
    } catch (err: any) {
      if (cred) integrationVaultService.recordSyncResult(cred.id, false, err.message);
      return { success: false, message: `Exceção durante conexão com Hiper: ${err.message}` };
    } finally {
      if (browser) await browser.close();
    }
  }
}

export const hiperSyncWorker = new HiperSyncWorker();
