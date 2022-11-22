# mvc web wallet

## install

```
npm i -S git+https://github.com/klouskingsley/mvc-web-wallet.git
```

## Usage

```js
import webWallet from "mvc-web-wallet";
const { Mvc } = webWallet;

const mvc = new Mvc();
// 连接到钱包
await mvc.requestAccount().then();
// 获取钱包账户信息
const accountInfo = await mvc.getAccount();
// 获取bsv 余额
const bsvBalance = await mvc.getBsvBalance();
// 发送bsv
const transferBsvRes = await mvc.transferBsv({
  receivers: [{ address: "xxx", amount: 333 }],
});
// 发送 sensible ft
const transferFtTres = await mvc.transferSensibleFt({
  receivers: [{ address: "xxx", amount: 344 }],
  codehash: "codehash",
  genesis: "genesis",
  rabinApis: [
    "https://s1.satoplay.com"
]
});
const transferAll = await mvc.transferAll([{
    receivers: [{ address: "xxx", amount: 344 }],
  codehash: "codehash",
  genesis: "genesis",
  rabinApis: [
    "https://s1.satoplay.com"
]
}])
```

## api

### mvc.requestAccount(): Promise<void>

连接到钱包

### mvc.exitAccount(): Promise<void>

退出登录

### mvc.getAccount(): Promise<{name: string, network: 'mainnet' | 'testnet'}>

获取钱包账户信息

### mvc.getAddress(): Promise<string>

获取钱包地址

### mvc.getBsvBalance(): Promise<{balance: number}>

获取钱包 mvc 余额，balance 单位为 satoshi

### mvc.getSensibleFtBalance(): Promise<Array<SensibleFt>>

获取钱包 sensible ft 余额

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

### mvc.transferBsv({receivers: Array<Receiver>}): Promise<{txid: string}>

mvc 转账

```ts
interface Receiver {
  address: string;
  amount: number;
}
```

### mvc.transferSensibleFt({receivers: Array<Receiver>, codehash: string, genesis: string, rabinApis: Array<String>}): Promise<{txid: string}>

sensible ft 转账

```ts
interface Receiver {
  address: string;
  amount: number;
}
```


### mvc.transferAll([{receivers: Array<Receiver>, codehash: string, genesis: string, rabinApis: Array<String>}): Promise<{txid: string}]>

mvc 和 sensible ft 混合转账

```ts
interface Receiver {
  address: string;
  amount: number;
}
```
