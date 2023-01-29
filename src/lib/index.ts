import { mvc, toHex, signTx } from 'mvc-scrypt';
import { NetWork } from '../web3';
import {Key, SensibleFt, SensibleSatotx, TransferReceiver, BsvUtxo} from '../state/stateType'
import axios from 'axios'
import {SensibleFT} from 'meta-contract'
import * as util from './util'
import * as Sentry from "@sentry/react";
import customSatotxList from './customSatotx.json'

const SCAN_URL = 'https://mvcscan.com'
const SCAN_URL_TESTNET = 'https://mvcscan.com'

function getSensibleApiPrefix(network: NetWork) {
    const test = network === NetWork.Mainnet ? '' : '-testnet'
    return `https://api-mvc${test}.metasv.com`
}
function isSensibleSuccess(res: any) {
    return res.status === 200
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function formatValue(value: number, decimal: number) {
    // const bigNum = mvc.crypto.BN.fromNumber(value)
    // return bigNum.div(10**decimal).toString(10)
    // return value / (10**decimal)
    return util.div(value, util.getDecimalString(decimal))
}

export function isValidAddress(network: NetWork, address: string) {
    try {
        new mvc.Address(address, network)
        return true
    } catch (_) {
        return false
    }
}

export function generateKeysFromEmailPassword(email: string, pass: string, network: NetWork = NetWork.Testnet): Key {
    let s: string = email
    s += '|'+pass+'|';
    s += s.length+'|!@'+((pass.length*7)+email.length)*7;
    var regchars = (pass.match(/[a-z]+/g)) ? pass.match(/[a-z]+/g)!.length : 1;
    var regupchars = (pass.match(/[A-Z]+/g)) ? pass.match(/[A-Z]+/g)!.length : 1;
    var regnums = (pass.match(/[0-9]+/g)) ? pass.match(/[0-9]+/g)!.length : 1;
    s += ((regnums+regchars)+regupchars)*pass.length+'3571';
    s += (s+''+s);

    let bufferS = Buffer.from(s)
    bufferS = mvc.crypto.Hash.sha256(bufferS)
	for(let i=0;i<=49;i++){
        const tmp = Buffer.from(bufferS.toString('hex'))
        bufferS = mvc.crypto.Hash.sha256(tmp)
	}
    const hex = mvc.crypto.Hash.sha256(Buffer.from(bufferS.toString('hex'))).toString('hex')
    
    const privateKey = new mvc.PrivateKey(hex, network)
    const address = privateKey.toAddress(network).toString()
    
    return {
        address,
        privateKey: privateKey.toString(),
        publicKey: privateKey.toPublicKey().toString()
    }
}

export function getSensibleFtHistoryUrl(network: NetWork, address: string, genesis: string, codehash: string) {
    // https://sensiblequery.com/#/ft/utxo/a1961d0c0ab39f1bd0f79c2f6ae27138cca0620c/d4266deb03b5fdb7c9af39fa71f86f4b1f6390422e9bcd1556399a3f0063965f00000000/1111111111111111111114oLvT2
    const test = network === NetWork.Mainnet ? '' : '/test'
    return `https://sensiblequery.com${test}/#/ft/utxo/${codehash}/${genesis}/${address}`
}

export function getWocAddressUrl(network: NetWork, address: string) {
    let url = ''
    if (network === NetWork.Mainnet) {
        url = SCAN_URL + '/address/'
    } 
    if (network === NetWork.Testnet) {
        url = SCAN_URL_TESTNET + '/address/'
    }
    if (!url) {
        return url
    }
    url += address
    return url
}

export function getWocTransactionUrl(network: NetWork, txid: string) {
    let url = ''
    if (network === NetWork.Mainnet) {
        url = SCAN_URL + '/tx/'
    } 
    if (network === NetWork.Testnet) {
        url = SCAN_URL_TESTNET + '/tx/'
    }
    if (!url) {
        return url
    }
    url += txid
    return url
}

export async function signAnyTx(options: any) {
    const {txHex, scriptHex, inputIndex, privateKey, publicKey, satoshis} = options
    const tx = new mvc.Transaction(txHex)
    const script = mvc.Script.fromBuffer(Buffer.from(scriptHex, 'hex'))
    const sig = toHex(signTx(tx, privateKey , script.toASM(), Number(satoshis), inputIndex))
    
    return {
        publicKey: publicKey.toString(),
        sig,
    }
}

// todo 分页获取
export async function getAddressSensibleFtList(network: NetWork, address: string): Promise<SensibleFt[]> {
    // todo remove next line
    let res: SensibleFt[] = []
    const pageSize = 20
    try {
        for (let page = 1; ; page++) {
            const list = await getAddressSensibleFtListByPage(network, address, page, pageSize)
            res = [...res, ...list]
            if (list.length < pageSize) {
                break
            }
        }
    } catch (err) {
        console.log('getAddressSensibleFtList error')
        console.error(err)
    }
    return res;
}

export async function getAddressSensibleFtListByPage(network: NetWork, address: string, page: number, pageSize: number = 20): Promise<SensibleFt[]> {
    const apiPrefix = getSensibleApiPrefix(network)

    const res = await axios.get(`${apiPrefix}/contract/ft/address/${address}/balance`)
    const success = isSensibleSuccess(res)

    if (success) {
        return (res.data || []).map((item: any) => {
            return {
                genesis: item.genesis,
                codehash: item.codeHash,
                tokenName: item.name,
                tokenSymbol: item.symbol,
                tokenDecimal: item.decimal,
                balance: util.plus(item.confirmedString, item.unconfirmedString),
            }
        })
    }
    throw new Error(res.statusText)
}

// 获取 mvc utxo
export async function getAddressBsvUtxoList(network: NetWork, address: string, page: number, pageSize: number=16): Promise<BsvUtxo[]> {
    const cursor = (page - 1) * pageSize
    const apiPrefix = getSensibleApiPrefix(network)
    const res = await axios.get(`${apiPrefix}/address/${address}/utxo`)
    const success = isSensibleSuccess(res)
    if (success) {
        return (res.data || []).map((item: any) => {
            return {
                txId: item.txid, 
                outputIndex: item.outIndex,
                satoshis: item.value,
                address: address,
            }
        })
    }

    // const fakeUtxoList: BsvUtxo[] = [
    //     {
    //         txId: '6a18f5b859fb4c281affaf8f6245a2fe0813867d4b7d24948da18e099462619b',
    //         outputIndex: 0,
    //         satoshis: 98775,
    //         address,
    //     },
    //     {
    //         txId: 'de980facfe7b10a84bfa658130b2b7725565510f967534459d63e6c9717a08e2',
    //         outputIndex: 0,
    //         satoshis: 98679,
    //         address,
    //     },
    //     {
    //         txId: '8ace8ab3995de63af867d929561b3a48bb499ea8d6e64c2ecefba29c6213764f',
    //         outputIndex: 4,
    //         satoshis: 4939535,
    //         address,
    //     },
    //     {
    //         txId: '74bec534becb77f894bcacaf2386604642a1ea00e371838b1780f5235a12bb9d',
    //         outputIndex: 2,
    //         satoshis: 45033315,
    //         address,
    //     }
    // ]
    // if (page === 1) {
    //     return fakeUtxoList
    // }
    // return []
    
    throw new Error(res.statusText)
}

// 获取bsv 余额, 这里加入了ft utxo的值，暂时不能用
export async function getAddressBsvBalance(network: NetWork, address: string): Promise<number | string> {
    const apiPrefix = getSensibleApiPrefix(network)
    const res = await axios.get(`${apiPrefix}/address/${address}/balance`)
    const success = isSensibleSuccess(res)
    if (success) {
        return util.plus(res.data.confirmed, res.data.unconfirmed)
    }
    throw new Error(res.statusText)
}

export async function getAddressBsvBalanceByUtxo(network: NetWork, address: string): Promise<string> {
    let page = 1
    const pageSize = 16
    let sum: string = '0'
    for (;;) {
        const utxoList = await getAddressBsvUtxoList(network, address, page, pageSize)
        const total = utxoList.reduce((prev: any, cur: any) => util.plus(prev, cur.satoshis), '0')
        sum = util.plus(sum, total)
        if (utxoList.length < pageSize) {
            break
        }
        page++
    }
    console.log('balance', sum)
    return sum
}

// 获取 sensible ft 余额
export async function getAddressSensibleFtBalance(network: NetWork, address: string, codehash: string, genesis: string): Promise<number> {
    const apiPrefix = getSensibleApiPrefix(network)
    const res = await axios.get(`${apiPrefix}/contract/ft/address/${address}/balance?codeHash=${codehash}&&genesis=${genesis}`)
    const success = isSensibleSuccess(res)
    if (success) {
        return Number(util.plus(res.data[0].confirmedString, res.data[0].unconfirmedString))
    }
    throw new Error(res.statusText)
}

// 获取 sensible 余额 地址
export async function getSensibleAddressUrl(network: NetWork, address: string, codehash: string, genesis: string) {
    const test = network === NetWork.Mainnet ? '' : '/test'
    // https://sensiblequery.com/#/ft/utxo/ac939f3cf7aba022d09f05e5448f1e635c81dbb3/598d220eaecb68cf783cbc6cc6295d042897874f/1FJCX1QG7KyaHpx1U2iVe4xoAWNVB1Wd3L
    return `https://sensiblequery.com${test}/#/ft/utxo/${codehash}/${genesis}/${address}`
}


// 广播交易
export async function broadcastSensibleQeury(network: NetWork, rawtx: string) {
    const apiPrefx = getSensibleApiPrefix(network)
    console.log('sensible 交易广播', network, rawtx)
    const res = await axios.post(`${apiPrefx}/tx/broadcast`, {
        hex: rawtx,
    })
    const success = isSensibleSuccess(res)
    if (success) {
        return new mvc.Transaction(rawtx).hash
    }
    throw new Error('broadcast failed')
}


// 发送 token 交易
const mapBsvFeeError = (err: Error) => {
    if (err.message === "Insufficient balance.") {
        // 将模糊的错误信息转换
        return new Error('Low mvc balance to pay miners')
    }
    return err
}
const getCustomSigners = (codehash: string, genesis: string):SensibleSatotx[] => {
    const findValue = customSatotxList.find(item => item.codehash === codehash && item.genesis === genesis)
    if (findValue) {
        return findValue.satotxList
    }
    return []
}
const selectNotNullSigners = (...signerList: SensibleSatotx[][]): SensibleSatotx[] =>  {
    for (let signers of signerList) {
        if (signers && signers.length > 0) {
            return signers
        }
    }
    return []
}
export async function transferSensibleFt(network: NetWork, signers: SensibleSatotx[], senderWif: string, receivers: TransferReceiver[], codehash: string, genesis: string, utxos: any = false, noBroadcast: boolean = false){
    
    const customSigner = getCustomSigners(codehash, genesis)
    signers = selectNotNullSigners(signers, customSigner)

    console.log('signers', signers)
    
    const ft = new SensibleFT({
        network: network as any,
        purse: senderWif,
        feeb: 1.0,
    })
    console.log('transferSensibleFt', receivers, network, codehash, genesis, signers)

    try {
        const {txid, tx, routeCheckTx} = await ft.transfer({
            senderWif: senderWif,
            receivers,
            codehash,
            genesis,
            utxos: utxos,
            noBroadcast,
        })
        if (noBroadcast === true) {
            return {tx, routeCheckTx}
        }
        util.checkFeeRate(tx)
        const txParseRes = parseTransaction(network, tx.serialize(true))
        return {
            txid,
            outputs: txParseRes.outputs,
        }
    } catch (_err: any) {
        const err = mapBsvFeeError(_err)
        const errMsg = err.toString();
        const isBsvAmountExceed =
          errMsg.indexOf(
            "Mvc utxos should be no more than 3 in "
          ) > 0;
        let isFtUtxoAmountExceed = errMsg.indexOf('Too many token-utxos') > 0;
        console.log("broadcast sensible ft error");
        console.error(err);

        if (!isBsvAmountExceed && !isFtUtxoAmountExceed) {
            throw err;
        }

        // 如果 mvc utxo 先 merge mvc utxo
        if (isBsvAmountExceed) {
            try {
                await mergeBsvUtxo(network, senderWif)
                await sleep(3000)
            } catch (err) {
                console.log('merge mvc utxo fail')
                console.error(err)
                throw err
            }

            // merge 后重新发起 ft transfer 交易
            try {
                const {txid, tx} = await ft.transfer({
                    senderWif: senderWif,
                    receivers,
                    codehash,
                    genesis,
                })
                util.checkFeeRate(tx)
                const txParseRes = parseTransaction(network, tx.serialize(true))
                return {
                    txid,
                    outputs: txParseRes.outputs,
                }
            } catch (_err: any) {
                const err = mapBsvFeeError(_err)
                console.log('ft transfer fail after mvc utxo merge')
                console.error(err)
                const errMsg = err.toString()
                isFtUtxoAmountExceed = errMsg.indexOf('Too many token-utxos') > 0;
                if (!isFtUtxoAmountExceed) {
                    throw err
                }
            }
        }

        if (isFtUtxoAmountExceed) {
            // merge utxo
            try {
                //@ts-ignore
                await ft.merge()
                //util.checkFeeRate(tx)
                await sleep(3000)
            } catch (err) {
                console.log('merge ft utxo fail')
                console.error(err)
                throw err
            }

            // merge 后重新发起 ft transfer 交易
            try {
                const {txid, tx} = await ft.transfer({
                    senderWif: senderWif,
                    receivers,
                    codehash,
                    genesis,
                })
                util.checkFeeRate(tx)
                const txParseRes = parseTransaction(network, tx.serialize(true))
                return {
                    txid,
                    outputs: txParseRes.outputs,
                }
            } catch (_err: any) {
                const err = mapBsvFeeError(_err)
                console.log('ft transfer fail after ft utxo merge')
                console.error(err)
                throw err
            }
        }
    } 
}

const Signature = mvc.crypto.Signature;
export const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID;


// p2pkh 解锁
export function unlockP2PKHInput(privateKey: mvc.PrivateKey, tx: mvc.Transaction, inputIndex: number, sigtype: number) {
    const sig = new mvc.Transaction.Signature({
      publicKey: privateKey.publicKey,
      prevTxId: tx.inputs[inputIndex].prevTxId,
      outputIndex: tx.inputs[inputIndex].outputIndex,
      inputIndex,
      signature: mvc.Transaction.Sighash.sign(
        tx,
        privateKey,
        sigtype,
        inputIndex,
        tx.inputs[inputIndex].output.script,
        tx.inputs[inputIndex].output.satoshisBN
      ),
      sigtype,
    });
  
    tx.inputs[inputIndex].setScript(
      mvc.Script.buildPublicKeyHashIn(
        sig.publicKey,
        sig.signature.toDER(),
        sig.sigtype
      )
    );
}

// 发送 mvc 交易
function checkBsvReceiversSatisfied(receivers: TransferReceiver[], tx: any, network: NetWork) {
    let satified = true
    const txAddressAmountMap: {[key: string]: number} = {}
    const getKey = (address: string, amount: any) => {
        return `${address}_${util.toString(amount)}`
    }
    tx.outputs.forEach((output: any) => {
        const address = output.script.toAddress(network);
        const amount = output.satoshis
        const key = getKey(address, amount)
        txAddressAmountMap[key] = (txAddressAmountMap[key] || 0) + 1
    })
    for (let i = 0; i < receivers.length; i++) {
        const rece = receivers[i]
        const key = getKey(rece.address, rece.amount)
        if (!txAddressAmountMap[key]) {
            satified = false
            break
        }
        txAddressAmountMap[key] = txAddressAmountMap[key] - 1
    }
    return satified
}
export async function transferBsv(network: NetWork, senderWif: string, receivers: TransferReceiver[], noBroadcast: boolean=false, allUtxos: boolean=false) {
    // 1. 获取用户 utxo 列表
    // 2. 判断 utxo 金额 是否 满足 receivers 金额
    // 3. 构造交易
    // 4. 广播交易
    console.log('arguments', network, senderWif, receivers)
    const address = new mvc.PrivateKey(senderWif, network).toAddress(network)
    const balance = await getAddressBsvBalanceByUtxo(network, address)
    const totalOutput = receivers.reduce((prev: any, cur) => util.plus(prev, cur.amount), '0')
    if (util.lessThan(balance, totalOutput)) {
        throw new Error('Insufficient_bsv_Balance')
    }
    let utxoValue: string = '0'
    let selectedUtxoList = []

    const tx = new mvc.Transaction()
    tx.feePerKb(500)
    const dust = 456

    // input = output + fee + change
    // 异常情况: 加上 change 后, fee 增加, 原本 input 不够了, 此时将所有输出移除, 然后，暂不考虑
    
    const pageSize = 16
    for (let page = 1; ;page++) {
        const utxoResList = await getAddressBsvUtxoList(network, address, page, pageSize)
        for (let i = 0; i < utxoResList.length; i++) {
            const item = utxoResList[i]
            utxoValue = util.plus(utxoValue, item.satoshis)
            selectedUtxoList.push(item)
            tx.addInput(
                new mvc.Transaction.Input.PublicKeyHash({
                    output: new mvc.Transaction.Output({
                        script: mvc.Script.buildPublicKeyHashOut(item.address),
                        satoshis: item.satoshis,
                    }),
                    prevTxId: item.txId,
                    outputIndex: item.outputIndex,
                    script: mvc.Script.empty(),
                })
            );
            if (!allUtxos && util.lessThanEqual(util.plus(totalOutput, dust), utxoValue)) {
                break
            }
        }
        if (!allUtxos && util.lessThanEqual(util.plus(totalOutput, dust), utxoValue)) {
            break
        }
        if (utxoResList.length <= pageSize) {
            break
        }
    }
    receivers.forEach(item => {
        tx.to(item.address, +item.amount)
    })
    if (util.greaterThan(util.minus(utxoValue, +totalOutput), 0)) {
        tx.change(address)
    }
    // 如果 (utxo输入 - fee - 所有输出) = 找零 < dust，那么全部转出
    if (util.lessThan(util.minus(utxoValue, tx.getFee(), totalOutput), dust)) {
        // 全部转出
        tx.clearOutputs()
        receivers.forEach((item, index) => {
            
            if (receivers.length === index + 1) {
                // 最后一个使用 change
                tx.change(item.address)
            } else {
                tx.to(item.address, +item.amount)
            }
        })
    }
    tx.inputs.forEach((_: any, inputIndex: number) => {
        const privateKey = new mvc.PrivateKey(senderWif)
        unlockP2PKHInput(privateKey, tx, inputIndex, sighashType);
    });
    util.checkFeeRate(tx)
    if (noBroadcast === true) {
        return tx
    }
    const txid = await broadcastSensibleQeury(network, tx.serialize())
    const txParseRes = parseTransaction(network, tx.serialize(true))

    const amountSatified = checkBsvReceiversSatisfied(receivers, tx, network)
    if (!amountSatified) {
        console.log(util.safeJsonStringify({
            type: 'bsvTransferAmountNotSatified',
            txid: tx.hash,
            receivers,
            outputs: txParseRes.outputs,
        }))
        Sentry.captureMessage(`bsvTransferAmountNotSatified_${address}_${tx.hash}`);
    }
    return {
        txid,
        outputs: txParseRes.outputs,
        fee: tx.getFee()
    }
}

// 合并 mvc utxo, 合并一页
export async function mergeBsvUtxo(network: NetWork, senderWif: string) {
    const address = new mvc.PrivateKey(senderWif, network).toAddress(network)
    const utxolist = await getAddressBsvUtxoList(network, address, 1)
    const tx = new mvc.Transaction()
    tx.feePerKb(500)
    utxolist.forEach(item => {
        tx.addInput(new mvc.Transaction.Input.PublicKeyHash({
            output: new mvc.Transaction.Output({
                script: mvc.Script.buildPublicKeyHashOut(item.address),
                satoshis: item.satoshis,
            }),
            prevTxId: item.txId,
            outputIndex: item.outputIndex,
            script: mvc.Script.empty(),
        }))
    })
    tx.change(address)
    tx.inputs.forEach((_: any, inputIndex: number) => {
        const privateKey = new mvc.PrivateKey(senderWif)
        unlockP2PKHInput(privateKey, tx, inputIndex, sighashType)
    })
    util.checkFeeRate(tx)
    const txid = await broadcastSensibleQeury(network, tx.serialize())
    const txParseRes = parseTransaction(network, tx.serialize(true))
    return {
        txid,
        outputs: txParseRes.outputs,
    }
}


const parseTokenContractScript = function (scriptBuf: any, network: any = "mainnet") {
    
    //TODO: const parsed = SensibleFT.parseTokenScript(scriptBuf, network)
    
    return 
};



export function parseTransaction(network: NetWork, rawtx: string) {
    let tx
    try {
        tx = new mvc.Transaction(rawtx)
    } catch (err: any) {
        return {
            error: err.message
        }
    }

    const inputs = tx.inputs.map((input: any, index: number) => {
        const ftToken: any = parseTokenContractScript(input.script.toBuffer(), network);

        let ret: any = {
            index: index,
            prevTxId: input.prevTxId.toString('hex'),
            outputIndex: input.outputIndex,
            script: input.script.toString('hex'),
        }
        try {
            const addr = input.script.toAddress(network);
            if (addr) {
                ret.address = addr.toString()
            }
        } catch (err) {}
        if (!ftToken) {
            return ret
        }
        if (ftToken.tokenAmount <= 0) {
            return ret
        }
        ret = {
            ...ret,
            isFt: true,
            ftDetail: {
                genesis: ftToken.genesis,
                codehash: ftToken.codehash,
                address: ftToken.tokenAddress,
                decimal: ftToken.decimalNum,
                name: ftToken.tokenName,
                symbol: ftToken.tokenSymbol,
            }
        }
        return ret
    })
    const outputs = tx.outputs.map((output: any, index: number) => {
        const ftToken: any = parseTokenContractScript(output.script.toBuffer(), network);
        let ret: any = {
            index: index,
            satoshis: output.satoshis,
            script: output.script.toString('hex')
        }
        try {
            const addr = output.script.toAddress(network);
            if (addr) {
                ret.address = addr.toString()
            }
        } catch (err) {}
        if (!ftToken) {
            return ret
        }
        if (ftToken.tokenAmount <= 0) {
            return ret
        }
        ret = {
            ...ret,
            isFt: true,
            ftDetail: {
                genesis: ftToken.genesis,
                codehash: ftToken.codehash,
                address: ftToken.tokenAddress,
                decimal: ftToken.decimalNum,
                name: ftToken.tokenName,
                symbol: ftToken.tokenSymbol,
                amount: ftToken.tokenAmount,
            }
        }
        return ret
    })

    return {
        inputs: inputs,
        outputs: outputs,
        txid: tx.hash,
    }
    
}


(window as any).transferBsv = transferBsv;
(window as any).signAnyTx = signAnyTx;