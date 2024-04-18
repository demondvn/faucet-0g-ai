#!/usr/bin/env node
import axios from 'axios';
import Web3 from 'web3';
import { Solver } from '2captcha';
import fs from 'fs-extra';
import {HttpsProxyAgent} from 'https-proxy-agent';
import { faker } from '@faker-js/faker';
require('dotenv').config();
import { SocksProxyAgent } from 'socks-proxy-agent';


const API_KEY = process.env.CAPTCHA_API_KEY + "";
const SITE_KEY = '06ee6b5b-ef03-4491-b8ea-01fb5a80256f';
// const PROXY_URL = 'https://poeai.click/proxy.php/v2/?request=getproxies&protocol=socks4&timeout=1000';
const FAUCET_API_URL = 'https://faucet.0g.ai/api/faucet';
const WALLET_FILE_PATH = '0g.csv';

export let _proxy: string[] = [];

export async function fetchProxies(): Promise<void> {
  try {
    // const response = await axios.get(PROXY_URL);
    if(!fs.existsSync(process.cwd()+'/proxy.txt')){
      fs.createFileSync(process.cwd()+'/proxy.txt');
    }
    const data = fs.readFileSync(process.cwd()+'/proxy.txt', 'utf8');
    const proxies = data.split('\n');
    _proxy.push(...proxies);
  } catch (error) {
    console.error('Failed to fetch proxies:', error);
  }
  console.log(process.cwd(),'Proxies:', _proxy);
}


async function solveCaptcha(): Promise<string> {
  const solver = new Solver(API_KEY);
  const result = await solver.hcaptcha(SITE_KEY, 'https://faucet.0g.ai');
  console.log('Captcha solved:', result.data);
  return result.data;
}

async function createWallet(): Promise<{ address: string; privateKey: string }> {
  const web3 = new Web3();
  const account = web3.eth.accounts.create();
  console.log('Wallet created:', account.address, account.privateKey);
  return {
    address: account.address,
    privateKey: account.privateKey,
  };
}

async function postToFaucet(address: string, hcaptchaToken: string, proxy: string): Promise<boolean> {
  try {
    // const proxyAuth = proxy.split('@')[0];
    // let proxyHost = proxy.split('@')[1];
    // proxyHost = proxyHost.startsWith('http') ? proxyHost : 'http://' + proxyHost;
    console.log('Posting to faucet:', address, proxy);
    // const agent = new HttpsProxyAgent(`${proxy}`, {
    //   keepAlive: true,
      
    // });
    const agent = new SocksProxyAgent(`socks5://${proxy}`,{
      keepAlive: true,
    });
    const response = await axios.post(
      FAUCET_API_URL,
      {
        address,
        hcaptchaToken,
      },
      {
        httpAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': faker.internet.userAgent()

        },
        maxRedirects: 0,
        validateStatus: null
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
    if (!proxy) continue;
    // if (await checkProxy(proxy)) {
    const hcaptchaToken = await solveCaptcha();
    const wallet = await createWallet();

    if (await postToFaucet(wallet.address, hcaptchaToken, proxy)) {
      await saveWalletToFile(wallet);
      console.log('Successfully claimed faucet:', wallet.address);
    } else {
      console.log('Failed to claim faucet:', wallet.address);
    }
    // } else {
    //   console.log('Proxy is not live:', proxy);
    // }
  }
}

main().catch((error) => {
  console.error('An error occurred:', error);
});