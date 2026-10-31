import fs from 'fs';
import puppeteer, { Browser } from 'puppeteer-core';
import { integrationVaultService } from './integrationVaultService.js';
import { sefazService } from './sefazService.js';
import { db } from '../database/db.js';

function getChromeExecutablePath(): string {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  if (fs.existsSync('/usr/bin/chromium')) {
    return '/usr/bin/chromium';
  }
  if (fs.existsSync('/usr/bin/google-chrome')) {
    return '/usr/bin/google-chrome';
  }
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

export class ContaAzulWorker {
  private portalUrl = 'https://app.contaazul.com';

  /**
   * Testa a autenticação do robô no portal Conta Azul / Conta Azul Mais
   */
  public async testAuthentication(): Promise<{ success: boolean; message: string }> {
    const cred = integrationVaultService.getCredential('conta_azul');
    if (!cred) {
      return { success: false, message: 'Nenhuma credencial do Conta Azul configurada no cofre.' };
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
      await page.goto(this.portalUrl, { waitUntil: 'networkidle2', timeout: 35000 });

      // Esperar inputs de login do Conta Azul
      await page.waitForSelector('input[type="email"], input[name="username"], input[name="email"]', { timeout: 20000 });

      const emailSelector = 'input[type="email"], input[name="username"], input[name="email"]';
      const passSelector = 'input[type="password"]';

      await page.type(emailSelector, cred.username, { delay: 30 });
      await page.type(passSelector, cred.password, { delay: 30 });

      // Clicar no botão entrar
      const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => null);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/auth') || (await page.$('.error-message, .alert-danger, [role="alert"]'))) {
        const errorText = await page.evaluate(() => {
          const el = document.querySelector('.error-message, .alert-danger, [role="alert"]');
          return el ? el.textContent?.trim() : 'Falha na autenticação';
        });
        integrationVaultService.recordSyncResult(cred.id, false, errorText || 'Credenciais inválidas');
        return { success: false, message: `Erro ao logar no Conta Azul: ${errorText}` };
      }

      integrationVaultService.recordSyncResult(cred.id, true, 'Autenticação realizada com sucesso');
      return { success: true, message: 'Login no Conta Azul autenticado com sucesso!' };
    } catch (err: any) {
      if (cred) integrationVaultService.recordSyncResult(cred.id, false, err.message);
      return { success: false, message: `Exceção durante conexão com Conta Azul: ${err.message}` };
    } finally {
      if (browser) await browser.close();
    }
  }
}

export const contaAzulWorker = new ContaAzulWorker();
