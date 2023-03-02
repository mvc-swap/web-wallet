# mvc web wallet

## install

```
npm i -S git+https://github.com/mvc-swap/web-wallet.git
```

## Usage

```js
import webWallet from "mvc-web-wallet";
const { Mvc } = webWallet;

const mvc = new Mvc();
// connect wallet
await mvc.requestAccount().then();
// get wallet account info
const accountInfo = await mvc.getAccount();
// get mvc balance
const mvcBalance = await mvc.getMvcBalance();
// send mvc
const transferMvcRes = await mvc.transferMvc({
  receivers: [{ address: "xxx", amount: 333 }],
});
// send token
const transferFtTres = await mvc.transferSensibleFt({
  receivers: [{ address: "xxx", amount: 344 }],
  codehash: "codehash",
  genesis: "genesis",
});
const transferAll = await mvc.transferAll([{
    receivers: [{ address: "xxx", amount: 344 }],
  codehash: "codehash",
  genesis: "genesis",
}])
```

## api

### mvc.requestAccount(): Promise<void>

Connect to wallet

### mvc.exitAccount(): Promise<void>

Log out

### mvc.getAccount(): Promise<{name: string, network: 'mainnet' | 'testnet'}>

Get account info

### mvc.getAddress(): Promise<string>

Get Wallet address

### mvc.getMvcBalance(): Promise<{balance: number}>

Get space balance, satoshi

### mvc.getSensibleFtBalance(): Promise<Array<SensibleFt>>

Get token balance

```ts
interface SensibleFt {
  genesis: string;
  codehash: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: number;
  balance: number;
}
```

### mvc.transferMvc({receivers: Array<Receiver>}): Promise<{txid: string}>

Transfer space

```ts
interface Receiver {
  address: string;
  amount: number;
}
```

### mvc.transferSensibleFt({receivers: Array<Receiver>, codehash: string, genesis: string, rabinApis: Array<String>}): Promise<{txid: string}>

Transfer token

```ts
interface Receiver {
  address: string;
  amount: number;
}
```


### mvc.transferAll([{receivers: Array<Receiver>, codehash: string, genesis: string, rabinApis: Array<String>}): Promise<{txid: string}]>

Transfer space and token

```ts
interface Receiver {
  address: string;
  amount: number;
}
```
