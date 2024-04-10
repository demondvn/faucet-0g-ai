import axios from 'axios';
import Web3 from 'web3';
import { Solver } from '2captcha';
import fs from 'fs-extra';
import HttpsProxyAgent from 'https-proxy-agent';

const API_KEY = process.env.CAPTCHA_API_KEY+"";
const SITE_KEY = '06ee6b5b-ef03-4491-b8ea-01fb5a80256f';
const PROXY_URL = 'https://poeai.click/proxy.php/v2/?request=getproxies&protocol=socks4&timeout=1000';
const FAUCET_API_URL = 'https://faucet.0g.ai/api/faucet';
const WALLET_FILE_PATH = '0g.csv';

export let _proxy: string[] = [];

export async function fetchProxies(): Promise<void> {
  try {
    const response = await axios.get(PROXY_URL);
    const proxies = response.data.split('\n');
    _proxy.push(...proxies);
  } catch (error) {
    console.error('Failed to fetch proxies:', error);
  }
}

async function checkProxy(proxy: string): Promise<boolean> {
  try {
    const response = await axios.get('https://example.com', {
      proxy: {
        host: proxy.split(':')[0],
        port: parseInt(proxy.split(':')[1]),
      },
      timeout: 3000,
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function solveCaptcha(): Promise<string> {
  const solver = new Solver(API_KEY);
  const result = await solver.hcaptcha(SITE_KEY, 'https://faucet.0g.ai');
  return result.data;
}

async function createWallet(): Promise<{ address: string; privateKey: string }> {
  const web3 = new Web3();
  const account = web3.eth.accounts.create();
  return {
    address: account.address,
    privateKey: account.privateKey,
  };
}

async function postToFaucet(address: string, hcaptchaToken: string, proxy: string): Promise<boolean> {
  try {
    const agent =new HttpsProxyAgent.HttpsProxyAgent(`socks4://${proxy}`);
    const response = await axios.post(
      FAUCET_API_URL,
      {
        address,
        hcaptchaToken,
      },
      {
        proxy: {
          host: proxy.split(':')[0],
          port: parseInt(proxy.split(':')[1]),
        },
      }
    );
    return response.status === 200;
  } catch (error) {
    console.error('Failed to post to faucet:', error);
    return false;
  }
}

async function saveWalletToFile(wallet: { address: string; privateKey: string }): Promise<void> {
  const data = `${wallet.address},${wallet.privateKey}\n`;
  await fs.promises.appendFile(WALLET_FILE_PATH, data);
}

async function main(): Promise<void> {
  await fetchProxies();

  while (_proxy.length > 0) {
    const proxy = _proxy.shift();
    if(!proxy) continue;
    if (await checkProxy(proxy)) {
      const hcaptchaToken = await solveCaptcha();
      const wallet = await createWallet();

      if (await postToFaucet(wallet.address, hcaptchaToken, proxy)) {
        await saveWalletToFile(wallet);
        console.log('Successfully claimed faucet:', wallet.address);
      } else {
        console.log('Failed to claim faucet:', wallet.address);
      }
    } else {
      console.log('Proxy is not live:', proxy);
    }
  }
}

main().catch((error) => {
  console.error('An error occurred:', error);
});
